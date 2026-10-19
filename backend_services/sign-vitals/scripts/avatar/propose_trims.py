"""
Propose a trim for long reference clips (MOTION files only; grading
references are never trimmed).

From the wrists in extracted/<sign>.json.gz it finds the active periods
(either wrist raised above its resting height, separated by >= MIN_REST
frames at rest) and proposes the first active period that contains a
sustained hand detection, plus a small margin. A clip signed twice keeps its
first performance; a clip signed once only loses the rest at its start and
end. (Wrist speed was tried first but small tracking jitter kept whole clips
"active"; wrist height separates rest from signing far more cleanly.)

    python propose_trims.py mouth sick pain
Writes frontend/.../assets/motion/trim_proposals.json (read by the review
page). bake.mjs applies a proposal only once the sign's trim is approved on
the review page (motion_qa.json: "trim": "approved").
"""

import gzip
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MOTION_DIR = os.path.normpath(os.path.join(HERE, "../../../../frontend/src/modules/sign-vitals/assets/motion"))
RAISE = 0.12              # wrist above its resting height by this much (image units) = signing
MIN_REST = 10             # frames of rest that separate two performances
MIN_HAND_RUN = 8          # frames of continuous hand detection inside a real performance
MARGIN = 5                # frames kept before/after the active period


def runs(mask):
    out, start = [], None
    for i, m in enumerate(mask):
        if m and start is None:
            start = i
        if not m and start is not None:
            out.append([start, i - 1])
            start = None
    if start is not None:
        out.append([start, len(mask) - 1])
    return out


def propose(sign):
    with gzip.open(os.path.join(HERE, "extracted", f"{sign}.json.gz"), "rt") as f:
        ex = json.load(f)
    frames = ex["frames"]
    T = len(frames)
    pose = np.array([fr["pose"] for fr in frames])[:, :, :2]
    # Image y grows downward, so "raised" = smaller y than the wrist's lowest (resting) position.
    raised = np.zeros(T, dtype=bool)
    for wrist in (15, 16):
        y = np.convolve(pose[:, wrist, 1], np.ones(3) / 3, mode="same")
        # A wrist below the frame (y > 1) is MediaPipe's guess and can jitter upwards; don't count it.
        raised |= ((np.percentile(y, 95) - y) > RAISE) & (y < 1.0)
    hand = [fr["left_hand"] is not None or fr["right_hand"] is not None for fr in frames]

    # Active periods, merging gaps shorter than MIN_REST.
    active = []
    for a, b in runs(raised):
        if active and a - active[-1][1] - 1 < MIN_REST:
            active[-1][1] = b
        else:
            active.append([a, b])
    hand_runs = [r for r in runs(hand) if r[1] - r[0] + 1 >= MIN_HAND_RUN]
    performances = [p for p in active if any(h[0] <= p[1] and h[1] >= p[0] for h in hand_runs)]
    if not performances:
        return {"sign": sign, "frames": T, "status": "no_proposal", "reason": "no active period with a visible hand"}

    first = performances[0]
    start, end = max(0, first[0] - MARGIN), min(T - 1, first[1] + MARGIN)
    return {
        "sign": sign,
        "frames": T,
        "fps": ex["fps"],
        "active_periods": performances,
        "proposed_range": [int(start), int(end)],
        "proposed_frames": int(end - start + 1),
        "reason": ("signed {} times; keeping the first performance".format(len(performances))
                   if len(performances) > 1 else "signed once; removing rest at the start and end"),
        "status": "pending_approval",
    }


def main(signs):
    out_path = os.path.join(MOTION_DIR, "trim_proposals.json")
    existing = json.load(open(out_path)) if os.path.exists(out_path) else {}
    for sign in signs:
        p = propose(sign)
        existing[sign] = p
        print(f"{sign:6s} {p['frames']} frames -> {p.get('proposed_range')} "
              f"({p.get('proposed_frames')} frames): {p.get('reason')}")
    with open(out_path, "w") as f:
        json.dump(existing, f, indent=2)


if __name__ == "__main__":
    main(sys.argv[1:] or ["mouth", "sick", "pain"])
