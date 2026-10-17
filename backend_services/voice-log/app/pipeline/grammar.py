"""Stage 4 — LanguageTool grammar correction with protected vocabulary."""

from __future__ import annotations

import re
from functools import lru_cache

import language_tool_python
from language_tool_python.utils import correct as apply_corrections

from app import config

# Built-in protected terms (also loaded from protected_vocab.txt).
_BUILTIN_PROTECTED = frozenset({
    "Metformin", "Losartan", "Atova", "Aspirin", "Sindopa", "Glyco", "Omez", "Empa", "Sita",
    "Kiribath", "string hoppers", "thosa", "rotty", "pittu", "kadala", "kawpi",
})


@lru_cache(maxsize=1)
def _load_protected_terms() -> frozenset[str]:
    path = config.PROTECTED_VOCAB_PATH
    terms = set(_BUILTIN_PROTECTED)
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                terms.add(line)
    return frozenset(terms)


@lru_cache(maxsize=1)
def _get_tool() -> language_tool_python.LanguageTool:
    return language_tool_python.LanguageTool("en-US")


def _match_overlaps_protected(match: language_tool_python.Match, terms: frozenset[str]) -> bool:
    matched = (match.matched_text or "").lower()
    if not matched:
        return False
    for term in terms:
        term_lower = term.lower()
        if term_lower in matched or matched in term_lower:
            return True
    return False


def _skip_capitalized_name_corrections(match: language_tool_python.Match, text: str) -> bool:
    """Heuristic: mid-sentence capitalized tokens are often med/food names."""
    matched = match.matched_text or ""
    if not matched or not matched[0].isupper():
        return False
    start = match.offset
    if start == 0:
        return False
    before = text[:start]
    # Not start of sentence
    if before.rstrip().endswith((".", "!", "?")):
        return False
    common = {"I", "The", "She", "He", "They", "We", "Patient", "Monday", "Tuesday",
              "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
    return matched not in common


def correct_grammar(text: str) -> str:
    terms = _load_protected_terms()
    tool = _get_tool()
    matches = tool.check(text)
    safe_matches = [
        m for m in matches
        if m.replacements
        and not _match_overlaps_protected(m, terms)
        and not _skip_capitalized_name_corrections(m, text)
    ]
    return apply_corrections(text, safe_matches).strip()
