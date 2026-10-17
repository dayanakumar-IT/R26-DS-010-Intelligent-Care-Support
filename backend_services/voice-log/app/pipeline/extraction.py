"""Stage 5 — T5 structured ADL extraction + alert flag."""

from __future__ import annotations

import json
import logging
import re

from app import config
from app.schemas import AdlExtraction

logger = logging.getLogger(__name__)

# Genuine clinical concern keywords — routine fluids/meals must not match
# these. Shared across the pipeline (guess_category_keywords here, the
# negation-aware checks below, and adl_rules.py's alert rule) so there is
# one list to extend, not several.
SYMPTOM_ALERT_KEYWORDS = (
    "pain",
    "fever",
    "cough",
    "bleeding",
    "fall",
    "fell",
    "confusion",
    "confused",
    "distress",
    "vomit",
    "nausea",
    "shortness of breath",
    "chest pain",
    "dizzy",
    "dizziness",
    "unresponsive",
    "wheezing",
    "rash",
    "swelling",
    "headache",
    "breathing difficulty",
    "bed sore",
    "fainting",
    "loss of consciousness",
    "inflammation",
    "skin allergy",
    "fatigue",
    "loose motion",
    "frequent urination",
    "difficulty passing urine",
    "sudden crying",
    "speaking unrelated words",
)


class AdlExtractor:
    def __init__(self) -> None:
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        model_path = config.resolve_model_dir(config.T5_MODEL_PATH)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tokenizer = AutoTokenizer.from_pretrained(str(model_path))
        self.model = AutoModelForSeq2SeqLM.from_pretrained(str(model_path))
        self.model.to(self.device)
        self.model.eval()

    def extract(self, text: str) -> AdlExtraction:
        import torch

        prompt = f"extract adl: {text}"
        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = self.model.generate(**inputs, max_new_tokens=256)
        raw = self.tokenizer.decode(outputs[0], skip_special_tokens=True).strip()
        return _parse_extraction(raw, fallback_text=text)


def _parse_extraction(raw: str, *, fallback_text: str) -> AdlExtraction:
    payload = _try_json(raw)
    if payload is None:
        payload = _parse_key_value(raw)
    else:
        payload = dict(payload)
    payload = _normalize_payload(payload)
    if not payload.get("category"):
        payload["category"] = guess_category_keywords(fallback_text)

    category = str(payload.get("category", "nurse_check")).lower().replace(" ", "_")
    if category not in config.ADL_CATEGORIES:
        category = guess_category_keywords(fallback_text)

    category = _reconcile_category(fallback_text, category)
    payload["category"] = category
    payload = _enrich_from_text(payload, fallback_text)

    if "alert_required" in payload:
        # Trust model alert only when category is still symptom after reconciliation.
        payload["alert_required"] = bool(payload["alert_required"]) and payload["category"] == "symptom"
    if not payload.get("alert_required"):
        payload["alert_required"] = _infer_alert(payload, fallback_text)

    return AdlExtraction(**{k: payload.get(k) for k in AdlExtraction.model_fields})


# --------------------------------------------------------------------------
# Negation-aware symptom detection, shared with adl_rules.py's alert rule so
# a negated symptom (e.g. "no fever", "denies chest pain") is treated the
# same way everywhere: never forces the symptom category, never alerts.
# --------------------------------------------------------------------------

_NEGATION_CUES = (
    "did not have",
    "does not have",
    "denies",
    "denied",
    "without",
    "free of",
    "no",
    "not",
)
_NEGATION_CUE_PATTERN = "|".join(
    re.escape(cue) for cue in sorted(_NEGATION_CUES, key=len, reverse=True)
)
# Matches when a negation cue (optionally followed by "any") ends exactly at
# the symptom word that follows it — checked against the text immediately
# preceding a symptom mention, not the whole sentence.
_NEGATION_WINDOW_RE = re.compile(
    rf"\b(?:{_NEGATION_CUE_PATTERN})\s+(?:any\s+)?$", re.IGNORECASE
)
_SYMPTOM_WORD_RE = re.compile(
    "|".join(re.escape(w) for w in sorted(SYMPTOM_ALERT_KEYWORDS, key=len, reverse=True)),
    re.IGNORECASE,
)
_NEGATION_WINDOW_CHARS = 30


def _find_symptom_mentions(text: str) -> list[tuple[int, int, str]]:
    return [(m.start(), m.end(), m.group(0)) for m in _SYMPTOM_WORD_RE.finditer(text)]


def _is_negated_mention(text: str, start: int) -> bool:
    window = text[max(0, start - _NEGATION_WINDOW_CHARS):start]
    return bool(_NEGATION_WINDOW_RE.search(window))


def has_non_negated_symptom_word(text: str) -> tuple[bool, str | None]:
    """True (with the matched word) if `text` contains a symptom word from
    SYMPTOM_ALERT_KEYWORDS that is NOT preceded by a negation cue such as
    "no", "not", "denies", "denied", "without", "did not have",
    "does not have" or "free of". Returns (False, None) when every symptom
    mention found is negated, or there is none at all."""
    for start, _end, word in _find_symptom_mentions(text):
        if not _is_negated_mention(text, start):
            return True, word
    return False, None


def _mask_negated_symptom_mentions(text: str) -> str:
    """Blank out negated symptom spans (same length, to keep other word
    boundaries intact) so a keyword-guess fallback can't re-derive
    'symptom' from a word that was just ruled negated."""
    masked = text
    for start, end, _word in _find_symptom_mentions(text):
        if _is_negated_mention(text, start):
            masked = masked[:start] + (" " * (end - start)) + masked[end:]
    return masked


_NON_SYMPTOM_CATEGORIES = {
    "fluid_intake",
    "meal",
    "medication",
    "hygiene",
    "mobility",
    "mood",
    "nurse_check",
    "family_visit",
}


def _reconcile_category(text: str, model_category: str) -> str:
    """Decide whether to keep a 'symptom' category or let the keyword guess
    override it. A missed alert is the most dangerous failure mode here, so:

    - If the sentence contains a real (non-negated) symptom word, 'symptom'
      is always kept — the keyword guess (e.g. matching "walk" -> mobility)
      never overrides a genuine symptom just because other ADL words are
      also present in the same sentence.
    - If there is no non-negated symptom word (none at all, or the only
      mention is negated, e.g. "she had no fever"), the original protection
      against T5 mislabelling a non-symptom sentence as 'symptom' still
      applies: the keyword guess may override, computed with any negated
      symptom span masked out first so a negated word can't resurrect
      'symptom' on its own.
    """
    if model_category != "symptom":
        return model_category

    has_symptom, symptom_word = has_non_negated_symptom_word(text)
    if has_symptom:
        logger.info(
            "extraction: keeping category 'symptom' (non-negated symptom word %r) for: %s",
            symptom_word, text[:160],
        )
        return "symptom"

    rule_category = guess_category_keywords(_mask_negated_symptom_mentions(text))
    if rule_category in _NON_SYMPTOM_CATEGORIES:
        logger.info(
            "extraction: overriding category 'symptom' -> %r "
            "(no non-negated symptom word found) for: %s",
            rule_category, text[:160],
        )
        return rule_category
    return model_category


def _try_json(raw: str) -> dict | None:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


def _parse_key_value(raw: str) -> dict:
    result: dict = {}
    for part in raw.split(";"):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        result[key.strip().lower().replace(" ", "_")] = value.strip()
    return result


_FIELD_ALIASES: dict[str, str] = {
    "medication": "medication_name",
    "med": "medication_name",
    "drug": "medication_name",
    "medicine": "medication_name",
    "food": "food_item",
    "fluid": "fluid_type",
    "amount": "fluid_amount",
    "hygiene": "hygiene_activity",
    "mobility": "mobility_type",
    "symptom": "symptom_type",
    "vital": "vital_type",
    "reading": "vital_reading",
    "visitor": "visitor_type",
    "reason": "visit_reason",
    "intake": "intake_level",
    "meal": "meal_type",
    "time": "time_of_day",
}


def _normalize_payload(payload: dict) -> dict:
    normalized: dict = {}
    for key, value in payload.items():
        if value is None:
            continue
        text = str(value).strip()
        if not text or text.lower() in {"none", "null", "n/a", "na", "unknown"}:
            continue
        k = key.strip().lower().replace(" ", "_").replace("-", "_")
        k = _FIELD_ALIASES.get(k, k)
        if k == "category":
            normalized[k] = text.lower().replace(" ", "_")
        elif k == "alert_required":
            normalized[k] = text.lower() in {"true", "1", "yes"}
        elif k == "intake_level":
            level = text.lower()
            if level in {"full", "partial", "refused"}:
                normalized[k] = level
        else:
            normalized[k] = text
    return normalized


def guess_category_keywords(text: str) -> str:
    lowered = text.lower()

    if _looks_like_fluid_intake(lowered):
        return "fluid_intake"

    rules = [
        ("medication", ("metformin", "losartan", "medication", "medicine", "tablet", "dose", " mg", "omez", "aspirin")),
        ("meal", ("meal", "breakfast", "lunch", "dinner", "ate", "curry", "rice", "kiribath", "hoppers", "thosa", "rotty", "pittu")),
        ("hygiene", ("bath", "shower", "hygiene", "grooming", "toilet")),
        ("mobility", ("walk", "wheelchair", "mobility", "transfer")),
        ("symptom", SYMPTOM_ALERT_KEYWORDS),
        ("mood", ("mood", "anxious", "happy", "agitated", "calm")),
        ("nurse_check", ("nurse", "vitals", "check", "blood pressure", " bp ")),
        ("family_visit", ("family", "visitor", "visit")),
    ]
    for category, keywords in rules:
        if any(word in lowered for word in keywords):
            return category
    return "nurse_check"


def _looks_like_fluid_intake(lowered: str) -> bool:
    fluid_words = ("water", "juice", "tea", "coffee", "milk", "fluid", "drink")
    intake_verbs = ("gave", "give", "given", "drank", "drink", "offered", "served")
    has_fluid = any(w in lowered for w in fluid_words)
    has_amount = bool(re.search(r"\d+\s*(ml|millilit|millimet|glass|cup)", lowered))
    has_intake_verb = any(v in lowered for v in intake_verbs)
    return has_fluid and (has_amount or has_intake_verb)


def _enrich_from_text(payload: dict, text: str) -> dict:
    lowered = text.lower()
    category = payload.get("category")

    if category == "fluid_intake":
        amount = re.search(r"(\d+)\s*(?:ml|millilit(?:re|er)s?|millimet(?:re|er)s?)", lowered)
        if amount and not payload.get("fluid_amount"):
            payload["fluid_amount"] = f"{amount.group(1)} ml"
        if not payload.get("fluid_type"):
            for fluid in ("water", "juice", "tea", "coffee", "milk"):
                if fluid in lowered:
                    payload["fluid_type"] = fluid
                    break
        _fill_time_of_day(payload, lowered)

    elif category == "meal":
        if not payload.get("meal_type"):
            for meal in ("breakfast", "lunch", "dinner", "snack"):
                if meal in lowered:
                    payload["meal_type"] = meal
                    break
        if not payload.get("food_item"):
            had = re.search(
                r"(?:had|ate|served|gave)\s+(.+?)(?:\s+for\s+(?:breakfast|lunch|dinner)|[.,]|$)",
                text,
                re.IGNORECASE,
            )
            if had:
                payload["food_item"] = had.group(1).strip()
        if not payload.get("intake_level"):
            for level in ("full", "partial", "refused"):
                if level in lowered:
                    payload["intake_level"] = level
                    break

    elif category == "medication":
        if not payload.get("medication_name"):
            for med in (
                "metformin", "losartan", "aspirin", "paracetamol",
                "amlodipine", "omeprazole", "atova", "sindopa", "omez", "empa", "sita",
            ):
                if med in lowered:
                    payload["medication_name"] = med.capitalize()
                    break
        if not payload.get("dosage"):
            dose = re.search(r"(\d+\s*(?:mg|mcg|g|ml|tablet[s]?))", lowered)
            if dose:
                payload["dosage"] = dose.group(1)
        _fill_time_of_day(payload, lowered)

    elif category == "hygiene" and not payload.get("hygiene_activity"):
        for act in ("bath", "shower", "grooming", "toilet", "oral care", "dressing"):
            if act in lowered:
                payload["hygiene_activity"] = act
                break

    elif category == "mobility":
        if not payload.get("mobility_type"):
            for kind in ("walk", "wheelchair", "transfer", "ambulation"):
                if kind in lowered:
                    payload["mobility_type"] = kind
                    break
        if not payload.get("destination"):
            dest = re.search(r"(?:to|into)\s+(?:the\s+)?([a-z\s]+?)(?:\.|,|$)", lowered)
            if dest:
                payload["destination"] = dest.group(1).strip()

    elif category == "symptom" and not payload.get("symptom_type"):
        for symptom in SYMPTOM_ALERT_KEYWORDS:
            if symptom in lowered:
                payload["symptom_type"] = symptom
                break

    elif category == "nurse_check":
        if not payload.get("vital_type"):
            for vital in ("blood pressure", "bp", "temperature", "pulse", "spo2", "glucose"):
                if vital in lowered:
                    payload["vital_type"] = "blood pressure" if vital == "bp" else vital
                    break
        if not payload.get("vital_reading"):
            reading = re.search(r"(\d{2,3}(?:/\d{2,3})?)", text)
            if reading:
                payload["vital_reading"] = reading.group(1)

    elif category == "family_visit":
        if not payload.get("visitor_type"):
            for visitor in ("family", "relative", "friend", "spouse", "daughter", "son"):
                if visitor in lowered:
                    payload["visitor_type"] = visitor
                    break

    return payload


def _fill_time_of_day(payload: dict, lowered: str) -> None:
    if payload.get("time_of_day"):
        return
    for tod in ("mid-morning", "morning", "afternoon", "evening", "lunch", "breakfast", "dinner"):
        if tod in lowered:
            payload["time_of_day"] = tod
            break


def _infer_alert(payload: dict, text: str) -> bool:
    if payload.get("intake_level") in {"partial", "refused"}:
        return True
    vital_status = str(payload.get("vital_status", "")).lower()
    if vital_status in {"high", "elevated", "abnormal", "concerning"}:
        return True

    category = payload.get("category")
    if category != "symptom":
        return False

    if payload.get("symptom_type"):
        return True

    lowered = text.lower()
    return any(keyword in lowered for keyword in SYMPTOM_ALERT_KEYWORDS)
