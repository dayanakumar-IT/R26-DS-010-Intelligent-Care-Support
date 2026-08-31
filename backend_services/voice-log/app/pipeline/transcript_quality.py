"""Transcript sanitization and quality gates — reduce Whisper hallucinations and junk ADL rows."""

from __future__ import annotations

import re
import unicodedata

# Unicode replacement / unknown glyphs often produced on silent audio.
_REPLACEMENT_CHAR = "\ufffd"

# Casual speech that should not become a clinical observation.
_CASUAL_SPEECH_PATTERNS = (
    re.compile(r"\b(just|randomly)\s+(talking|speaking|testing)\b", re.I),
    re.compile(r"\b(i am|i'm)\s+(just\s+)?(talking|speaking|testing)\b", re.I),
    re.compile(r"\b(hello|hi there|hey there|testing|test test|mic check)\b", re.I),
    re.compile(r"\b(one two three|la la la)\b", re.I),
)

# Personal / off-topic narrative (not patient care).
_PERSONAL_NARRATIVE_PATTERNS = (
    re.compile(r"\b(yesterday|tomorrow|last week|next week)\s+i\s+(went|go|going|am|will)\b", re.I),
    re.compile(r"\b(i|we)\s+(went|am going|will go|going)\s+(shopping|on a trip|on trip|to the mall|on vacation|on holiday)\b", re.I),
    re.compile(r"\b(i'm|i am)\s+going\s+(on\s+)?(a\s+)?(trip|vacation|holiday|shopping)\b", re.I),
    re.compile(r"\bwith my\s+(sister|brother|friend|cousin|wife|husband|girlfriend|boyfriend|mom|dad)\b", re.I),
    re.compile(r"\b(weekend|vacation|holiday)\s+(plan|trip|plans)\b", re.I),
    re.compile(r"\b(i|we)\s+(love|like|enjoy)\s+(watching|going)\b", re.I),
)

# Care-related vocabulary drawn from SCRIBE ADL extraction rules.
_ADL_KEYWORDS = (
    # medication
    "metformin", "losartan", "medication", "medicine", "tablet", "dose", " mg", "omez", "aspirin",
    "paracetamol", "amlodipine", "omeprazole", "sindopa", "empa", "sita", "atova",
    # meal
    "meal", "breakfast", "lunch", "dinner", "snack", "ate", "curry", "rice", "noodles", "noddles",
    "fish", "chicken", "food", "kiribath", "hoppers", "thosa", "rotty", "pittu", "fed",
    # fluid
    "water", "juice", "tea", "coffee", "milk", "fluid", "drink", " ml", "glass", "cup",
    # hygiene
    "bath", "shower", "hygiene", "grooming", "toilet", "diaper", "motion", "dressing", "oral care",
    # mobility
    "walk", "wheelchair", "mobility", "transfer", "ambulation",
    # symptoms
    "pain", "fever", "cough", "bleeding", "fall", "fell", "confusion", "confused", "distress",
    "vomit", "nausea", "shortness of breath", "chest pain", "dizzy", "dizziness",
    "unresponsive", "wheezing", "rash", "swelling",
    # mood / checks / visits
    "mood", "anxious", "agitated", "calm", "cooperative", "nurse", "vitals", "blood pressure",
    " bp ", "temperature", "pulse", "spo2", "glucose", "family", "visitor", "visit",
    "patient", "refused", "partial", "intake",
)

_CAREGIVER_ACTION_RE = re.compile(
    r"\b(gave|give|given|helped|assisted|changed|fed|served|administered|offered|"
    r"checked|recorded|observed|noted|completed|provided)\b",
    re.I,
)

_PATIENT_CONTEXT_RE = re.compile(
    r"\b(she|he|they|her|him|patient|resident|p0?\d+)\b",
    re.I,
)

_PATIENT_STATE_RE = re.compile(
    r"\b(had|has|took|ate|drank|refused|sleep|slept|walked|bathed|soiled|voided)\b",
    re.I,
)

# Minimum share of letters for a usable transcript.
_MIN_LETTER_RATIO = 0.45
_MIN_WORD_COUNT = 2
_MAX_SYMBOL_RUN = 3


def sanitize_transcript(text: str) -> str:
    """Remove replacement glyphs, control characters, and stray symbol runs."""
    if not text:
        return ""

    cleaned = unicodedata.normalize("NFKC", text)
    cleaned = cleaned.replace(_REPLACEMENT_CHAR, " ")
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", cleaned)
    cleaned = re.sub(r"[^\w\s.,'\"/-]{1}", " ", cleaned)
    cleaned = re.sub(r"[^\w\s]{3,}", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _letter_ratio(text: str) -> float:
    if not text:
        return 0.0
    letters = sum(1 for ch in text if ch.isalpha())
    return letters / len(text.replace(" ", "")) if text.replace(" ", "") else 0.0


def _word_count(text: str) -> int:
    return len(re.findall(r"[a-zA-Z']+", text))


def has_adl_keywords(text: str) -> bool:
    lowered = text.lower()
    return any(keyword in lowered for keyword in _ADL_KEYWORDS)


def has_adl_care_relevance(text: str) -> bool:
    """True when the transcript plausibly describes a patient care activity."""
    if has_adl_keywords(text):
        return True

    lowered = text.lower()

    if _CAREGIVER_ACTION_RE.search(lowered):
        # Caregiver performed an action — e.g. "I gave noodles and chicken curry".
        if is_personal_narrative(lowered):
            return False
        return True

    if _PATIENT_CONTEXT_RE.search(lowered) and _PATIENT_STATE_RE.search(lowered):
        return True

    return False


def is_likely_hallucination(text: str) -> bool:
    """Detect empty, symbol-heavy, or ultra-short junk ASR output."""
    if not text or not text.strip():
        return True

    if _REPLACEMENT_CHAR in text:
        return True

    words = _word_count(text)
    if words < 1:
        return True

    if words < _MIN_WORD_COUNT and _letter_ratio(text) < 0.6:
        return True

    if _letter_ratio(text) < _MIN_LETTER_RATIO:
        return True

    if re.search(rf"[^\w\s]{{{_MAX_SYMBOL_RUN},}}", text):
        return True

    alpha = sum(1 for ch in text if ch.isalpha())
    if alpha < 3 and len(text) > 2:
        return True

    return False


def is_casual_non_clinical(text: str) -> bool:
    lowered = text.lower().strip()
    return any(pattern.search(lowered) for pattern in _CASUAL_SPEECH_PATTERNS)


def is_personal_narrative(text: str) -> bool:
    """Detect off-topic personal speech that is not a patient care observation."""
    lowered = text.lower().strip()
    if not any(pattern.search(lowered) for pattern in _PERSONAL_NARRATIVE_PATTERNS):
        return False

    # Allow if clearly about care despite overlapping words (rare).
    if has_adl_keywords(lowered) and _CAREGIVER_ACTION_RE.search(lowered):
        return False

    return True


def _reject_if_invalid(sanitized: str) -> None:
    if is_likely_hallucination(sanitized):
        raise ValueError(
            "Could not detect clear speech in this recording. "
            "Please speak directly about the care activity, avoid long silence, and try again."
        )

    if is_casual_non_clinical(sanitized) or is_personal_narrative(sanitized):
        raise ValueError(
            "This recording sounds like casual or personal speech, not a care observation. "
            "Please describe what you did for the patient (medication, meal, hygiene, mobility, symptoms, etc.)."
        )

    if not has_adl_care_relevance(sanitized):
        raise ValueError(
            "This recording does not describe a care activity for the patient. "
            "Please mention the specific ADL you performed or observed (e.g. medication given, meal served, diaper changed)."
        )


def validate_transcript(text: str) -> str:
    """Sanitize and reject low-quality or non-ADL transcripts (post-ASR)."""
    sanitized = sanitize_transcript(text)
    _reject_if_invalid(sanitized)
    return sanitized


def validate_polished_transcript(text: str) -> str:
    """Re-validate after BART / grammar — models can drift off-topic."""
    sanitized = sanitize_transcript(text)
    _reject_if_invalid(sanitized)
    return sanitized
