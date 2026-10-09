"""
mastery_engine.py
GLOSS component — per-caregiver, per-sign learner model (Layer 6 of the
thesis).

The RULES are the notebook's update_learner_profile()
(gloss_assets/gloss_reference_pipeline.py); the STORAGE is the app's —
one gloss_caregiver_mastery row per (caregiver, sign) in Supabase, with
the same columns and API fields as before. tests/test_learner_model.py
feeds the same events to both and asserts they agree.

Rules, per attempt (apply_attempt() below):
  - attempts always goes up by one.
  - Recognised sign != target sign (a recognition mismatch): the
    mismatch count goes up, the strong streak resets to 0, and nothing
    is graded (no score is recorded).
  - Recognised sign == target sign: the strong streak goes up by one on
    a "strong" attempt and resets to 0 on anything else.
  - Status, recomputed fresh every time:
      streak >= MASTERY_STREAK_REQUIRED (3)  -> mastered
      attempts >= 2                          -> practicing
      otherwise                              -> learning
    ("not_started" = no attempts yet.)

Streaks are attempt-based only — elapsed time between attempts never
resets a streak.

Two things the notebook does not have, handled app-side:
  - Status names. gloss_caregiver_mastery.mastery_status only allows
    new / learning / weak / improving / mastered / needs_revision, so
    the notebook's names are stored as NOTEBOOK_TO_STORED_STATUS below
    (not_started -> new, practicing -> improving). "weak" and
    "needs_revision" are no longer produced.
  - "multiple_choice" attempts (the no-camera fallback). They are never
    a graded execution: a correct answer counts as an attempt and
    leaves the strong streak untouched; a wrong answer is treated like
    a recognition mismatch. Mastery therefore always means 3
    consecutive strong WEBCAM attempts.

The notebook also keeps the last HISTORY_CAP (10) events per sign inside
the profile. The mastery row has no history column — the app's
per-attempt log is the gloss_attempts table — so no capped history is
stored here.

This module is deliberately independent of any HTTP endpoint or video
processing — update_mastery() takes plain arguments and returns a plain
dict, and apply_attempt() is pure (no I/O) so it can be unit-tested.
"""

from datetime import datetime, timezone

MASTERY_TABLE = "gloss_caregiver_mastery"

MASTERY_STREAK_REQUIRED = 3
HISTORY_CAP = 10

NOTEBOOK_TO_STORED_STATUS = {
    "not_started": "new",
    "learning": "learning",
    "practicing": "improving",
    "mastered": "mastered",
}

# Statuses the old rules produced and the new rules never do. Rows
# written before the switch can still hold them until that sign is next
# attempted; wherever a stored status is READ it goes through
# current_status(), which treats them as "improving" (= practicing —
# both old statuses needed 3+ attempts). Stored rows are never rewritten
# just for this.
RETIRED_STATUSES = {"weak": "improving", "needs_revision": "improving"}


def current_status(stored_status: str) -> str:
    """A stored mastery_status, with the retired names mapped to the
    status the current rules use."""
    return RETIRED_STATUSES.get(stored_status, stored_status)

# Execution-score bands (see compute_execution_score()).
STRONG_FLOOR = 0.67
MODERATE_FLOOR = 0.33
# The frontend rounds the score to a whole percent. So that the
# DISPLAYED number can't contradict the tier either, a moderate attempt
# is capped just under 66.5% (shows at most 66%) and a weak one just
# under 32.5% (shows at most 32%).
MODERATE_CEILING = 0.6649
WEAK_CEILING = 0.3249


def compute_execution_score(distance: float, strong_max: float, moderate_max: float) -> float:
    """
    DISPLAY-ONLY mapping of the v3 quality tiers onto a 0-1 score (shown
    as a percentage). It is NOT an evaluated metric — the thesis
    evaluates the DTW distance and the strong/moderate/weak tier, never
    this number — and it must not be reported as one.

    Linear in distance within each tier, per sign, from that sign's v3
    thresholds (gloss_assets/class_thresholds.json):
      strong   (d <= strong_max):                100% -> 67% for d from 0 to strong_max
      moderate (strong_max < d <= moderate_max):  67% -> 33% for d from strong_max to moderate_max
      weak     (d > moderate_max):                33% ->  0% for d from moderate_max to 2 x moderate_max,
                                                  and 0% beyond that

    It never contradicts the tier: a strong attempt is always >= 67%, a
    weak one always < 33% (the tier boundaries are the same `<=`
    comparisons grading.grade_learner_attempt() uses).

    Webcam attempts only, and only when the recognised sign is the
    target sign.
    """
    if distance <= strong_max:
        return max(STRONG_FLOOR, 1.0 - (1.0 - STRONG_FLOOR) * (max(distance, 0.0) / strong_max))
    if distance <= moderate_max:
        fraction = (distance - strong_max) / (moderate_max - strong_max)
        score = STRONG_FLOOR - (STRONG_FLOOR - MODERATE_FLOOR) * fraction
        return max(MODERATE_FLOOR, min(MODERATE_CEILING, score))
    fraction = min(1.0, (distance - moderate_max) / moderate_max)
    return min(WEAK_CEILING, MODERATE_FLOOR * (1.0 - fraction))


def new_mastery_state() -> dict:
    """The state of a (caregiver, sign) pair with no attempts yet."""
    return {
        "attempts": 0,
        "consecutive_strong_streak": 0,
        "mastery_status": NOTEBOOK_TO_STORED_STATUS["not_started"],
        "recognition_mismatch_count": 0,
        "best_score": None,
        "last_score": None,
        "has_verified_strong_execution": False,
    }


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

    return new_mastery_state()


def _compute_status(attempts, streak) -> str:
    if attempts == 0:
        return NOTEBOOK_TO_STORED_STATUS["not_started"]
    if streak >= MASTERY_STREAK_REQUIRED:
        return NOTEBOOK_TO_STORED_STATUS["mastered"]
    if attempts >= 2:
        return NOTEBOOK_TO_STORED_STATUS["practicing"]
    return NOTEBOOK_TO_STORED_STATUS["learning"]


def apply_attempt(
    existing: dict,
    attempt_type: str,
    is_correct_sign: bool,
    quality_tier: str | None = None,
    execution_score: float | None = None,
) -> dict:
    """
    Pure rule step (no I/O): applies one attempt to `existing` (a
    gloss_caregiver_mastery row, or new_mastery_state()) and returns the
    updated counter/status fields. See the module docstring for the
    rules and update_mastery() for the arguments.
    """
    if attempt_type not in ("webcam", "multiple_choice"):
        raise ValueError(f"invalid attempt_type: {attempt_type!r}")

    attempts = existing["attempts"] + 1
    streak = existing["consecutive_strong_streak"]
    mismatch_count = existing["recognition_mismatch_count"]
    best_score = existing["best_score"]
    last_score = existing["last_score"]
    has_verified_strong_execution = existing["has_verified_strong_execution"]

    if not is_correct_sign:
        streak = 0
        mismatch_count += 1
    elif attempt_type == "webcam":
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
        if execution_score is not None:
            last_score = execution_score
            best_score = max(best_score or 0, execution_score)
    # else: a correct multiple_choice answer — counted as an attempt,
    # never graded, strong streak untouched.

    return {
        "attempts": attempts,
        "consecutive_strong_streak": streak,
        "mastery_status": _compute_status(attempts, streak),
        "recognition_mismatch_count": mismatch_count,
        "best_score": best_score,
        "last_score": last_score,
        "has_verified_strong_execution": has_verified_strong_execution,
    }


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
    none exists), applies one attempt's worth of the rules
    (apply_attempt()), upserts the result (including
    last_practiced_at = now()), and returns the updated row.

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
    existing = _fetch_existing_row(supabase_client, caregiver_profile_id, sign_id)
    updated = apply_attempt(existing, attempt_type, is_correct_sign, quality_tier, execution_score)

    row = {
        "caregiver_profile_id": caregiver_profile_id,
        "sign_id": sign_id,
        **updated,
        "last_practiced_at": datetime.now(timezone.utc).isoformat(),
    }

    result = (
        supabase_client.table(MASTERY_TABLE)
        .upsert(row, on_conflict="caregiver_profile_id,sign_id")
        .execute()
    )
    return result.data[0]
