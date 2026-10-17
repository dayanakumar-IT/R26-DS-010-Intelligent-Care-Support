"""
tests/test_supervisor.py
Sign & Vitals — supervisor view and supervisor learning (no network, no
model; in-memory database tests/fake_supabase_rpc.py):

  - every supervisor endpoint checks the role ON THE SERVER: no token -> 401,
    a caregiver -> 403, an admin -> 403, a supervisor -> 200;
  - the overview lists every caregiver with a GLOSS account (sorted by name,
    not by score), never the supervisors' own learning;
  - pace, active days, last active, Parkinson's numbers and the popup line;
  - a supervisor can create their own learner profile (idempotent, name from
    profiles.name) and then learn as themselves (learner id from the token);
  - before migration 0049 that answers 503 instead of failing.

Run with .venv's python:
    python tests/test_supervisor.py
"""

import os
import sys
from datetime import datetime, timezone
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient  # noqa: E402

import auth_helper  # noqa: E402
import main  # noqa: E402
import supervisor_report as sr  # noqa: E402
from fake_supabase_rpc import FakeSupabase  # noqa: E402

CG_A, CG_B = "10000000-0000-0000-0000-00000000000a", "10000000-0000-0000-0000-00000000000b"
USERS = {"tok-care": "u-care", "tok-sup": "u-sup", "tok-sup2": "u-sup2", "tok-admin": "u-admin"}
NOW = datetime(2026, 10, 18, 9, 0, tzinfo=timezone.utc)   # Sunday; week starts Mon 12 Oct


class _Auth:
    def get_user(self, token):
        if token not in USERS:
            raise RuntimeError("invalid token")
        return SimpleNamespace(user=SimpleNamespace(id=USERS[token]))


def database(with_learners=True):
    t = lambda d: d.isoformat()  # noqa: E731
    db = FakeSupabase({
        "profiles": [
            {"id": "u-care", "name": "Harsha", "role": "caregiver"},
            {"id": "u-sup", "name": "Chamara Dissanayake", "role": "supervisor"},
            {"id": "u-sup2", "name": "Second Supervisor", "role": "supervisor"},
            {"id": "u-admin", "name": "Admin", "role": "admin"},
        ],
        "gloss_caregiver_accounts": [
            {"user_id": "u-care", "caregiver_profile_id": CG_B, "timezone": "Asia/Colombo"},
            {"user_id": "u-other", "caregiver_profile_id": CG_A, "timezone": "Asia/Colombo"},
        ],
        "caregiver_profiles": [{"id": CG_A, "display_name": "Nadeesha"}, {"id": CG_B, "display_name": "Harsha"}],
        "gloss_milestones": [
            {"caregiver_profile_id": CG_B, "type": "demonstrated", "key": "water", "achieved_at": t(datetime(2026, 10, 16, 5, tzinfo=timezone.utc))},
            {"caregiver_profile_id": CG_B, "type": "demonstrated", "key": "milk", "achieved_at": t(datetime(2026, 10, 1, 5, tzinfo=timezone.utc))},
            {"caregiver_profile_id": CG_B, "type": "demonstrated", "key": "hurt", "achieved_at": t(datetime(2026, 10, 2, 5, tzinfo=timezone.utc))},  # not countable
            {"caregiver_profile_id": CG_B, "type": "level", "key": "starter", "achieved_at": t(datetime(2026, 10, 1, 5, tzinfo=timezone.utc))},
        ],
        "gloss_attempts": [
            {"caregiver_profile_id": CG_B, "target_sign_id": "water", "mode": "practice", "attempted_at": t(datetime(2026, 10, 13, 5, tzinfo=timezone.utc))},
            {"caregiver_profile_id": CG_B, "target_sign_id": "water", "mode": "recall", "attempted_at": t(datetime(2026, 10, 16, 5, tzinfo=timezone.utc))},
            {"caregiver_profile_id": CG_B, "target_sign_id": "milk", "mode": "practice", "attempted_at": t(datetime(2026, 10, 1, 5, tzinfo=timezone.utc))},
            {"caregiver_profile_id": CG_B, "target_sign_id": None, "mode": "free", "attempted_at": t(datetime(2026, 10, 17, 5, tzinfo=timezone.utc))},
        ],
        "pdedu_quiz_sessions": [{"caregiver_profile_id": CG_B, "completed_at": "2026-10-10T00:00:00+00:00"},
                                {"caregiver_profile_id": CG_B, "completed_at": None}],
        "pdedu_responses": [{"caregiver_profile_id": CG_B}] * 7,
        "pdedu_caregiver_mastery": [{"caregiver_profile_id": CG_B, "mastery_score": 90},
                                    {"caregiver_profile_id": CG_B, "mastery_score": 50}],
        "pdedu_symptoms": [{"id": s, "is_active": True} for s in ("tremor", "rigidity", "bradykinesia")],
        "gloss_learners": [{"id": "learner-sup2", "kind": "supervisor", "user_id": "u-sup2", "display_name": "Second Supervisor"}],
        "gloss_signs": [],
    }, missing_tables=() if with_learners else {"gloss_learners"})
    db.auth = _Auth()
    return db


def client(db):
    main.state["supabase"] = db
    auth_helper._auth_cache.clear()
    return TestClient(main.app)


def check_maths():
    db = database()
    data = sr._rows_for(db, [CG_B])
    row = sr._row({"id": CG_B, "name": "Harsha", "timezone": "Asia/Colombo"}, data, NOW)
    assert row["demonstrated"] == 2 and row["retained"] == 0, row          # 'hurt' is not countable
    assert row["practised"] == 2, row                                      # water, milk (free not counted)
    assert row["pace"]["demonstrated"] == [0, 1, 0, 1], row["pace"]        # 1 Oct week, 12 Oct week
    assert row["pace"]["trend"] == "about the same as the 2 weeks before"
    assert row["active_days_this_week"] == 2 and row["active_days_total"] == 3, row
    assert row["new_demonstrated_this_week"] == 1 and row["last_active"] == "2026-10-16", row
    assert row["parkinsons"] == {"quizzes_completed": 1, "questions_answered": 7, "symptoms_mastered": 1,
                                 "symptom_count": 3, "average_mastery": 70}, row["parkinsons"]
    assert sr.popup_line(row) == "Harsha: 2 active days this week, 1 new sign demonstrated"
    assert sr.popup_line({**row, "active_days_this_week": 0}) == "Harsha: no practice yet this week"
    assert sr.popup_line({**row, "active_days_this_week": 1, "new_demonstrated_this_week": 0}) == "Harsha: 1 active day this week"
    assert sr.trend_word([0, 0, 1, 2]).startswith("more") and sr.trend_word([3, 1, 0, 1]).startswith("fewer")
    print("  ok  pace, active days, last active, Parkinson's numbers, popup lines")


def check_roles():
    c = client(database())
    paths = [("get", "/gloss/supervisor/overview"), ("get", f"/gloss/supervisor/caregivers/{CG_B}"),
             ("post", "/gloss/supervisor/learner-profile")]
    for method, path in paths:
        assert getattr(c, method)(path).status_code == 401, path
        for tok in ("tok-care", "tok-admin", "bogus"):
            r = getattr(c, method)(path, headers={"Authorization": f"Bearer {tok}"})
            assert r.status_code == (401 if tok == "bogus" else 403), (path, tok, r.status_code)
    print("  ok  every supervisor endpoint: no token 401, caregiver 403, admin 403")


def check_overview():
    c = client(database())
    r = c.get("/gloss/supervisor/overview", headers={"Authorization": "Bearer tok-sup"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert [x["name"] for x in body["caregivers"]] == ["Harsha", "Nadeesha"]          # by name, not score
    assert all("Second Supervisor" not in x["name"] for x in body["caregivers"])       # supervisor learners not listed
    assert len(body["popup"]) == 2 and body["popup"][1] == "Nadeesha: no practice yet this week"
    d = c.get(f"/gloss/supervisor/caregivers/{CG_B}", headers={"Authorization": "Bearer tok-sup2"})
    assert d.status_code == 200 and d.json()["summary"]["counts"]["countable"] == 55, d.text   # both supervisors
    assert c.get("/gloss/supervisor/caregivers/nobody", headers={"Authorization": "Bearer tok-sup"}).status_code == 404
    print("  ok  overview: all caregivers by name, both supervisors, detail with progress summary, 404 unknown")


def check_learning():
    db = database()
    c = client(db)
    me = c.get("/gloss/me", headers={"Authorization": "Bearer tok-sup"}).json()
    assert me["is_supervisor"] and me["learner_id"] is None, me
    assert c.get("/gloss/history", headers={"Authorization": "Bearer tok-sup"}).status_code == 403   # not a learner yet
    r1 = c.post("/gloss/supervisor/learner-profile", headers={"Authorization": "Bearer tok-sup"})
    r2 = c.post("/gloss/supervisor/learner-profile", headers={"Authorization": "Bearer tok-sup"})
    assert r1.status_code == 200 and r1.json() == r2.json(), (r1.text, r2.text)                  # idempotent
    rows = [l for l in db.tables["gloss_learners"] if l["user_id"] == "u-sup"]
    assert len(rows) == 1 and rows[0]["display_name"] == "Chamara Dissanayake" and rows[0]["kind"] == "supervisor"
    learner = r1.json()["learner_id"]
    assert auth_helper.get_authenticated_caregiver(db, "Bearer tok-sup") == learner                 # learns as themselves
    assert auth_helper.get_authenticated_caregiver(db, "Bearer tok-care") == CG_B                   # caregivers unchanged
    me = c.get("/gloss/me", headers={"Authorization": "Bearer tok-care"}).json()
    assert me == {"role": "caregiver", "name": "Harsha", "learner_id": CG_B, "is_supervisor": False}, me
    print("  ok  supervisor learner profile: created once, name from profiles.name, then learns with their own id")

    c = client(database(with_learners=False))
    r = c.post("/gloss/supervisor/learner-profile", headers={"Authorization": "Bearer tok-sup"})
    assert r.status_code == 503 and "0049" in r.json()["detail"], r.text
    assert auth_helper.get_authenticated_caregiver(main.state["supabase"], "Bearer tok-care") == CG_B
    print("  ok  before 0049: learner profile answers 503; caregivers still sign in")


if __name__ == "__main__":
    check_maths()
    check_roles()
    check_overview()
    check_learning()
    print("SUPERVISOR TEST PASSED")
