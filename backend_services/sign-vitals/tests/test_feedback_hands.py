"""
tests/test_feedback_hands.py
GLOSS component — feedback version v2: feedback only names hands (and their
arm) that the reference sign uses (execution_evaluator.FEEDBACK_VERSIONS).

  - which hands each reference uses is read from the shipped exemplars
    (hello / water / back: right only; angry / help: both);
  - on the 10 shipped full attempts, v1 and v2 give the same recognition,
    DTW distance and quality tier; v2 never cites a hand the recognised
    sign's reference does not use;
  - the shipped attempt where v1 says "left wrist and left pinky tip" for a
    right-handed sign (back) cites right-side / body landmarks in v2;
  - GLOSS_FEEDBACK_VERSION=v1 reproduces the thesis-evaluated wording.

Run with .venv's python:
    python tests/test_feedback_hands.py
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np  # noqa: E402

import execution_evaluator as ev  # noqa: E402
import grading  # noqa: E402
from recogniser import ASSETS_DIR, load_ensemble  # noqa: E402

grading.load_assets()
MODEL = load_ensemble()
Z = np.load(os.path.join(ASSETS_DIR, "pipeline_parity.npz"))
EXPECTED = json.loads(str(Z["expected_json"]))


def run(i, version):
    return ev.evaluate_execution(Z[f"normalized_{i}"], EXPECTED[i]["true_sign"], MODEL, feedback_version_override=version)


def cited(out):
    return [d["landmark"] for d in out["result"]["top_deviating_landmarks"][:2]]


def test_reference_hand_use():
    assert ev.unused_hand_sides("hello") == {"left"}
    assert ev.unused_hand_sides("water") == {"left"}
    assert ev.unused_hand_sides("back") == {"left"}
    assert ev.unused_hand_sides("angry") == set()
    assert ev.unused_hand_sides("help") == set()


def test_same_grading_only_citations_differ():
    for i in range(len(EXPECTED)):
        v1, v2 = run(i, "v1"), run(i, "v2")
        r1, r2 = v1["result"], v2["result"]
        assert r1["predicted_class"] == r2["predicted_class"]
        assert r1["tcn_confidence"] == r2["tcn_confidence"]
        assert r1["dtw_distance"] == r2["dtw_distance"] and r1["quality_tier"] == r2["quality_tier"]
        unused = ev.unused_hand_sides(r2["predicted_class"])
        if r2["quality_tier"] in ("moderate", "weak"):
            assert not any(ev._cites_unused_side(lm, unused) for lm in cited(v2)), (i, cited(v2))
        assert v1["feedback_version"] == "v1" and v2["feedback_version"] == "v2"


def test_resting_left_hand_no_longer_named():
    i = next(k for k, e in enumerate(EXPECTED) if e["true_sign"] == "head")  # recognised as 'back'
    v1, v2 = run(i, "v1"), run(i, "v2")
    assert cited(v1) == ["left_wrist", "left_hand_16"], cited(v1)
    assert not any(lm.startswith("left") for lm in cited(v2)), cited(v2)
    print(f"    v1: {v1['base']['full_text']}\n    v2: {v2['base']['full_text']}")


def test_version_setting():
    os.environ["GLOSS_FEEDBACK_VERSION"] = "v1"
    try:
        assert ev.feedback_version() == "v1"
    finally:
        del os.environ["GLOSS_FEEDBACK_VERSION"]
    assert ev.feedback_version() == ev.DEFAULT_FEEDBACK_VERSION == "v2"
    # "GLOSS_FEEDBACK_VERSION=" (empty, as copied from .env.example) = the default, not an error.
    os.environ["GLOSS_FEEDBACK_VERSION"] = ""
    try:
        assert ev.feedback_version() == "v2"
    finally:
        del os.environ["GLOSS_FEEDBACK_VERSION"]
    try:
        ev.feedback_version("v3")
        raise AssertionError("v3 accepted")
    except ValueError:
        pass


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("FEEDBACK HANDS TEST PASSED")
