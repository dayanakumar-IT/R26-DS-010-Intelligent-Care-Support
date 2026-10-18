"""Hybrid ADL extraction layer (Change 3) — runs AFTER T5 extraction.

T5-small stays the primary extractor. This module only ever:
  1. fills fields T5 left empty (never overwrites a value T5 already set),
  2. corrects a category that clearly contradicts the sentence, and
  3. (re)derives alert_required from the final structured fields.

Each concern is its own small, independently-testable function so it can
be explained piece by piece.
"""

from __future__ import annotations

import logging
import re

from app.pipeline.extraction import guess_category_keywords, has_non_negated_symptom_word
from app.schemas import AdlExtraction

# get_protected_medications/get_protected_foods (app.pipeline.grammar) are
# imported lazily inside the functions that use them below, matching
# runner.py's existing pattern of deferring the LanguageTool-adjacent import
# until it's actually needed (keeps SCRIBE_MOCK_PIPELINE=true usable even in
# environments where LanguageTool hasn't been set up).

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------
# 3(a) Field completion
# --------------------------------------------------------------------------

_DOSAGE_UNIT_RE = re.compile(
    r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|tablets?|capsules?)\b", re.IGNORECASE
)
_DOSAGE_WORD_RE = re.compile(
    r"\b(?:half|one|two|three|four|five)\s+(?:a\s+)?tablets?\b", re.IGNORECASE
)

_BLOOD_PRESSURE_RE = re.compile(r"\b(\d{2,3})\s*/\s*(\d{2,3})\b")
_BLOOD_SUGAR_RE = re.compile(r"\b(\d{2,3})\s*mg\s*/\s*d[lL]\b", re.IGNORECASE)

_TIME_KEYWORDS = (
    "morning", "afternoon", "evening", "night",
    "breakfast", "lunch", "dinner",
)
_CLOCK_TIME_RE = re.compile(r"\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(am|pm)?\b", re.IGNORECASE)


def _find_protected_term(text: str, terms: frozenset[str]) -> str | None:
    """Longest-match-first so 'Sindopa Plus' wins over plain 'Sindopa'."""
    lowered = text.lower()
    for term in sorted(terms, key=len, reverse=True):
        if re.search(rf"\b{re.escape(term)}\b", lowered, re.IGNORECASE):
            return term
    return None


def _extract_dosage(text: str) -> str | None:
    match = _DOSAGE_UNIT_RE.search(text) or _DOSAGE_WORD_RE.search(text)
    return match.group(0).strip() if match else None


def _extract_time_of_day(text: str) -> str | None:
    lowered = text.lower()
    for keyword in _TIME_KEYWORDS:
        if keyword in lowered:
            return keyword
    clock_match = _CLOCK_TIME_RE.search(text)
    return clock_match.group(0).strip() if clock_match else None


def fill_missing_fields(extraction: AdlExtraction, sentence: str) -> AdlExtraction:
    """Fill fields T5 left empty using the regex/vocabulary rules in Change 3a.
    Never touches a field that already has a value."""
    from app.pipeline.grammar import get_protected_foods, get_protected_medications

    updates: dict[str, object] = {}

    if not extraction.medication_name:
        medication = _find_protected_term(sentence, get_protected_medications())
        if medication:
            updates["medication_name"] = medication

    if not extraction.food_item:
        food = _find_protected_term(sentence, get_protected_foods())
        if food:
            updates["food_item"] = food

    if not extraction.dosage:
        dosage = _extract_dosage(sentence)
        if dosage:
            updates["dosage"] = dosage

    if not extraction.vital_reading or not extraction.vital_type:
        bp_match = _BLOOD_PRESSURE_RE.search(sentence)
        sugar_match = _BLOOD_SUGAR_RE.search(sentence)
        if sugar_match and not extraction.vital_reading:
            updates.setdefault("vital_type", extraction.vital_type or "blood sugar")
            updates["vital_reading"] = f"{sugar_match.group(1)} mg/dL"
        elif bp_match and not extraction.vital_reading:
            updates.setdefault("vital_type", extraction.vital_type or "blood pressure")
            updates["vital_reading"] = f"{bp_match.group(1)}/{bp_match.group(2)}"

    if not extraction.time_of_day:
        time_of_day = _extract_time_of_day(sentence)
        if time_of_day:
            updates["time_of_day"] = time_of_day

    if not updates:
        return extraction
    return extraction.model_copy(update=updates)


# --------------------------------------------------------------------------
# 3(b) Category contradiction check
# --------------------------------------------------------------------------

_MEDICATION_ACTION_RE = re.compile(r"\b(gave|give|given|took|take|taken|administered)\b", re.IGNORECASE)


def reconcile_category(extraction: AdlExtraction, sentence: str) -> AdlExtraction:
    """If a protected medication name appears alongside a medication-giving
    verb but T5 picked a different category, conservatively correct it."""
    if extraction.category == "medication":
        return extraction

    from app.pipeline.grammar import get_protected_medications

    medication = _find_protected_term(sentence, get_protected_medications())
    if medication and _MEDICATION_ACTION_RE.search(sentence):
        logger.info(
            "adl_rules: correcting category %r -> 'medication' "
            "(found %r with a medication-giving verb) for sentence: %s",
            extraction.category,
            medication,
            sentence[:120],
        )
        return extraction.model_copy(
            update={"category": "medication", "medication_name": extraction.medication_name or medication}
        )
    return extraction


# --------------------------------------------------------------------------
# 3(c) Field-based alert rules
# --------------------------------------------------------------------------

_ABNORMAL_VITAL_STATUSES = {"high", "very high", "elevated", "low", "abnormal"}


def apply_alert_rules(extraction: AdlExtraction, sentence: str) -> AdlExtraction:
    """Derive alert_required from the final structured fields. Falls back to
    whatever T5 already decided when none of these specific rules apply.

    `sentence` is used for the negation check — extraction.symptom_type
    alone isn't enough to prove the symptom is real: Stage 5's own field
    filler (_enrich_from_text) picks the first keyword it finds in a fixed
    list regardless of position, so it can set symptom_type from a negated
    mention even when category is 'symptom' because of a different, real
    symptom elsewhere in the same sentence (e.g. "denies chest pain but has
    a headache"). This is the same has_non_negated_symptom_word() check
    extraction.py's _reconcile_category uses, so negation is treated
    identically everywhere a symptom alert could be raised.
    """
    if extraction.category == "symptom":
        has_symptom, _word = has_non_negated_symptom_word(sentence)
        if has_symptom:
            if not extraction.alert_required:
                return extraction.model_copy(update={"alert_required": True})
            return extraction
        if extraction.alert_required:
            logger.info(
                "adl_rules: suppressing symptom alert — no non-negated symptom "
                "word found in: %s",
                sentence[:160],
            )
            return extraction.model_copy(update={"alert_required": False})
        return extraction

    if extraction.category == "meal" and extraction.intake_level in {"partial", "refused"}:
        if not extraction.alert_required:
            return extraction.model_copy(update={"alert_required": True})
        return extraction

    if extraction.category == "nurse_check":
        status = (extraction.vital_status or "").strip().lower()
        if status in _ABNORMAL_VITAL_STATUSES and not extraction.alert_required:
            return extraction.model_copy(update={"alert_required": True})
        if status == "normal" and extraction.alert_required:
            return extraction.model_copy(update={"alert_required": False})

    return extraction


# --------------------------------------------------------------------------
# 3(d) Two observations joined by "and" in one sentence
# --------------------------------------------------------------------------

_WORD_RE = re.compile(r"[A-Za-z']+")
_AND_RE = re.compile(r"\band\b", re.IGNORECASE)


def _word_count(text: str) -> int:
    return len(_WORD_RE.findall(text))


def maybe_split_two_events(sentence: str) -> list[str]:
    """Split a sentence on its first 'and' only when the two halves clearly
    describe different ADL categories (e.g. medication vs. meal). If unsure,
    keep it as one sentence — this must never split a single observation."""
    match = _AND_RE.search(sentence)
    if not match:
        return [sentence]

    left = sentence[: match.start()].strip().rstrip(",")
    right = sentence[match.end():].strip()
    if _word_count(left) < 2 or _word_count(right) < 2:
        return [sentence]

    left_category = guess_category_keywords(left)
    right_category = guess_category_keywords(right)
    if left_category != right_category:
        logger.info(
            "adl_rules: splitting two-event sentence into %r (%s) and %r (%s)",
            left, left_category, right, right_category,
        )
        return [left, right]
    return [sentence]


# --------------------------------------------------------------------------
# Orchestrator
# --------------------------------------------------------------------------

def apply_hybrid_rules(extraction: AdlExtraction, sentence: str) -> AdlExtraction:
    """Run the full Change 3 rule layer on one sentence's T5 extraction, in order:
    fill missing fields -> reconcile category -> (re)apply alert rules."""
    extraction = fill_missing_fields(extraction, sentence)
    extraction = reconcile_category(extraction, sentence)
    extraction = apply_alert_rules(extraction, sentence)
    return extraction
