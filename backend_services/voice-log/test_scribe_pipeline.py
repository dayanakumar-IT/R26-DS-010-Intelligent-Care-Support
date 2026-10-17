"""Unit-level tests for the Change 1-3 SCRIBE pipeline additions.

Run from this directory: python test_scribe_pipeline.py

Style matches test_api_smoke.py (plain script, no pytest dependency). These
tests exercise the new orchestration/rules code directly with synthetic
inputs and stub data rather than the real Whisper/BART/T5 models — model
*accuracy* isn't something a deterministic test can check; what we can and
do check is: chunking math, sentence splitting, protected-vocabulary
survival through real LanguageTool correction, and the alert-rule table.

Covers the 5 required scenarios:
  1. Single short observation -> unchanged (mock pipeline).
  2. Paragraph with 3 observations -> 3 sentences detected.
  3. Recording longer than 30s -> chunked into equal <=30s pieces, nothing
     silently dropped after the old 30s cutoff.
  4. Protected vocabulary survives grammar correction.
  5. Alert rules: nurse_check "very high" -> Yes, "normal" -> No.
"""

from __future__ import annotations

import os
import sys

os.environ.setdefault("SCRIBE_MOCK_PIPELINE", "true")

import numpy as np

from app.pipeline import adl_rules
from app.pipeline.audio_preprocess import split_into_chunks
from app.pipeline.runner import get_pipeline
from app.pipeline.sentence_split import split_sentences
from app.schemas import AdlExtraction

FAILURES: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"  PASS: {label}")
    else:
        print(f"  FAIL: {label} {detail}")
        FAILURES.append(label)


def test_1_single_short_observation_unchanged() -> None:
    print("1. Single short observation (mock pipeline) must be unchanged...")
    import tempfile
    from pathlib import Path

    import soundfile as sf

    # A real (non-silent) 1s tone so preprocess_audio's silence/RMS gates pass
    # before the mock short-circuit — preprocess_audio still runs even when
    # SCRIBE_MOCK_PIPELINE=true, same as in the current pipeline.
    sample_rate = 16000
    t = np.linspace(0, 1.0, sample_rate, endpoint=False)
    tone = (0.2 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    sf.write(str(tmp_path), tone, sample_rate)

    try:
        result = get_pipeline().run(tmp_path)
    finally:
        tmp_path.unlink(missing_ok=True)

    check("exactly one record", len(result.records) == 1, f"got {len(result.records)}")
    check("category is medication", result.extraction.category == "medication")
    check("medication name is Metformin", result.extraction.medication_name == "Metformin")
    check(
        "cleaned_transcript matches the known mock sentence",
        result.cleaned_transcript == "Gave P01 her Metformin this morning, no issues.",
    )


def test_2_three_observations_split_into_three_sentences() -> None:
    print("2. Paragraph with 3 observations -> 3 sentences, chest pain alerts...")
    paragraph = (
        "Gave her Metformin 500mg this morning. "
        "She had rice and fish curry for lunch, full intake. "
        "She complained of chest pain after lunch."
    )
    sentences = split_sentences(paragraph)
    check("3 sentences detected", len(sentences) == 3, f"got {sentences}")

    # The chest-pain sentence should alert once a symptom_type is present —
    # this is the rule layer's job (Change 3c), independent of T5 accuracy.
    symptom_extraction = AdlExtraction(category="symptom", symptom_type="chest pain")
    alerted = adl_rules.apply_alert_rules(
        symptom_extraction, "She complained of chest pain after lunch."
    )
    check("chest pain symptom alerts", alerted.alert_required is True)


def test_3_long_recording_chunked_equally() -> None:
    print("3. Recording longer than 30s is split into equal chunks (nothing lost after 30s)...")
    sample_rate = 16000
    duration_seconds = 51
    audio = np.zeros(duration_seconds * sample_rate, dtype=np.float32)

    chunks = split_into_chunks(audio, sample_rate)
    check("2 chunks for a 51s recording", len(chunks) == 2, f"got {len(chunks)}")

    total_samples = sum(len(c) for c in chunks)
    check(
        "no audio lost or duplicated across chunks",
        total_samples == audio.size,
        f"got {total_samples}, expected {audio.size}",
    )
    if len(chunks) == 2:
        expected_samples = int(25.5 * sample_rate)
        check(
            "each chunk is ~25.5s, not a 30s + short-tail split",
            all(abs(len(c) - expected_samples) <= 1 for c in chunks),
            f"chunk lengths: {[len(c) / sample_rate for c in chunks]}",
        )

    short_audio = np.zeros(10 * sample_rate, dtype=np.float32)
    check(
        "audio <=30s is returned as a single unchanged chunk",
        len(split_into_chunks(short_audio, sample_rate)) == 1,
    )


def test_4_protected_vocabulary_survives_grammar_correction() -> None:
    print("4. Protected vocabulary (Losartan, Kiribath) survives grammar correction...")
    try:
        from app.pipeline.grammar import correct_grammar

        corrected = correct_grammar("She took Losartan and ate Kiribath.")
        print(f"   corrected: {corrected}")
        check("Losartan unchanged", "Losartan" in corrected, f"got: {corrected}")
        check("Kiribath unchanged", "Kiribath" in corrected, f"got: {corrected}")
    except Exception as exc:  # pragma: no cover - LanguageTool needs Java + first-run download
        print(f"   SKIPPED (LanguageTool unavailable in this environment): {exc}")


def test_5_nurse_check_alert_rules() -> None:
    print("5. nurse_check alert rules: 'very high' -> Yes, 'normal' -> No...")
    high_bp = AdlExtraction(
        category="nurse_check",
        vital_type="blood pressure",
        vital_reading="180/110",
        vital_status="very high",
        alert_required=False,
    )
    normal_bp = AdlExtraction(
        category="nurse_check",
        vital_type="blood pressure",
        vital_reading="115/65",
        vital_status="normal",
        alert_required=True,  # simulates T5 incorrectly flagging a normal reading
    )

    check(
        "very high blood pressure alerts",
        adl_rules.apply_alert_rules(
            high_bp, "The nurse checked her blood pressure and it was very high."
        ).alert_required is True,
    )
    check(
        "normal blood pressure does not alert (overrides a false positive)",
        adl_rules.apply_alert_rules(
            normal_bp, "Blood pressure was 115/65 and it was normal."
        ).alert_required is False,
    )

    # Partial/refused meal intake also alerts (Change 3c), not just symptoms.
    refused_meal = AdlExtraction(category="meal", food_item="dinner", intake_level="refused")
    check(
        "refused meal intake alerts",
        adl_rules.apply_alert_rules(refused_meal, "She refused dinner today.").alert_required is True,
    )

    # Dosage/food completion (Change 3a) — "no issues" must never be read as a dosage.
    filled = adl_rules.fill_missing_fields(
        AdlExtraction(category="medication"), "Gave her 500mg of Metformin, no issues this morning"
    )
    check("dosage filled from text", filled.dosage == "500mg", f"got {filled.dosage}")
    check("medication name filled from protected vocab", filled.medication_name == "Metformin")

    no_dosage = adl_rules.fill_missing_fields(AdlExtraction(category="symptom"), "No issues reported today")
    check("'no issues' is never read as a dosage", no_dosage.dosage is None, f"got {no_dosage.dosage}")

    # Two-event splitting (Change 3d).
    clauses = adl_rules.maybe_split_two_events("I gave her the tablet and she ate breakfast")
    check("two-event sentence splits into two clauses", len(clauses) == 2, f"got {clauses}")


def test_6_negation_aware_symptom_category() -> None:
    print("6. Negation-aware symptom category/alert — a real symptom is never overridden,")
    print("   a negated symptom never forces 'symptom' or an alert...")
    from app.pipeline.extraction import _parse_extraction, has_non_negated_symptom_word

    def run(text: str, simulated_t5_raw: str):
        extraction = _parse_extraction(simulated_t5_raw, fallback_text=text)
        return adl_rules.apply_hybrid_rules(extraction, text)

    # A real symptom word must keep 'symptom' even when another ADL keyword
    # ("walking" -> mobility) is also present in the same sentence.
    result = run(
        "She had chest pain while walking to the dining room.",
        "category: symptom; symptom: chest pain; alert_required: true",
    )
    check("chest-pain-while-walking stays 'symptom'", result.category == "symptom", f"got {result.category}")
    check("chest-pain-while-walking alerts", result.alert_required is True)

    result = run(
        "After lunch, she complained of a headache.",
        "category: symptom; symptom: headache; alert_required: true",
    )
    check("headache-after-lunch stays 'symptom'", result.category == "symptom", f"got {result.category}")
    check("headache-after-lunch alerts", result.alert_required is True)

    # No symptom word at all -> the keyword-guess override is still allowed
    # (protects against T5 mislabelling a plain mobility sentence).
    result = run(
        "She walked to the dining room with a walker.",
        "category: symptom; alert_required: true",  # simulates a T5 false positive
    )
    check("no-symptom-word sentence is overridden to 'mobility'", result.category == "mobility", f"got {result.category}")
    check("no-symptom-word sentence does not alert", result.alert_required is False)

    # A negated symptom must not force 'symptom' or alert.
    has_symptom, _ = has_non_negated_symptom_word("She had no fever today.")
    check("'no fever' has no non-negated symptom word", has_symptom is False)
    result = run("She had no fever today.", "category: symptom; symptom: fever; alert_required: true")
    check("'no fever' is not categorised as symptom", result.category != "symptom", f"got {result.category}")
    check("'no fever' does not alert", result.alert_required is False)

    result = run(
        "She did not have any pain after the bath.",
        "category: symptom; symptom: pain; alert_required: true",
    )
    check("negated pain falls back to 'hygiene'", result.category == "hygiene", f"got {result.category}")
    check("negated pain does not alert", result.alert_required is False)

    # Unrelated single-observation sentence (matches the mock pipeline's
    # own sentence) must be completely unaffected by this change.
    result = run(
        "Gave her Metformin 500mg this morning, no issues.",
        "category: medication; medication: Metformin; dosage: 500mg; alert_required: false",
    )
    check("plain medication sentence still categorised as 'medication'", result.category == "medication")
    check("plain medication sentence does not alert", result.alert_required is False)


def main() -> None:
    test_1_single_short_observation_unchanged()
    test_2_three_observations_split_into_three_sentences()
    test_3_long_recording_chunked_equally()
    test_4_protected_vocabulary_survives_grammar_correction()
    test_5_nurse_check_alert_rules()
    test_6_negation_aware_symptom_category()

    print()
    if FAILURES:
        print(f"FAILED: {len(FAILURES)} check(s) failed -> {FAILURES}")
        sys.exit(1)
    print("All checks passed.")


if __name__ == "__main__":
    main()
