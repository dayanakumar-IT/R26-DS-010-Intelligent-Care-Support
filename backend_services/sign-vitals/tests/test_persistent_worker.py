"""
tests/test_persistent_worker.py
GLOSS component — the long-running MediaPipe worker gives EXACTLY the same
landmarks as the one-shot worker (same mediapipe 0.10.14, same Holistic
settings, a fresh Holistic per video):

  - byte-identical arrays (NaN positions included) on every test video;
  - order does not matter: the first video, run again after the others in
    the same long-running process, is still identical (no carried state).

Videos: the reference videos (dev review folder, gitignored) when present,
otherwise any .mp4 in tests/videos/ or test_samples/.

Run with .venv's python:
    python tests/test_persistent_worker.py
"""

import glob
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import numpy as np  # noqa: E402

import extract_landmarks_bridge as bridge  # noqa: E402

REVIEW = os.path.join(ROOT, "..", "..", "frontend", "src", "modules", "sign-vitals", "assets", "motion", "_review", "videos")
VIDEOS = (sorted(glob.glob(os.path.join(REVIEW, "*.mp4")))[:6]
          or sorted(glob.glob(os.path.join(ROOT, "test_samples", "*.mp4")))[:6])


def test_identical_landmarks():
    assert VIDEOS, "no test videos found"
    one_shot = {v: bridge._extract_one_shot(v) for v in VIDEOS}
    persistent = {v: bridge._extract_persistent(v, None) for v in VIDEOS}
    again = bridge._extract_persistent(VIDEOS[0], None)       # after the others, same process
    for v in VIDEOS:
        a, b = one_shot[v], persistent[v]
        assert a.shape == b.shape and np.array_equal(a, b, equal_nan=True), os.path.basename(v)
    assert np.array_equal(one_shot[VIDEOS[0]], again, equal_nan=True), "state carried over between videos"
    print(f"  {len(VIDEOS)} videos ({sum(a.shape[0] for a in one_shot.values())} frames): long-running == one-shot, byte for byte")


if __name__ == "__main__":
    try:
        test_identical_landmarks()
        print("PERSISTENT WORKER TEST PASSED")
    finally:
        bridge._worker.stop()
