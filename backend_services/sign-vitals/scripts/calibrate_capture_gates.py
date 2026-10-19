"""
scripts/calibrate_capture_gates.py
Prints the hand-presence and movement values that real (fluent) signs
produce, so the cut-offs in capture_gates.py can be checked against data.

Sources (both shipped in gloss_assets/):
  - reference_exemplars.npz: the 59 DTW reference signs (normalized only,
    so movement only — no raw detections to measure hand presence on);
  - pipeline_parity.npz: 10 full test-set attempts (raw + normalized).

Run with .venv's python:
    python scripts/calibrate_capture_gates.py
"""

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import capture_gates  # noqa: E402
from recogniser import ASSETS_DIR  # noqa: E402


def main():
    refs = np.load(os.path.join(ASSETS_DIR, "reference_exemplars.npz"))
    ref_motion = {k: capture_gates.motion_extent(refs[k].reshape(-1, 49, 3)) for k in refs.files}

    parity = np.load(os.path.join(ASSETS_DIR, "pipeline_parity.npz"))
    par_presence, par_motion = [], []
    for i in range(10):
        par_presence.append(capture_gates.hand_presence_fraction(parity[f"raw_{i}"]))
        par_motion.append(capture_gates.motion_extent(parity[f"normalized_{i}"]))

    lowest = sorted(ref_motion.items(), key=lambda kv: kv[1])[:5]
    print(f"reference signs (n={len(ref_motion)}) motion_extent: "
          f"min={min(ref_motion.values()):.3f} median={np.median(list(ref_motion.values())):.3f}")
    print("  lowest five:", ", ".join(f"{k}={v:.3f}" for k, v in lowest))
    print(f"parity attempts (n=10) motion_extent: min={min(par_motion):.3f} median={np.median(par_motion):.3f}")
    print(f"parity attempts (n=10) hand_presence: min={min(par_presence):.3f} median={np.median(par_presence):.3f}")
    print(f"current cut-offs: MIN_HAND_PRESENCE={capture_gates.MIN_HAND_PRESENCE} "
          f"MIN_MOTION_EXTENT={capture_gates.MIN_MOTION_EXTENT}")

    rejected = [k for k, v in ref_motion.items() if v < capture_gates.MIN_MOTION_EXTENT]
    rejected += [f"parity_{i}" for i in range(10)
                 if par_motion[i] < capture_gates.MIN_MOTION_EXTENT
                 or par_presence[i] < capture_gates.MIN_HAND_PRESENCE]
    print("real signs the gates would reject:", rejected or "none")


if __name__ == "__main__":
    main()
