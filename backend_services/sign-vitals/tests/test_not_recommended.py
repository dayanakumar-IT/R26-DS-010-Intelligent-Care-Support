"""
tests/test_not_recommended.py
GLOSS component — dictionary-only (not_recommended) signs.

  - the lesson selector never returns one over 500 simulated picks, even
    when they are the most attractive by score;
  - "Continue practising" data marks them as not recommendable, even when
    they are already in the caregiver's history (e.g. stand);
  - they remain in the dictionary (sign catalogue) with the quality note;
  - they can still be practised: an attempt on one is graded, stored and
    updates mastery exactly like any other sign.

Run with .venv's python:  python tests/test_not_recommended.py
"""

import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fake_supabase import FakeSupabase  # noqa: E402
from lesson_selector import select_next_lesson  # noqa: E402
from progress_report import build_progress_report  # noqa: E402
from recogniser import ASSETS_DIR  # noqa: E402
from sign_config import NOT_RECOMMENDED, QUALITY_NOTE, annotate_sign  # noqa: E402

CAREGIVER = "caregiver-1"
with open(os.path.join(ASSETS_DIR, "class_names.json")) as f:
    ALL_SIGNS = json.load(f)
PICKS = 500


def _db(mastery_rows=(), attempts=()):
    return FakeSupabase(
        gloss_signs=[{"id": s, "display_name": s.title(), "is_active": True} for s in ALL_SIGNS],
        gloss_caregiver_mastery=list(mastery_rows),
        gloss_attempts=list(attempts),
    )


def _row(sign, attempts, streak, status):
    return {"caregiver_profile_id": CAREGIVER, "sign_id": sign, "attempts": attempts,
            "consecutive_strong_streak": streak, "mastery_status": status, "best_score": None,
            "last_score": None, "last_practiced_at": "2026-10-14T10:00:00+00:00"}


def test_list_is_the_agreed_five():
    assert set(NOT_RECOMMENDED) == {"me", "good", "stand", "welcome", "arm"}
    assert all(s in ALL_SIGNS for s in NOT_RECOMMENDED)
    assert all(reason.strip() for reason in NOT_RECOMMENDED.values())


def test_selector_never_picks_them():
    random.seed(1)
    # Worst case: the not_recommended signs score 0 (most urgent) and every
    # other sign is mastered (score 100) — they would win every pick if allowed.
    rows = [_row(s, 2, 0, "improving") for s in NOT_RECOMMENDED]
    rows += [_row(s, 3, 3, "mastered") for s in ALL_SIGNS if s not in NOT_RECOMMENDED]
    picks = [select_next_lesson(_db(rows), CAREGIVER) for _ in range(PICKS)]
    assert not set(picks) & set(NOT_RECOMMENDED), set(picks) & set(NOT_RECOMMENDED)

    # New caregiver: every sign ties, so any sign could come up at random.
    picks = [select_next_lesson(_db(), "new-caregiver") for _ in range(PICKS)]
    assert not set(picks) & set(NOT_RECOMMENDED)
    assert len(set(picks)) > 30, "ties should still spread across the remaining signs"
    print(f"selector: 0 of {2 * PICKS} picks were not_recommended")


def test_continue_practising_excludes_them():
    rows = [_row("stand", 3, 0, "improving"), _row("water", 2, 0, "improving")]
    report = build_progress_report(_db(rows), CAREGIVER)
    flags = {r["sign_id"]: r["recommendable"] for r in report["mastery_summary"]}
    assert flags == {"stand": False, "water": True}
    # History and counts are unchanged: stand is still listed and counted.
    assert report["signs_practiced"] == 2


def test_still_in_the_dictionary_with_note():
    catalogue = [annotate_sign({"id": s, "display_name": s.title()}) for s in ALL_SIGNS]
    assert len(catalogue) == len(ALL_SIGNS)
    for row in catalogue:
        if row["id"] in NOT_RECOMMENDED:
            assert row["recommendable"] is False and row["quality_note"] == QUALITY_NOTE
        else:
            assert row["recommendable"] is True and row["quality_note"] is None


def test_still_practisable():
    from attempt_submission import submit_attempt  # heavy import (model code), only here

    for sign in NOT_RECOMMENDED:
        db = _db()
        result = submit_attempt(db, CAREGIVER, target_sign_id=sign, attempt_type="multiple_choice",
                                selected_sign_id=sign)
        assert result["is_correct_sign"] is True and result["outcome"] == "quiz_correct"
        assert any(a["target_sign_id"] == sign for a in db.tables["gloss_attempts"])
        assert result["mastery"]["sign_id"] == sign and result["mastery"]["attempts"] == 1
        # ...but the next recommendation is never a not_recommended sign.
        assert result["next_recommended_sign_id"] not in NOT_RECOMMENDED
    print(f"practisable: {len(NOT_RECOMMENDED)} of {len(NOT_RECOMMENDED)} accepted, graded and stored")


if __name__ == "__main__":
    test_list_is_the_agreed_five()
    test_selector_never_picks_them()
    test_continue_practising_excludes_them()
    test_still_in_the_dictionary_with_note()
    test_still_practisable()
    print("NOT_RECOMMENDED TEST PASSED")
