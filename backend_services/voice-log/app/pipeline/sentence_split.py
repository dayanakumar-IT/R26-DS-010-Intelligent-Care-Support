"""Sentence segmentation for multi-observation recordings (Change 1b).

A long recording can describe several ADL observations in one breath.
split_sentences() turns the ASR transcript into one chunk of text per
observation so the rest of the pipeline (disfluency -> grammar -> T5
extraction -> hybrid rules) can run on each independently.
"""

from __future__ import annotations

import re

# Split after sentence-ending punctuation, only when followed by a
# capitalised word — avoids splitting on abbreviations/decimals.
_SENTENCE_BOUNDARY_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z])")

_WORD_RE = re.compile(r"[A-Za-z']+")
_MIN_SENTENCE_WORDS = 2


def _word_count(text: str) -> int:
    return len(_WORD_RE.findall(text))


def split_sentences(text: str) -> list[str]:
    """Split into sentences, dropping fragments shorter than 2 words.

    When the text has no sentence-ending punctuation at all (e.g. a short,
    informally-spoken single observation with no full stop), the regex
    produces no split and the whole text is returned as one sentence — this
    is what keeps the single-observation path identical to the pipeline's
    behaviour before this feature existed.
    """
    stripped = text.strip()
    if not stripped:
        return []

    pieces = [p.strip() for p in _SENTENCE_BOUNDARY_RE.split(stripped) if p.strip()]
    if not pieces:
        return []

    kept = [p for p in pieces if _word_count(p) >= _MIN_SENTENCE_WORDS]
    if kept:
        return kept

    # Every individual fragment was too short to stand alone (e.g. the
    # splitter over-segmented) — fall back to the original text as a single
    # observation rather than discarding the recording entirely.
    return [stripped]
