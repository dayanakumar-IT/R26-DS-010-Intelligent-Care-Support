"""
tests/test_learner_model.py
GLOSS component — the app's learner model and lesson scoring follow the
notebook's rules.

Feeds the SAME sequence of (target, predicted, tier) events to:
  - the notebook: update_learner_profile() / get_next_lesson() from
    gloss_assets/gloss_reference_pipeline.py (imported, not copied);
  - the app: mastery_engine.apply_attempt() / lesson_selector.
    score_lessons() — the pure rule functions update_mastery() and
    select_next_lesson() wrap around Supabase.

After every event it asserts the same attempts, mismatch count, strong
streak and mastery status (through the stored-name mapping), and the
same lesson priority SCORE for every sign. Scores are compared, not the
order: ties are broken randomly in both.

Also covers the Supabase-facing wrappers (update_mastery(),
select_next_lesson(), build_progress_report()) against an in-memory
stand-in (tests/fake_supabase.py), including rows that still hold the
retired statuses "weak" / "needs_revision" from the old rules.

Nothing here touches the live Supabase: no database, no model, no network.

Run with .venv's python, from anywhere:
    python tests/test_learner_model.py
(also collectable by pytest).
"""

import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from recogniser import ASSETS_DIR  # noqa: E402

if ASSETS_DIR not in sys.path:
    sys.path.insert(0, ASSETS_DIR)

import gloss_reference_pipeline as notebook  # noqa: E402
from fake_supabase import FakeSupabase  # noqa: E402
from lesson_selector import rank_lessons, score_lessons, select_next_lesson  # noqa: E402
from mastery_engine import (  # noqa: E402
    HISTORY_CAP,
    MASTERY_STREAK_REQUIRED,
    NOTEBOOK_TO_STORED_STATUS,
    apply_attempt,
    new_mastery_state,
    update_mastery,
)
from progress_report import build_progress_report  # noqa: E402

LEARNER = "learner-1"
ALL_SIGNS = ["pain", "hurt", "eat", "go", "help", "tired", "doctor"]   # "doctor" is never attempted

# (target, predicted, tier)
EVENTS = [
    ("pain", "pain", "weak"),          # first attempt            -> learning
    ("pain", "hurt", "moderate"),      # recognition mismatch     -> streak reset, not graded
    ("pain", "pain", "strong"),
    ("pain", "pain", "strong"),
    ("pain", "pain", "strong"),        # 3 consecutive strong     -> mastered
    ("pain", "pain", "moderate"),      # streak broken            -> no longer mastered
    ("eat", "eat", "strong"),
    ("eat", "eat", "strong"),
    ("eat", "go", "strong"),           # mismatch on a strong-looking attempt resets the streak
    ("eat", "eat", "strong"),
    ("eat", "eat", "strong"),
    ("eat", "eat", "strong"),          # mastered
    ("go", "go", "strong"),
    ("go", "go", "strong"),
    ("go", "go", "strong"),            # mastered in the first 3 attempts
    ("help", "help", "weak"),          # one attempt only         -> learning
    ("hurt", "pain", "weak"),          # first-ever attempt is a mismatch
] + [("tired", "tired", "weak")] * 12  # 12 graded attempts: score grows, history capped at 10


def _notebook_scores(profiles):
    """get_next_lesson() only returns sign + reason. Capture the scores
    it computes by watching the list it hands to random.shuffle()."""
    captured = {}
    original_shuffle = notebook.random.shuffle

    def recording_shuffle(scored):
        captured.update({sign: score for sign, score, _reason in scored})
        original_shuffle(scored)

    notebook.random.shuffle = recording_shuffle
    try:
        ranking = notebook.get_next_lesson(profiles, LEARNER, ALL_SIGNS, n_signs=len(ALL_SIGNS))
    finally:
        notebook.random.shuffle = original_shuffle
    return captured, [entry["sign"] for entry in ranking]


def test_learner_model_matches_notebook():
    assert MASTERY_STREAK_REQUIRED == notebook.MASTERY_STREAK_REQUIRED == 3
    assert HISTORY_CAP == notebook.HISTORY_CAP == 10

    random.seed(0)
    notebook_profiles = {}
    app_rows = {}

    for step, (target, predicted, tier) in enumerate(EVENTS, start=1):
        grading_result = {"predicted_class": predicted, "quality_tier": tier, "tcn_confidence": 0.9,
                          "dtw_distance": 1.0, "top_deviating_landmarks": []}
        profile = notebook.update_learner_profile(notebook_profiles, LEARNER, target, grading_result)

        row = apply_attempt(
            app_rows.get(target) or new_mastery_state(),
            attempt_type="webcam",
            is_correct_sign=predicted == target,
            quality_tier=tier if predicted == target else None,
        )
        app_rows[target] = row

        expected_status = NOTEBOOK_TO_STORED_STATUS[profile["mastery_status"]]
        assert row["attempts"] == profile["attempts"], (step, row, profile)
        assert row["recognition_mismatch_count"] == profile["recognition_mismatches"], (step, row, profile)
        assert row["consecutive_strong_streak"] == profile["consecutive_strong"], (step, row, profile)
        assert row["mastery_status"] == expected_status, (step, row, profile)
        assert len(profile["history"]) <= HISTORY_CAP

        notebook_scores, notebook_order = _notebook_scores(notebook_profiles)
        app_scored = score_lessons(ALL_SIGNS, app_rows)
        app_scores = {sign: score for sign, score, _reason in app_scored}
        assert app_scores == notebook_scores, (step, app_scores, notebook_scores)

        # Both rankings are sorted by the same scores (order within a tie is random).
        app_order = [sign for sign, _score, _reason in rank_lessons(ALL_SIGNS, app_rows)]
        assert [app_scores[s] for s in app_order] == [notebook_scores[s] for s in notebook_order] == sorted(app_scores.values())

        print(
            f"[{step:>2}] target={target:<6} predicted={predicted:<6} tier={tier:<8} -> "
            f"attempts={row['attempts']:<2} streak={row['consecutive_strong_streak']} "
            f"mismatches={row['recognition_mismatch_count']} "
            f"status={row['mastery_status']:<9} (notebook: {profile['mastery_status']:<10}) "
            f"scores={app_scores} OK"
        )

    assert app_rows["pain"]["mastery_status"] == "improving"      # mastered at step 5, lost at step 6
    assert app_rows["eat"]["mastery_status"] == "mastered"
    assert app_rows["go"]["mastery_status"] == "mastered"
    assert len(notebook_profiles[f"{LEARNER}::tired"]["history"]) == HISTORY_CAP


def test_multiple_choice_never_builds_the_strong_streak():
    """App-only attempt type (not in the notebook): mastery must still
    mean 3 consecutive strong webcam attempts."""
    row = new_mastery_state()
    for _ in range(6):
        row = apply_attempt(row, "multiple_choice", is_correct_sign=True)
    assert row["consecutive_strong_streak"] == 0 and row["mastery_status"] == "improving", row

    for _ in range(2):
        row = apply_attempt(row, "webcam", is_correct_sign=True, quality_tier="strong", execution_score=0.9)
    row = apply_attempt(row, "multiple_choice", is_correct_sign=True)      # leaves the streak alone
    assert row["consecutive_strong_streak"] == 2, row
    row = apply_attempt(row, "webcam", is_correct_sign=True, quality_tier="strong", execution_score=0.8)
    assert row["mastery_status"] == "mastered" and row["best_score"] == 0.9 and row["last_score"] == 0.8, row

    row = apply_attempt(row, "multiple_choice", is_correct_sign=False)     # wrong answer = mismatch
    assert row["consecutive_strong_streak"] == 0 and row["mastery_status"] == "improving", row
    print("multiple_choice rules OK")


CAREGIVER = "caregiver-1"
OTHER_CAREGIVER = "caregiver-2"


def test_update_mastery_round_trip_in_memory():
    """update_mastery(): fetch -> rules -> upsert, one row per (caregiver, sign)."""
    db = FakeSupabase()
    statuses = []
    for tier in ("weak", "strong", "strong", "strong"):
        row = update_mastery(db, CAREGIVER, "pain", attempt_type="webcam", is_correct_sign=True,
                             quality_tier=tier, execution_score=0.9 if tier == "strong" else 0.2)
        statuses.append(row["mastery_status"])
    assert statuses == ["learning", "improving", "improving", "mastered"], statuses
    assert row["attempts"] == 4 and row["consecutive_strong_streak"] == 3 and row["best_score"] == 0.9, row

    row = update_mastery(db, CAREGIVER, "pain", attempt_type="webcam", is_correct_sign=False)
    assert row["mastery_status"] == "improving" and row["consecutive_strong_streak"] == 0, row
    assert row["recognition_mismatch_count"] == 1 and row["last_score"] == 0.9, row      # mismatch is not graded

    update_mastery(db, OTHER_CAREGIVER, "pain", attempt_type="multiple_choice", is_correct_sign=True)
    rows = db.tables["gloss_caregiver_mastery"]
    assert len(rows) == 2 and {r["caregiver_profile_id"] for r in rows} == {CAREGIVER, OTHER_CAREGIVER}, rows
    print("update_mastery round trip OK")


def _legacy_db():
    """Rows as the OLD rules left them, including both retired statuses
    and old-scale scores."""
    def row(sign, status, attempts, streak, best=None, last=None, caregiver=CAREGIVER):
        return {"caregiver_profile_id": caregiver, "sign_id": sign, "mastery_status": status, "attempts": attempts,
                "consecutive_strong_streak": streak, "recognition_mismatch_count": 0, "best_score": best,
                "last_score": last, "has_verified_strong_execution": False, "last_practiced_at": "2026-08-30T10:00:00+00:00"}

    return FakeSupabase(
        gloss_signs=[{"id": s, "display_name": s.title(), "is_active": True} for s in ALL_SIGNS]
        + [{"id": "retired-sign", "display_name": "Retired", "is_active": False}],
        gloss_caregiver_mastery=[
            row("pain", "weak", 5, 0, best=0.80, last=0.10),
            row("hurt", "needs_revision", 4, 0),
            row("eat", "mastered", 9, 5, best=0.80, last=0.75),
            row("go", "improving", 3, 2, best=0.0, last=0.0),
            row("help", "learning", 1, 0),
            row("tired", "new", 0, 0),
            row("doctor", "weak", 9, 0, caregiver=OTHER_CAREGIVER),      # someone else's row
        ],
        gloss_attempts=[],
    )


def test_legacy_statuses_are_handled_like_improving():
    db = _legacy_db()
    mastery_by_sign = {r["sign_id"]: r for r in db.tables["gloss_caregiver_mastery"]
                       if r["caregiver_profile_id"] == CAREGIVER}

    scored = {sign: (score, reason) for sign, score, reason in score_lessons(ALL_SIGNS, mastery_by_sign)}
    assert scored == {
        "pain": (2, "improving"),            # weak            -> scored/labelled as improving
        "hurt": (1, "improving"),            # needs_revision  -> scored/labelled as improving
        "eat": (100, "mastered"),
        "go": (0, "improving"),
        "help": (0, "learning"),
        "tired": (5, "never_attempted"),     # row exists but attempts == 0
        "doctor": (5, "never_attempted"),    # no row for this caregiver
    }, scored

    for _ in range(50):
        assert select_next_lesson(db, CAREGIVER) in ("go", "help")       # the two score-0 signs, random tie-break
    assert select_next_lesson(db, "brand-new-caregiver") in ALL_SIGNS    # all score 5; never the inactive sign

    report = build_progress_report(db, CAREGIVER)
    by_sign = {r["sign_id"]: r["mastery_status"] for r in report["mastery_summary"]}
    assert by_sign["pain"] == by_sign["hurt"] == by_sign["go"] == "improving", by_sign
    assert report["mastered_count"] == 1 and report["improving_count"] == 3 and report["learning_count"] == 2, report
    assert not {"weak", "needs_revision"} & set(by_sign.values())

    # Reading never rewrites the stored rows.
    stored = {r["sign_id"]: r["mastery_status"] for r in db.tables["gloss_caregiver_mastery"]
              if r["caregiver_profile_id"] == CAREGIVER}
    assert stored["pain"] == "weak" and stored["hurt"] == "needs_revision", stored

    # The next attempt on a legacy row replaces the retired status and the old-scale last_score.
    row = update_mastery(db, CAREGIVER, "pain", attempt_type="webcam", is_correct_sign=True,
                         quality_tier="moderate", execution_score=0.5)
    assert row["mastery_status"] == "improving" and row["last_score"] == 0.5 and row["best_score"] == 0.80, row
    print("legacy statuses OK")


if __name__ == "__main__":
    test_learner_model_matches_notebook()
    test_multiple_choice_never_builds_the_strong_streak()
    test_update_mastery_round_trip_in_memory()
    test_legacy_statuses_are_handled_like_improving()
    print("LEARNER MODEL TEST PASSED")
