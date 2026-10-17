"""Orchestrates SCRIBE pipeline stages 1-5, including Change 1's support for
long recordings and multiple observations per recording.

Per-recording flow:
  1. Preprocess audio once (resample/trim — unchanged).
  2. ASR: chunk into <=30s pieces only if needed, transcribe each, join.
  3. Sanitize (non-rejecting) the joined transcript, then split into
     sentences — one sentence == the whole transcript when there's no
     sentence-ending punctuation, which is what keeps a single short
     observation on exactly the same path as before this feature.
  4. Per sentence (isolated by try/except so one bad sentence can't take
     the rest of the recording down with it): disfluency -> grammar ->
     re-validate -> maybe split into two clauses -> T5 extraction ->
     hybrid rules (Change 3).
  5. Collect every successful observation into PipelineResult.records.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from uuid import uuid4

from app import config
from app.pipeline import adl_rules
from app.pipeline.audio_preprocess import load_wav_array, preprocess_audio, split_into_chunks
from app.pipeline.sentence_split import split_sentences
from app.pipeline.transcript_quality import (
    sanitize_transcript,
    validate_polished_transcript,
    validate_transcript,
)
from app.schemas import AdlExtraction, PipelineRecord, PipelineResult

logger = logging.getLogger(__name__)

# "Remove characters outside the basic Latin range" (Change 1a) — applied
# per ASR chunk before joining, for long recordings only. Short (single
# chunk) recordings skip this so their raw_transcript is untouched.
_NON_BASIC_LATIN_RE = re.compile(r"[^\x00-\x7F]+")


class ScribePipeline:
    def __init__(self) -> None:
        self._asr: WhisperAsr | None = None
        self._disfluency: DisfluencyRemover | None = None
        self._extractor: AdlExtractor | None = None

    @property
    def models_loaded(self) -> bool:
        return self._asr is not None and self._disfluency is not None and self._extractor is not None

    def load_models(self) -> None:
        if config.MOCK_PIPELINE:
            logger.warning("SCRIBE_MOCK_PIPELINE=true — ML models will not be loaded")
            return
        logger.info("Loading SCRIBE ML models (this may take a minute on first run)...")
        from app.pipeline.asr import WhisperAsr
        from app.pipeline.disfluency import DisfluencyRemover
        from app.pipeline.extraction import AdlExtractor

        self._asr = WhisperAsr()
        self._disfluency = DisfluencyRemover()
        self._extractor = AdlExtractor()
        logger.info("SCRIBE ML models loaded")

    # ------------------------------------------------------------------
    # Stage 2 — ASR, with long-recording chunking (Change 1a)
    # ------------------------------------------------------------------
    def _transcribe_full(self, wav_path: Path) -> str:
        audio, sample_rate = load_wav_array(wav_path)
        chunks = split_into_chunks(audio, sample_rate)

        if len(chunks) == 1:
            return self._asr.transcribe_array(chunks[0])

        logger.info("ASR chunking (%s): split into %d equal chunks", wav_path.name, len(chunks))
        pieces: list[str] = []
        for index, chunk in enumerate(chunks):
            text = self._asr.transcribe_array(chunk)
            text = _NON_BASIC_LATIN_RE.sub("", text).strip()
            logger.info(
                "ASR chunk %d/%d (%s): %s",
                index + 1, len(chunks), wav_path.name, text[:80] if text else "(empty)",
            )
            if text:
                pieces.append(text)
        return " ".join(pieces)

    # ------------------------------------------------------------------
    # Stages 3-5 + hybrid rules, for one sentence (Change 1b/1d + Change 3)
    # ------------------------------------------------------------------
    def _process_sentence(self, sentence: str) -> tuple[list[PipelineRecord], str | None]:
        """Returns (records, error_message). error_message is set only when
        no record could be produced, so callers can surface a specific
        reason instead of a generic one when there's exactly one failure."""
        records: list[PipelineRecord] = []
        last_error: str | None = None

        for clause in adl_rules.maybe_split_two_events(sentence):
            try:
                cleaned = self._disfluency.clean(clause)
                cleaned = sanitize_transcript(cleaned)
                if not cleaned:
                    last_error = (
                        "Transcription was empty after cleaning. "
                        "Please record a clear ADL observation and try again."
                    )
                    continue

                from app.pipeline.grammar import correct_grammar

                grammatical = sanitize_transcript(correct_grammar(cleaned))
                if not grammatical:
                    last_error = (
                        "Transcription was empty after grammar correction. "
                        "Please record again with a clear ADL description."
                    )
                    continue
                grammatical = validate_polished_transcript(grammatical)

                extraction = self._extractor.extract(grammatical)
                extraction = adl_rules.apply_hybrid_rules(extraction, grammatical)

                records.append(
                    PipelineRecord(raw_segment=clause, cleaned_segment=grammatical, extraction=extraction)
                )
            except ValueError as exc:
                last_error = str(exc)
                logger.warning("Clause rejected, skipping: %s", exc)
            except Exception:
                last_error = last_error or (
                    "This part of the recording could not be processed. "
                    "Please try recording that observation again."
                )
                logger.exception("Clause failed to process, skipping: %r", clause)

        return records, (last_error if not records else None)

    # ------------------------------------------------------------------
    # Full run
    # ------------------------------------------------------------------
    def run(self, input_audio: Path) -> PipelineResult:
        config.TMP_DIR.mkdir(parents=True, exist_ok=True)
        work_id = uuid4().hex
        wav_path = config.TMP_DIR / f"{work_id}_16k.wav"
        preprocess_audio(input_audio, wav_path)

        if config.MOCK_PIPELINE:
            logger.warning(
                "SCRIBE_MOCK_PIPELINE=true — returning hardcoded demo transcript; "
                "recorded audio is NOT sent to Whisper. Set SCRIBE_MOCK_PIPELINE=false "
                "in .env and restart run.ps1 to use real ASR."
            )
            return _mock_result()

        if not self.models_loaded:
            self.load_models()

        if not self.models_loaded:
            raise RuntimeError(
                "SCRIBE ML models are not loaded. Extract models into models/ "
                "or set SCRIBE_MOCK_PIPELINE=true for demo-only mode."
            )

        raw = self._transcribe_full(wav_path)
        logger.info("ASR transcript (%s): %s", wav_path.name, raw[:120] if raw else "(empty)")

        # Non-rejecting cleanup only here — rejection now happens per sentence
        # below, so one garbled chunk in a long recording can't discard the
        # other, otherwise-valid, observations in the same recording.
        raw = sanitize_transcript(raw)
        if not raw:
            raise ValueError(
                "Could not detect clear speech in this recording. "
                "Please speak directly about the care activity, avoid long silence, and try again."
            )

        sentences = split_sentences(raw)
        logger.info("Sentence split (%s): %d sentence(s) found", wav_path.name, len(sentences))

        records: list[PipelineRecord] = []
        errors: list[str] = []
        for sentence in sentences:
            try:
                validated = validate_transcript(sentence)
            except ValueError as exc:
                errors.append(str(exc))
                logger.warning("Sentence rejected at ASR-quality stage, skipping: %s", exc)
                continue

            sentence_records, error = self._process_sentence(validated)
            records.extend(sentence_records)
            if error:
                errors.append(error)

        if not records:
            # Exactly the same ValueError the caller would have seen before
            # this feature existed, when there's only one sentence to report on.
            raise ValueError(errors[0] if errors else (
                "Could not extract a care observation from this recording. "
                "Please describe what you did for the patient "
                "(medication, meal, hygiene, mobility, symptoms, etc.)."
            ))

        logger.info(
            "Pipeline complete (%s): %d record(s), %d alert(s), categories=%s",
            wav_path.name,
            len(records),
            sum(1 for r in records if r.extraction.alert_required),
            [r.extraction.category for r in records],
        )

        return PipelineResult(
            raw_transcript=raw,
            cleaned_transcript=records[0].cleaned_segment,
            extraction=records[0].extraction,
            records=records,
        )


def _mock_result() -> PipelineResult:
    extraction = AdlExtraction(
        category="medication",
        medication_name="Metformin",
        dosage="500mg",
        time_of_day="morning",
        alert_required=False,
    )
    record = PipelineRecord(
        raw_segment="uh gave P01 her metformin this morning no issues",
        cleaned_segment="Gave P01 her Metformin this morning, no issues.",
        extraction=extraction,
    )
    return PipelineResult(
        raw_transcript=record.raw_segment,
        cleaned_transcript=record.cleaned_segment,
        extraction=extraction,
        records=[record],
    )


_pipeline: ScribePipeline | None = None


def get_pipeline() -> ScribePipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = ScribePipeline()
    return _pipeline
