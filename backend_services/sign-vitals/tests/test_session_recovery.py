"""
tests/test_session_recovery.py
GLOSS component — a missing or expired practice session never blocks an
attempt (attempt_submission._resolve_session / submit_attempt).

  - no session id            -> a new session is started;
  - this caregiver's session -> reused, nothing new created;
  - unknown / expired id     -> a new session is started, attempt goes on;
  - another caregiver's id   -> a new session is started; the attempt is
                                never added to the other caregiver's session;
  - end to end: submit_attempt with a stale id stores the attempt under
    the new session and returns that session id to the client.

Uses an in-memory fake database: nothing touches Supabase.

Run with .venv's python:
    python tests/test_session_recovery.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import attempt_submission  # noqa: E402
from attempt_submission import _resolve_session, submit_attempt  # noqa: E402

ME = "caregiver-me"
OTHER = "caregiver-other"


from fake_supabase_rpc import FakeSupabase  # noqa: E402

SIGNS = [{"id": s, "display_name": s.title(), "is_active": True} for s in ("hello", "water", "angry")]


class FakeDb(FakeSupabase):
    """In-memory Supabase (tests/fake_supabase_rpc.py) with two sessions."""

    def __init__(self):
        super().__init__({
            "gloss_learning_sessions": [
                {"id": "s-mine", "caregiver_profile_id": ME},
                {"id": "s-other", "caregiver_profile_id": OTHER},
            ],
            "gloss_signs": SIGNS,
        })

    def new_sessions(self):
        return [r for t, r in self.writes if t == "gloss_learning_sessions"]

def test_no_session_starts_one():
    db = FakeDb()
    sid = _resolve_session(db, ME, None)
    assert [s["id"] for s in db.new_sessions()] == [sid]


def test_own_session_is_reused():
    db = FakeDb()
    assert _resolve_session(db, ME, "s-mine") == "s-mine"
    assert db.new_sessions() == []


def test_missing_session_starts_a_new_one():
    db = FakeDb()
    sid = _resolve_session(db, ME, "246453a6-gone")
    assert sid not in ("246453a6-gone", "s-mine")
    assert db.new_sessions()[0]["caregiver_profile_id"] == ME


def test_other_caregivers_session_is_not_used():
    db = FakeDb()
    sid = _resolve_session(db, ME, "s-other")
    assert sid != "s-other"
    assert db.new_sessions()[0]["caregiver_profile_id"] == ME


def test_attempt_with_stale_session_goes_through():
    db = FakeDb()
    result = submit_attempt(db, ME, "water", "multiple_choice",
                            session_id="246453a6-gone", selected_sign_id="water")
    assert result["outcome"] == "quiz_correct"
    new_sid = result["session_id"]
    assert new_sid != "246453a6-gone"
    stored = [r for t, r in db.writes if t == "gloss_attempts"]
    assert len(stored) == 1 and stored[0]["session_id"] == new_sid
    # The next attempt with the returned id reuses that session.
    again = submit_attempt(db, ME, "water", "multiple_choice", session_id=new_sid, selected_sign_id="hello")
    assert again["session_id"] == new_sid and len(db.new_sessions()) == 1


if __name__ == "__main__":
    attempt_submission.logger.disabled = True
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("SESSION RECOVERY TEST PASSED")
