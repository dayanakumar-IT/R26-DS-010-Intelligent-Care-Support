"""Stage 4 — LanguageTool grammar correction with protected-vocabulary masking.

Change 2: medication and food names must survive grammar correction
unchanged. Rather than only skipping corrections that happen to overlap a
protected term (which can still let LanguageTool mangle text next to one),
every protected term is masked out to a placeholder token before
LanguageTool ever sees the sentence, then restored to its canonical
spelling afterwards. Any LanguageTool suggestion that still touches a
placeholder is also discarded as a second line of defence.
"""

from __future__ import annotations

import re
from functools import lru_cache

import language_tool_python
from language_tool_python.utils import correct as apply_corrections

from app import config

# Fallback terms used only if protected_vocab.txt is ever missing.
_BUILTIN_MEDICATIONS = frozenset({"Metformin", "Losartan", "Atova", "Aspirin", "Sindopa"})
_BUILTIN_FOODS = frozenset({"Kiribath", "String Hoppers", "Thosa", "Rotty", "Pittu"})

_FOOD_HEADER_RE = re.compile(r"food", re.IGNORECASE)
_MEDICATION_HEADER_RE = re.compile(r"medicat", re.IGNORECASE)

_PLACEHOLDER_PREFIX = "Zzzprotectedterm"


@lru_cache(maxsize=1)
def _load_sectioned_vocab() -> tuple[frozenset[str], frozenset[str]]:
    """Parse protected_vocab.txt into (medications, foods) using its
    '# ... medication ...' / '# ... food ...' comment-header sections, so
    the two lists can keep growing independently without touching code."""
    path = config.PROTECTED_VOCAB_PATH
    medications: set[str] = set(_BUILTIN_MEDICATIONS)
    foods: set[str] = set(_BUILTIN_FOODS)
    if not path.exists():
        return frozenset(medications), frozenset(foods)

    section = "medications"
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            if _FOOD_HEADER_RE.search(stripped):
                section = "foods"
            elif _MEDICATION_HEADER_RE.search(stripped):
                section = "medications"
            continue
        (medications if section == "medications" else foods).add(stripped)
    return frozenset(medications), frozenset(foods)


def get_protected_medications() -> frozenset[str]:
    """Medication names from protected_vocab.txt (plus small built-in fallback)."""
    return _load_sectioned_vocab()[0]


def get_protected_foods() -> frozenset[str]:
    """Food names from protected_vocab.txt (plus small built-in fallback)."""
    return _load_sectioned_vocab()[1]


@lru_cache(maxsize=1)
def _ordered_protected_terms() -> tuple[str, ...]:
    """All protected terms, longest first, so e.g. 'Sindopa Plus' / 'Sindopa CR'
    are masked before the shorter 'Sindopa' can match inside them."""
    medications, foods = _load_sectioned_vocab()
    return tuple(sorted(medications | foods, key=len, reverse=True))


@lru_cache(maxsize=1)
def _get_tool() -> language_tool_python.LanguageTool:
    return language_tool_python.LanguageTool("en-US")


def _mask_protected_terms(text: str) -> tuple[str, dict[str, str]]:
    """Replace every protected term with a LanguageTool-safe placeholder.

    Returns the masked text and a {placeholder: canonical_term} map used to
    restore the original (correctly-spelled) terms afterwards.
    """
    restore_map: dict[str, str] = {}
    masked = text
    for index, term in enumerate(_ordered_protected_terms()):
        pattern = re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
        if not pattern.search(masked):
            continue
        placeholder = f"{_PLACEHOLDER_PREFIX}{index}"
        restore_map[placeholder] = term
        masked = pattern.sub(placeholder, masked)
    return masked, restore_map


def _restore_protected_terms(text: str, restore_map: dict[str, str]) -> str:
    restored = text
    for placeholder, term in restore_map.items():
        restored = re.sub(re.escape(placeholder), term, restored, flags=re.IGNORECASE)
    return restored


def _match_touches_placeholder(match: language_tool_python.Match) -> bool:
    matched = (match.matched_text or "").lower()
    return _PLACEHOLDER_PREFIX.lower() in matched


def _skip_capitalized_name_corrections(match: language_tool_python.Match, text: str) -> bool:
    """Heuristic safety net for capitalised tokens LanguageTool doesn't
    recognise that aren't in the protected list either (e.g. patient codes)."""
    matched = match.matched_text or ""
    if not matched or not matched[0].isupper():
        return False
    start = match.offset
    if start == 0:
        return False
    before = text[:start]
    if before.rstrip().endswith((".", "!", "?")):
        return False
    common = {"I", "The", "She", "He", "They", "We", "Patient", "Monday", "Tuesday",
              "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
    return matched not in common


def correct_grammar(text: str) -> str:
    masked, restore_map = _mask_protected_terms(text)

    tool = _get_tool()
    matches = tool.check(masked)
    safe_matches = [
        m for m in matches
        if m.replacements
        and not _match_touches_placeholder(m)
        and not _skip_capitalized_name_corrections(m, masked)
    ]
    corrected = apply_corrections(masked, safe_matches).strip()
    return _restore_protected_terms(corrected, restore_map).strip()
