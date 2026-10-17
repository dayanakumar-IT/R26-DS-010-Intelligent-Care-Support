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
from datetime import datetime, timedelta, timezone

from execution_evaluator import LOW_CONFIDENCE_CUTOFF
from mastery_engine import MASTERY_STREAK_REQUIRED, current_status
from sign_config import is_recommendable

logger = logging.getLogger("sign_vitals")

# Practice days are counted in the caregiver's local day, not UTC — an
# attempt at 01:00 in Colombo is still "today" there. Sri Lanka has no
# daylight saving, so a fixed offset is exact.
LOCAL_TZ = timezone(timedelta(hours=5, minutes=30))


def _local_date(ts: str) -> str:
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(LOCAL_TZ).date().isoformat()


def _last_result(attempt: dict) -> str:
    """One attempt, as a learner-facing result key:
    strong / moderate / weak / different_sign / not_recognised /
    quiz_correct / quiz_wrong."""
    if attempt["attempt_type"] == "multiple_choice":
        return "quiz_correct" if attempt["recognized_sign_id"] == attempt["target_sign_id"] else "quiz_wrong"
    confidence = attempt["recognition_confidence"]
    if attempt["recognized_sign_id"] is None or (
        confidence is not None and float(confidence) < LOW_CONFIDENCE_CUTOFF
    ):
        return "not_recognised"
    if attempt["recognized_sign_id"] != attempt["target_sign_id"]:
        return "different_sign"
    return attempt["quality_tier"] or "not_recognised"

# mastery_status values produced by mastery_engine._compute_status.
# Rows written under the old rules may still hold the retired "weak" /
# "needs_revision"; they are reported as "improving" (see
# mastery_engine.current_status) — the stored rows are not changed.
_MASTERED = "mastered"
_IMPROVING = "improving"
# "learning" bucket = anything a caregiver has practised that is neither
# mastered nor improving (learning / new-with-attempts).
_NON_LEARNING = {_MASTERED, _IMPROVING}


def build_progress_report(supabase_client, caregiver_profile_id: str) -> dict:
    mastery_rows = (
        supabase_client.table("gloss_caregiver_mastery")
        .select(
            "sign_id, mastery_status, attempts, consecutive_strong_streak, best_score, "
            "last_score, last_practiced_at"
        )
        .eq("caregiver_profile_id", caregiver_profile_id)
        .execute()
        .data
    ) or []

    attempt_rows = (
        supabase_client.table("gloss_attempts")
        .select(
            "target_sign_id, recognized_sign_id, recognition_confidence, quality_tier, "
            "attempt_type, attempted_at"
        )
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
    for r in mastery_rows:
        r["mastery_status"] = current_status(r["mastery_status"])

    logger.info(
        "[GLOSS][DB] progress data loaded | mastery rows=%d | attempt rows=%d | signs rows=%d",
        len(mastery_rows), len(attempt_rows), len(signs),
    )

    status_counts = Counter(r["mastery_status"] for r in mastery_rows)

    # attempt_rows are newest first, so the first one seen per sign is its
    # latest result.
    last_result_by_sign: dict[str, str] = {}
    camera_attempts_by_sign: Counter = Counter()
    for a in attempt_rows:
        last_result_by_sign.setdefault(a["target_sign_id"], _last_result(a))
        if a["attempt_type"] == "webcam":
            camera_attempts_by_sign[a["target_sign_id"]] += 1
    camera_attempts = sum(camera_attempts_by_sign.values())

    mastery_summary = [
        {
            "sign_id": r["sign_id"],
            "display_name": display_name_by_id.get(r["sign_id"], r["sign_id"]),
            "mastery_status": r["mastery_status"],
            "attempts": r["attempts"],
            "camera_attempts": camera_attempts_by_sign[r["sign_id"]],
            "consecutive_strong_streak": r.get("consecutive_strong_streak") or 0,
            "last_result": last_result_by_sign.get(r["sign_id"]),
            # False for dictionary-only signs: never offered in "Continue practising".
            "recommendable": is_recommendable(r["sign_id"]),
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
            calendar[_local_date(ts)] += 1
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
        "camera_attempts": camera_attempts,
        "quiz_answers": len(attempt_rows) - camera_attempts,
        "strong_needed": MASTERY_STREAK_REQUIRED,
        "mastery_summary": mastery_summary,
        "practice_calendar": practice_calendar,
    }