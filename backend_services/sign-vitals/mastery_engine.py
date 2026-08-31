"""
mastery_engine.py
GLOSS component — per-caregiver, per-sign mastery-update engine.

Implements the confirmed Phase 5 rules exactly as specified (not
proposed/derived here — these numbers and the priority order below
were decided by the project owner):

Streaks are attempt-based only — elapsed time between attempts never
resets a streak.

Two attempt types:
  - "webcam": goes through recognition + DTW execution evaluation,
    produces a quality_tier ("strong"/"moderate"/"weak") and an
    execution_score.
  - "multiple_choice": a fallback when the camera isn't available —
    just correct/incorrect, no execution_score. Counts toward
    attempts/streak like webcam does, but can never by itself flip
    has_verified_strong_execution, so MC alone can never reach
    "mastered" (see status priority order below).

has_verified_strong_execution is sticky: once true (set only by a
webcam attempt at "strong" tier), it stays true forever for that
(caregiver, sign) pair.

Status is recomputed FRESH from the current counters on every call
(never incrementally transitioned), in this exact priority order:
  1. attempts == 0                                    -> "new"
  2. attempts >= 3 AND mismatch_count/attempts > 0.5   -> "needs_revision"
  3. streak >= 5 AND has_verified_strong_execution     -> "mastered"
  4. streak >= 2                                       -> "improving"
  5. attempts >= 3 AND streak == 0                     -> "weak"
  6. else                                              -> "learning"

This module is deliberately independent of any HTTP endpoint or video
processing — update_mastery() takes plain arguments and returns a
plain dict, so it can be unit-tested with synthetic inputs and reused
by Phase 8's combined attempt-submission endpoint.
"""

from datetime import datetime, timezone

MASTERY_TABLE = "gloss_caregiver_mastery"


def compute_execution_score(distance: float, moderate_max: float) -> float:
    """
    execution_score = max(0, 1 - distance / moderate_max), clipped to [0, 1].
    Webcam attempts only — moderate_max comes from class_thresholds.json
    for the target sign.
    """
    score = 1.0 - (distance / moderate_max)
    return max(0.0, min(1.0, score))


def _fetch_existing_row(supabase_client, caregiver_profile_id, sign_id) -> dict:
    result = (
        supabase_client.table(MASTERY_TABLE)
        .select("*")
        .eq("caregiver_profile_id", caregiver_profile_id)
        .eq("sign_id", sign_id)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]

    return {
        "attempts": 0,
        "consecutive_strong_streak": 0,
        "mastery_status": "new",
        "recognition_mismatch_count": 0,
        "best_score": None,
        "last_score": None,
        "has_verified_strong_execution": False,
    }


def _compute_status(attempts, streak, mismatch_count, has_verified_strong_execution) -> str:
    if attempts == 0:
        return "new"
    if attempts >= 3 and (mismatch_count / attempts) > 0.5:
        return "needs_revision"
    if streak >= 5 and has_verified_strong_execution:
        return "mastered"
    if streak >= 2:
        return "improving"
    if attempts >= 3 and streak == 0:
        return "weak"
    return "learning"


def update_mastery(
    supabase_client,
    caregiver_profile_id: str,
    sign_id: str,
    attempt_type: str,
    is_correct_sign: bool,
    quality_tier: str | None = None,
    execution_score: float | None = None,
) -> dict:
    """
    Fetches the existing gloss_caregiver_mastery row for
    (caregiver_profile_id, sign_id) (or treats it as fresh/all-zero if
    none exists), applies one attempt's worth of the confirmed update
    logic, recomputes mastery_status fresh, upserts the result
    (including last_practiced_at = now()), and returns the updated row.

    attempt_type: "webcam" or "multiple_choice".
    is_correct_sign: whether the recognized/selected sign matched the
      target sign.
    quality_tier: required ("strong"/"moderate"/"weak") when
      attempt_type == "webcam" and is_correct_sign is True. Ignored
      otherwise.
    execution_score: the webcam attempt's execution_score (see
      compute_execution_score()). Ignored for multiple_choice.

    Returns: the upserted gloss_caregiver_mastery row as a dict.
    """
    if attempt_type not in ("webcam", "multiple_choice"):
        raise ValueError(f"invalid attempt_type: {attempt_type!r}")

    existing = _fetch_existing_row(supabase_client, caregiver_profile_id, sign_id)

    attempts = existing["attempts"] + 1
    streak = existing["consecutive_strong_streak"]
    mismatch_count = existing["recognition_mismatch_count"]
    best_score = existing["best_score"]
    last_score = existing["last_score"]
    has_verified_strong_execution = existing["has_verified_strong_execution"]

    if attempt_type == "webcam":
        if is_correct_sign:
            if quality_tier not in ("strong", "moderate", "weak"):
                raise ValueError(
                    f"webcam attempt with is_correct_sign=True requires a valid "
                    f"quality_tier, got {quality_tier!r}"
                )
            if quality_tier == "strong":
                streak += 1
                has_verified_strong_execution = True
            else:  # "moderate" or "weak"
                streak = 0
            last_score = execution_score
            best_score = max(best_score or 0, execution_score)
        else:
            streak = 0
            mismatch_count += 1
    else:  # multiple_choice
        if is_correct_sign:
            streak += 1
        else:
            streak = 0
            mismatch_count += 1

    status = _compute_status(attempts, streak, mismatch_count, has_verified_strong_execution)

    row = {
        "caregiver_profile_id": caregiver_profile_id,
        "sign_id": sign_id,
        "attempts": attempts,
        "consecutive_strong_streak": streak,
        "mastery_status": status,
        "recognition_mismatch_count": mismatch_count,
        "best_score": best_score,
        "last_score": last_score,
        "has_verified_strong_execution": has_verified_strong_execution,
        "last_practiced_at": datetime.now(timezone.utc).isoformat(),
    }

    result = (
        supabase_client.table(MASTERY_TABLE)
        .upsert(row, on_conflict="caregiver_profile_id,sign_id")
        .execute()
    )
    return result.data[0]
