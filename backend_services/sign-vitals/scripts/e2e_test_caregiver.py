"""
scripts/e2e_test_caregiver.py
GLOSS component — live end-to-end check of the running backend, logged in
as the GLOSS TEST caregiver (scripts/create_test_caregiver.py). Writes
attempts ONLY to that test account; refuses to run for any other login.

Flows: practice (camera), session reuse and a stale session, quiz,
a clip failing the hand check, Check my sign (three result types),
Recall, progress summary (My Journey), progress, history; then the stored
rows are checked with the service role.

Usage (.venv; backend running):
  python scripts/e2e_test_caregiver.py --api http://127.0.0.1:8009 --clips <dir with water/pain/afternoon/please .mp4> \
      [--no-hands <clip without hands>]
"""

import argparse
import os
import sys

import requests
from dotenv import dotenv_values, load_dotenv
from supabase import create_client

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
load_dotenv(".env")
TEST_EMAIL = "gloss.test.caregiver@example.com"
results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'}  {name}{('  (' + str(detail) + ')') if detail else ''}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://127.0.0.1:8009")
    ap.add_argument("--clips", required=True)
    ap.add_argument("--no-hands")
    a = ap.parse_args()
    assert os.environ["GLOSS_TEST_CAREGIVER_EMAIL"] == TEST_EMAIL, "only for the GLOSS TEST caregiver"

    anon = dotenv_values(os.path.join("..", "..", "frontend", ".env"))["VITE_SUPABASE_ANON_KEY"]
    auth = create_client(os.environ["SUPABASE_URL"], anon)
    session = auth.auth.sign_in_with_password({"email": TEST_EMAIL, "password": os.environ["GLOSS_TEST_CAREGIVER_PASSWORD"]})
    H = {"Authorization": f"Bearer {session.session.access_token}"}
    admin = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    cg = admin.table("gloss_caregiver_accounts").select("caregiver_profile_id").eq("user_id", session.user.id).execute().data[0]["caregiver_profile_id"]
    before = {r["id"] for r in admin.table("gloss_attempts").select("id").eq("caregiver_profile_id", cg).execute().data}
    print(f"logged in as {TEST_EMAIL} -> caregiver {cg[:8]} ({len(before)} earlier attempts)")

    def clip(name):
        for f in os.listdir(a.clips):
            if f.split(".")[0] == name:
                return os.path.join(a.clips, f)
        raise FileNotFoundError(name)

    def post(data, video=None):
        files = {"video": (os.path.basename(video), open(video, "rb"), "video/mp4")} if video else None
        r = requests.post(f"{a.api}/gloss/attempts", data=data, files=files, headers=H, timeout=180)
        return r.status_code, r.json()

    # Practice (camera) + session reuse
    code, r = post({"target_sign_id": "water", "attempt_type": "webcam", "mode": "practice"}, clip("water"))
    check("practice: camera attempt accepted", code == 200 and r["outcome"] in ("target_sign", "different_sign", "not_recognised"), f"{code} {r.get('outcome')} conf={round(r.get('recognition_confidence') or 0, 3)}")
    fresh = not before   # a fresh test account earns Starter / First recall now; a re-run must not earn them again
    got = [m["key"] for m in r.get("new_milestones", [])]
    check("practice: Starter newly earned on the first camera attempt" if fresh else "practice: Starter not earned again", ("starter" in got) == fresh, got)
    sid = r["session_id"]
    code, r2 = post({"target_sign_id": "water", "attempt_type": "webcam", "mode": "practice", "session_id": sid}, clip("water"))
    check("session reused for the next attempt", r2.get("session_id") == sid)
    check("Starter is not earned twice", "starter" not in [m["key"] for m in r2.get("new_milestones", [])])
    code, r3 = post({"target_sign_id": "please", "attempt_type": "multiple_choice", "selected_sign_id": "please",
                     "session_id": "00000000-0000-0000-0000-000000000000"})
    check("quiz: correct answer, stale session replaced by a new one", code == 200 and r3["outcome"] == "quiz_correct" and r3["session_id"] != sid, r3.get("outcome"))
    code, r4 = post({"target_sign_id": "please", "attempt_type": "multiple_choice", "selected_sign_id": "tea", "session_id": r3["session_id"]})
    check("quiz: wrong answer recorded as quiz_wrong", r4.get("outcome") == "quiz_wrong")

    if a.no_hands:
        n0 = len(admin.table("gloss_attempts").select("id").eq("caregiver_profile_id", cg).execute().data)
        code, r5 = post({"target_sign_id": "water", "attempt_type": "webcam"}, a.no_hands)
        n1 = len(admin.table("gloss_attempts").select("id").eq("caregiver_profile_id", cg).execute().data)
        check("clip without hands: rejected by the check, nothing stored", r5.get("outcome") == "capture_rejected" and n1 == n0, r5.get("capture_check", {}).get("reason"))

    # Check my sign
    for sign, expected in (("water", "free_match"), ("pain", "free_maybe"), ("afternoon", "free_no_match")):
        code, r6 = post({"attempt_type": "webcam", "mode": "free"}, clip(sign))
        check(f"Check my sign ({sign}): {expected}", r6.get("outcome") == expected,
              f"{r6.get('outcome')} {[(s['sign_id'], round(s['confidence'], 2)) for s in r6.get('suggestions', [])]}")

    # Recall
    rr = requests.get(f"{a.api}/gloss/recall/next", headers=H, timeout=30).json()
    word = rr.get("sign_id")
    check("recall word is a practised, recommendable sign", word in ("water", "please"), word)
    code, r7 = post({"target_sign_id": word, "attempt_type": "webcam", "mode": "recall"}, clip(word))
    check("recall: graded like practice", code == 200 and r7.get("mode") == "recall" and r7.get("outcome") in ("target_sign", "different_sign", "not_recognised"),
          f"{r7.get('outcome')} tier={r7.get('quality_tier')}")
    got = [m["key"] for m in r7.get("new_milestones", [])]
    check("recall: First recall badge newly earned" if fresh else "recall: First recall not earned again", ("first_recall" in got) == fresh, got)

    # My Journey / progress / history
    s = requests.get(f"{a.api}/gloss/progress/summary", headers=H, timeout=30).json()
    check("summary: level Starter, next Learner", s["level"]["key"] == "starter" and s["next_level"]["key"] == "learner", s["next_level"]["missing"])
    check("summary: first recall badge has a date", any(b["key"] == "first_recall" and b["earned_at"] for b in s["practice_badges"]))
    check("summary: active days this month counted", s["monthly"]["active_days"] >= 1, s["monthly"]["active_days"])
    p = requests.get(f"{a.api}/gloss/progress", headers=H, timeout=30).json()
    non_free = [x for x in admin.table("gloss_attempts").select("mode").eq("caregiver_profile_id", cg).execute().data
                if x["mode"] != "free"]
    check("progress: free attempts left out", p["total_attempts"] == len(non_free),
          f"progress {p['total_attempts']} = stored non-free {len(non_free)}")
    h = requests.get(f"{a.api}/gloss/history?limit=30", headers=H, timeout=30).json()["attempts"]
    modes = sorted({x["mode"] for x in h})
    check("history: practice, recall and free attempts tagged", modes == ["free", "practice", "recall"], modes)
    check("history: none tagged earlier version", not any(x["earlier_version"] for x in h))

    # Stored rows
    rows = [x for x in admin.table("gloss_attempts").select("id, mode, pipeline_version, target_sign_id")
            .eq("caregiver_profile_id", cg).execute().data if x["id"] not in before]
    check("stored: every new attempt has the current pipeline version", all(x["pipeline_version"] == "2026.10-ecf91068" for x in rows), len(rows))
    check("stored: free attempts have no target", all(x["target_sign_id"] is None for x in rows if x["mode"] == "free")
          and sum(x["mode"] == "free" for x in rows) == 3)
    ms = admin.table("gloss_milestones").select("type, key, evidence").eq("caregiver_profile_id", cg).execute().data
    ids = {x["id"] for x in rows} | before
    check("stored: milestones with real attempt ids as evidence", ms and all(e in ids for m in ms for e in m["evidence"]), [m["key"] for m in ms])
    auth.auth.sign_out()
    failed = results.count(False)
    print(f"\n{len(results) - failed}/{len(results)} checks passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
