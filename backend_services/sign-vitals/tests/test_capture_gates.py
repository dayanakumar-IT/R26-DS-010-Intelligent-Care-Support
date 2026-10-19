"""
tests/test_capture_gates.py
GLOSS component — capture gates (capture_gates.py) and the
"not recognised" history rule (history_report.py).

  - every real sign shipped in gloss_assets/ (59 reference exemplars,
    10 full test-set attempts) passes both gates;
  - a still clip (one real frame held, plus small detection jitter) is
    rejected as "no_movement";
  - a clip with no hand detected in any frame is rejected as
    "hands_not_visible";
  - a history row below the confidence cut-off never names a sign, even
    an old row stored before that rule.

Run with .venv's python, from anywhere:
    python tests/test_capture_gates.py
"""

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import capture_gates  # noqa: E402
from history_report import _history_entry  # noqa: E402
from preprocessing import normalize_raw_landmarks  # noqa: E402
from recogniser import ASSETS_DIR  # noqa: E402


def _parity():
    return np.load(os.path.join(ASSETS_DIR, "pipeline_parity.npz"))


def test_real_signs_pass():
    refs = np.load(os.path.join(ASSETS_DIR, "reference_exemplars.npz"))
    for sign in refs.files:
        motion = capture_gates.motion_extent(refs[sign].reshape(-1, 49, 3))
        assert motion >= capture_gates.MIN_MOTION_EXTENT, (sign, motion)

    parity = _parity()
    for i in range(10):
        result = capture_gates.check_capture(parity[f"raw_{i}"], parity[f"normalized_{i}"])
        assert result["passed"], (i, result)
    print(f"real signs: 59 references + 10 attempts pass")


def test_still_clip_rejected():
    raw = _parity()["raw_0"]
    frame = raw[np.argmax(~np.isnan(raw[:, 7:]).all(axis=(1, 2)))]  # a frame with a hand in it
    rng = np.random.default_rng(0)
    still = np.repeat(frame[None], 60, axis=0) + rng.normal(0, 0.002, (60, 49, 3)).astype(np.float32)
    result = capture_gates.check_capture(still, normalize_raw_landmarks(still))
    assert not result["passed"] and result["reason"] == "no_movement", result
    print(f"still clip: rejected (motion_extent={result['motion_extent']})")


def test_hands_never_visible_rejected():
    raw = _parity()["raw_0"].copy()
    raw[:, capture_gates.FIRST_HAND_IDX:, :] = np.nan
    result = capture_gates.check_capture(raw, normalize_raw_landmarks(raw))
    assert not result["passed"] and result["reason"] == "hands_not_visible", result
    print("no hands: rejected")


def test_history_hides_low_confidence_guess():
    names = {"stand": "Stand", "milk": "Milk"}
    base = {
        "id": "a1", "target_sign_id": "stand", "attempt_type": "webcam",
        "execution_score": None, "quality_tier": None, "attempted_at": "2026-10-14T10:00:00Z",
    }
    old_row = {**base, "recognized_sign_id": "milk", "recognition_confidence": 0.22}
    entry = _history_entry(old_row, names)
    assert entry["recognized_sign_id"] is None and entry["recognized_display_name"] is None
    assert entry["not_recognised"] and not entry["is_correct_sign"]

    confident = {**base, "recognized_sign_id": "milk", "recognition_confidence": 0.71}
    entry = _history_entry(confident, names)
    assert entry["recognized_display_name"] == "Milk" and not entry["not_recognised"]

    quiz = {**base, "attempt_type": "multiple_choice", "recognized_sign_id": "stand", "recognition_confidence": None}
    entry = _history_entry(quiz, names)
    assert entry["is_correct_sign"] and not entry["not_recognised"]
    print("history: low-confidence guess hidden, confident and quiz rows unchanged")


if __name__ == "__main__":
    test_real_signs_pass()
    test_still_clip_rejected()
    test_hands_never_visible_rejected()
    test_history_hides_low_confidence_guess()
    print("CAPTURE GATES TEST PASSED")
