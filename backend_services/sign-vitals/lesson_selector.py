"""
lesson_selector.py
GLOSS component — next-lesson selection (Layer 7 of the thesis).

select_next_lesson(supabase_client, caregiver_profile_id) -> sign_id

The priority SCORING is the notebook's get_next_lesson()
(gloss_assets/gloss_reference_pipeline.py); the STORAGE is the app's
(active signs from gloss_signs, learner state from
gloss_caregiver_mastery). tests/test_learner_model.py asserts both
produce the same scores.

Every active sign gets a score; the LOWEST score is taught next:
  - never attempted                      -> 5
  - mastered                             -> 100
  - otherwise                            -> max(0, attempts - strong streak - 3)

Ties are broken randomly (shuffle, then a stable sort by score), not
alphabetically — exactly as in the notebook. The notebook returns the
5 best signs; the API's next_recommended_sign_id is a single sign, so
the first of that ranking is returned.

Independent of any HTTP endpoint — plain functions; score_lessons() and
rank_lessons() are pure (no I/O).
"""

import logging
import random

from mastery_engine import current_status

logger = logging.getLogger("sign_vitals")

NEVER_ATTEMPTED_SCORE = 5
MASTERED_SCORE = 100


def lesson_priority_score(mastery_row: dict | None) -> tuple[int, str]:
    """mastery_row: the caregiver's gloss_caregiver_mastery row for one
    sign, or None if there is none. Returns (score, reason) — lower
    score = taught sooner."""
    if mastery_row is None or mastery_row["attempts"] == 0:
        return NEVER_ATTEMPTED_SCORE, "never_attempted"
    status = current_status(mastery_row["mastery_status"])
    if status == "mastered":
        return MASTERED_SCORE, "mastered"
    score = max(0, mastery_row["attempts"] - mastery_row["consecutive_strong_streak"] - 3)
    return score, status


def score_lessons(sign_ids, mastery_by_sign: dict) -> list[tuple[str, int, str]]:
    """Returns [(sign_id, score, reason), ...] in sign_ids order."""
    return [(sign_id, *lesson_priority_score(mastery_by_sign.get(sign_id))) for sign_id in sign_ids]


def rank_lessons(sign_ids, mastery_by_sign: dict) -> list[tuple[str, int, str]]:
    """score_lessons(), best lesson first."""
    scored = score_lessons(sign_ids, mastery_by_sign)
    random.shuffle(scored)          # break ties randomly, not alphabetically
    scored.sort(key=lambda x: x[1])
    return scored


def select_next_lesson(supabase_client, caregiver_profile_id: str) -> str:
    """Returns a single sign_id — the next lesson to give this caregiver."""
    active_signs = supabase_client.table("gloss_signs").select("id").eq("is_active", True).execute()
    sign_ids = [row["id"] for row in active_signs.data or []]
    if not sign_ids:
        raise ValueError("No active signs found in gloss_signs — cannot select a lesson")

    mastery_rows = (
        supabase_client.table("gloss_caregiver_mastery")
        .select("sign_id, attempts, consecutive_strong_streak, mastery_status")
        .eq("caregiver_profile_id", caregiver_profile_id)
        .execute()
    )
    mastery_by_sign = {row["sign_id"]: row for row in mastery_rows.data or []}
    logger.info("[GLOSS][DB] mastery records loaded | rows=%d", len(mastery_by_sign))

    sign_id, score, reason = rank_lessons(sign_ids, mastery_by_sign)[0]
    logger.info("[GLOSS][RECOMMENDATION] priority | sign=%s | score=%d | reason=%s", sign_id, score, reason)
    return sign_id
