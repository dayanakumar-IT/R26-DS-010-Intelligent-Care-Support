"""
tests/test_attempt_modes.py
GLOSS component — attempt modes end to end through submit_attempt (real
model and grading; in-memory database, tests/fake_supabase_rpc.py):

  - before migrations 0045-0047: practice and quiz still work on the
    original write path; recall / free answer 503;
  - after: practice, quiz and recall attempts are stored with mode and
    pipeline_version together with their mastery row and new milestones in
    one gloss_record_attempt call; a milestone is never reported twice;
  - Check my sign (free): no target, outcome from the confidence bands,
    stored with mode='free', no mastery change, no milestones;
  - recall needs a target and earns the first-recall practice badge;
  - a clip failing the hand check is not stored, so it never counts toward
    practice badges (they count only checked camera attempts).

Landmarks come from the shipped full test attempts (pipeline_parity.npz),
so no video or MediaPipe is needed.

Run with .venv's python:
    python tests/test_attempt_modes.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.pop("GEMINI_API_KEY", None)   # rule-based feedback, no network

import numpy as np  # noqa: E402

import attempt_submission as sub  # noqa: E402
import grading  # noqa: E402
import progress_store  # noqa: E402
import sign_config as cfg  # noqa: E402
from fake_supabase_rpc import FakeSupabase  # noqa: E402
from recogniser import ASSETS_DIR, load_ensemble  # noqa: E402

grading.load_assets()
MODEL = load_ensemble()
NAMES = grading.load_class_names()
THRESHOLDS = grading.load_thresholds()
Z = np.load(os.path.join(ASSETS_DIR, "pipeline_parity.npz"))
CG = "caregiver-test"
SIGNS = [{"id": s, "display_name": s.title(), "is_active": True} for s in NAMES]


def db(migrated=True):
    progress_store._ready.update(value=None, checked=0.0)   # re-detect the schema per test
    return FakeSupabase({"gloss_signs": SIGNS}, missing_tables=() if migrated else {"gloss_milestones"})


def submit(d, target, mode="practice", kind="webcam", raw_index=0, selected=None):
    sub.extract_landmarks_via_subprocess = lambda *a, **k: Z[f"raw_{raw_index}"]
    return sub.submit_attempt(d, CG, target, kind, video_path="clip.mp4" if kind == "webcam" else None,
                              selected_sign_id=selected, model=MODEL, class_names=NAMES,
                              class_thresholds=THRESHOLDS, mode=mode)


def writes(d, table):
    return [r for t, r in d.writes if t == table]


def test_before_migrations_practice_still_works_new_modes_503():
    d = db(migrated=False)
    r = submit(d, "water", kind="multiple_choice", selected="water")
    assert r["outcome"] == "quiz_correct" and r["new_milestones"] == []
    assert "mode" not in writes(d, "gloss_attempts")[0]          # original row shape
    for mode in ("recall", "free"):
        try:
            submit(d, None if mode == "free" else "water", mode=mode)
            raise AssertionError(f"{mode} accepted before migrations")
        except sub.AttemptError as e:
            assert e.status_code == 503


def test_practice_webcam_stores_version_mastery_and_milestones_together():
    d = db()
    target = str(Z["expected_json"]).split('"true_sign": "')[1].split('"')[0]   # raw_0's sign
    r = submit(d, target)
    att = writes(d, "gloss_attempts")[0]
    assert att["mode"] == "practice" and att["pipeline_version"] == cfg.PIPELINE_VERSION
    assert [m["key"] for m in r["new_milestones"]] == ["starter"]
    assert writes(d, "gloss_milestones")[0]["evidence"] == [att["id"]]
    if r["outcome"] != "not_recognised":
        assert writes(d, "gloss_caregiver_mastery"), "mastery row stored with the attempt"
    r2 = submit(d, target)
    assert "starter" not in [m["key"] for m in r2["new_milestones"]], "a milestone is never reported twice"


def test_clip_failing_the_hand_check_is_not_stored_and_earns_nothing():
    d = db()
    raw = Z["raw_0"].copy()
    raw[:, 7:, :] = np.nan                                       # no hand ever detected
    sub.extract_landmarks_via_subprocess = lambda *a, **k: raw
    r = sub.submit_attempt(d, CG, "water", "webcam", video_path="clip.mp4", model=MODEL, class_names=NAMES,
                           class_thresholds=THRESHOLDS, mode="practice")
    assert r["outcome"] == "capture_rejected" and r["capture_check"]["reason"] == "hands_not_visible"
    assert d.writes == [w for w in d.writes if w[0] == "gloss_learning_sessions"]   # only the session
    assert not writes(d, "gloss_attempts") and not writes(d, "gloss_milestones")


def test_quiz_attempt_in_practice_mode():
    d = db()
    r = submit(d, "water", kind="multiple_choice", selected="tea")
    assert r["outcome"] == "quiz_wrong" and r["mode"] == "practice"
    assert writes(d, "gloss_attempts")[0]["attempt_type"] == "multiple_choice"
    assert r["new_milestones"] == []                                  # Starter needs a camera attempt


def test_free_check_my_sign():
    for i in range(10):
        d = db()
        r = submit(d, None, mode="free", raw_index=i)
        if r["outcome"] == "capture_rejected":
            continue
        c = r["recognition_confidence"]
        expected = "free_match" if c >= 0.6 else "free_maybe" if c >= 0.35 else "free_no_match"
        assert r["outcome"] == expected, (i, c, r["outcome"])
        n = {"free_match": 1, "free_no_match": 0}.get(r["outcome"])
        if n is not None:
            assert len(r["suggestions"]) == n
        else:
            assert 1 <= len(r["suggestions"]) <= 2 and all(s["confidence"] >= 0.2 for s in r["suggestions"][1:])
        att = writes(d, "gloss_attempts")[0]
        assert att["mode"] == "free" and att["target_sign_id"] is None
        assert not writes(d, "gloss_caregiver_mastery") and not writes(d, "gloss_milestones")
    try:
        submit(db(), "water", mode="free")
        raise AssertionError("free attempt with a target accepted")
    except sub.AttemptError as e:
        assert e.status_code == 400


def test_recall_is_graded_like_practice_and_earns_first_recall():
    d = db()
    target = str(Z["expected_json"]).split('"true_sign": "')[1].split('"')[0]
    r = submit(d, target, mode="recall")
    assert r["mode"] == "recall" and writes(d, "gloss_attempts")[0]["mode"] == "recall"
    assert {"starter", "first_recall"} <= {m["key"] for m in r["new_milestones"]}
    try:
        submit(db(), None, mode="recall")
        raise AssertionError("recall without a target accepted")
    except sub.AttemptError as e:
        assert e.status_code == 400


if __name__ == "__main__":
    sub.logger.disabled = True
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("ATTEMPT MODES TEST PASSED")
