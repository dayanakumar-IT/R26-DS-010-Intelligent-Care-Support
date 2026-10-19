"""
pdedu_mastery_engine.py
Parkinson's-Disease EDUcation (pdedu_) — mastery-update engine.

This is a caregiver EDUCATION feature (multiple-choice quiz with
adaptive question selection) — NOT a diagnostic tool and NOT an
AI/ML model. Kept completely separate from GLOSS's gloss_ tables and
mastery_engine.py.

update_mastery() ONLY updates pdedu_caregiver_mastery. It does NOT
insert into pdedu_responses — that's the caller's responsibility (see
main.py's POST /pdedu/responses), matching the same
"update_mastery-is-a-pure-counter-update" pattern GLOSS's
mastery_engine.py already uses.

Independent of any HTTP endpoint — plain function, callable directly.
"""

from datetime import datetime, timezone

MASTERY_TABLE = "pdedu_caregiver_mastery"

STARTING_MASTERY_SCORE = 50
CORRECT_DELTA = 10
INCORRECT_DELTA = -8
MIN_MASTERY_SCORE = 0
MAX_MASTERY_SCORE = 100


def update_mastery(supabase_client, caregiver_profile_id: str, symptom_id: str, is_correct: bool) -> dict:
    """
    Fetches the existing pdedu_caregiver_mastery row for
    (caregiver_profile_id, symptom_id) (or treats it as fresh —
    mastery_score=50, correct_count=0, incorrect_count=0 — if none
    exists), applies one answer's worth of the mastery-score update,
    upserts the result (including last_answered_at = now()), and
    returns the updated row.

    correct:   mastery_score += 10
    incorrect: mastery_score -= 8
    Clamped to [0, 100].

    Returns: the upserted pdedu_caregiver_mastery row as a dict.
    """
    existing = (
        supabase_client.table(MASTERY_TABLE)
        .select("*")
        .eq("caregiver_profile_id", caregiver_profile_id)
        .eq("symptom_id", symptom_id)
        .limit(1)
        .execute()
    )

    if existing.data:
        row = existing.data[0]
        mastery_score = row["mastery_score"]
        correct_count = row["correct_count"]
        incorrect_count = row["incorrect_count"]
    else:
        mastery_score = STARTING_MASTERY_SCORE
        correct_count = 0
        incorrect_count = 0

    if is_correct:
        mastery_score += CORRECT_DELTA
        correct_count += 1
    else:
        mastery_score += INCORRECT_DELTA
        incorrect_count += 1

    mastery_score = max(MIN_MASTERY_SCORE, min(MAX_MASTERY_SCORE, mastery_score))

    row = {
        "caregiver_profile_id": caregiver_profile_id,
        "symptom_id": symptom_id,
        "mastery_score": mastery_score,
        "correct_count": correct_count,
        "incorrect_count": incorrect_count,
        "last_answered_at": datetime.now(timezone.utc).isoformat(),
    }

    result = (
        supabase_client.table(MASTERY_TABLE)
        .upsert(row, on_conflict="caregiver_profile_id,symptom_id")
        .execute()
    )
    return result.data[0]
