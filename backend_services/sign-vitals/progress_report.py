"""
progress_report.py
GLOSS component — caregiver learning-progress report (read-only).

Aggregates the authenticated caregiver's own gloss_caregiver_mastery +
gloss_attempts + gloss_signs into the shape GET /gloss/progress
returns. Pure read model: no writes, no ML, never touches recognition,
DTW, preprocessing, mastery-update, or lesson selection. Independent of
FastAPI — takes a supabase client + caregiver_profile_id and returns a
plain dict, so it is unit-testable.

Only ever reads rows belonging to the given caregiver_profile_id.
"""

import logging
from collections import Counter

logger = logging.getLogger("sign_vitals")

# mastery_status values produced by mastery_engine._compute_status.
_MASTERED = "mastered"
_IMPROVING = "improving"
# "learning" bucket = anything a caregiver has practised that is neither
# mastered nor improving (learning / weak / needs_revision / new-with-attempts).
_NON_LEARNING = {_MASTERED, _IMPROVING}


def build_progress_report(supabase_client, caregiver_profile_id: str) -> dict:
    mastery_rows = (
        supabase_client.table("gloss_caregiver_mastery")
        .select(
            "sign_id, mastery_status, attempts, best_score, last_score, last_practiced_at"
        )
        .eq("caregiver_profile_id", caregiver_profile_id)
        .execute()
        .data
    ) or []

    attempt_rows = (
        supabase_client.table("gloss_attempts")
        .select("target_sign_id, attempted_at")
        .eq("caregiver_profile_id", caregiver_profile_id)
        .order("attempted_at", desc=True)
        .execute()
        .data
    ) or []

    signs = (
        supabase_client.table("gloss_signs")
        .select("id, display_name")
        .execute()
        .data
    ) or []
    display_name_by_id = {s["id"]: s["display_name"] for s in signs}

    logger.info(
        "[GLOSS][DB] progress data loaded | mastery rows=%d | attempt rows=%d | signs rows=%d",
        len(mastery_rows), len(attempt_rows), len(signs),
    )

    status_counts = Counter(r["mastery_status"] for r in mastery_rows)

    mastery_summary = [
        {
            "sign_id": r["sign_id"],
            "display_name": display_name_by_id.get(r["sign_id"], r["sign_id"]),
            "mastery_status": r["mastery_status"],
            "attempts": r["attempts"],
            "best_score": r["best_score"],
            "last_score": r["last_score"],
            "last_practiced_at": r["last_practiced_at"],
        }
        for r in mastery_rows
    ]
    # Newest activity first; rows never practised sort last.
    mastery_summary.sort(
        key=lambda r: (r["last_practiced_at"] is not None, r["last_practiced_at"] or ""),
        reverse=True,
    )

    calendar = Counter()
    for a in attempt_rows:
        ts = a.get("attempted_at")
        if ts:
            calendar[ts[:10]] += 1
    practice_calendar = [
        {"date": d, "attempt_count": c} for d, c in sorted(calendar.items())
    ]

    learning_count = sum(
        1 for r in mastery_rows if r["mastery_status"] not in _NON_LEARNING
    )

    logger.info(
        "[GLOSS][PROGRESS] summary prepared | practised=%d | mastered=%d | improving=%d | total_attempts=%d",
        len(mastery_rows), status_counts[_MASTERED], status_counts[_IMPROVING], len(attempt_rows),
    )

    return {
        "signs_practiced": len(mastery_rows),
        "mastered_count": status_counts[_MASTERED],
        "improving_count": status_counts[_IMPROVING],
        "learning_count": learning_count,
        "total_attempts": len(attempt_rows),
        "mastery_summary": mastery_summary,
        "practice_calendar": practice_calendar,
    }