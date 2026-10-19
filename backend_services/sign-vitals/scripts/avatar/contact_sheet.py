"""
Contact sheet per sign: source video frame vs the baked skeleton (the
committed direct-solver file, and the kalidokit evidence bake if present) at the start, middle and end of
the signing (first/last frame with a hand detected).

    python contact_sheet.py hello please angry help
Writes contact_sheets/<sign>.png (gitignored: contains dataset video frames).
"""

import gzip
import json
import os
import sys

import cv2
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
MOTION_DIR = os.path.normpath(os.path.join(HERE, "../../../../frontend/src/modules/sign-vitals/assets/motion"))
with open(os.path.join(MOTION_DIR, "standard_skeleton.json")) as f:
    SKELETON = json.load(f)["bones"]


def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return np.array([aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
                     aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz])


def qrot(q, v):
    p = qmul(qmul(q, np.array([*v, 0.0])), q * np.array([-1, -1, -1, 1]))
    return p[:3]


def fk(motion, t):
    pos, world = {}, {}
    for name, parent, off in SKELETON:
        q = np.array(motion["bones"].get(name, [[0, 0, 0, 1]] * motion["frames"])[t], dtype=float)
        if parent is None:
            pos[name], world[name] = np.array(off, dtype=float), q
        else:
            pos[name] = pos[parent] + qrot(world[parent], off)
            world[name] = qmul(world[parent], q)
    return pos, world


def draw_skeleton(ax, motion, t, title):
    pos, world = fk(motion, t)
    for name, parent, off in SKELETON:
        colour = "tab:orange" if name.startswith("right") else "tab:blue" if name.startswith("left") else "0.3"
        if parent:
            a, b = pos[parent], pos[name]
            ax.plot([a[0], b[0]], [a[1], b[1]], color=colour, lw=1.2)
        if name.endswith("Distal"):
            tip = pos[name] + qrot(world[name], np.array(off) * 0.8)
            ax.plot([pos[name][0], tip[0]], [pos[name][1], tip[1]], color=colour, lw=1.2)
    head = pos["head"] + qrot(world["head"], [0, 0.08, 0])
    ax.add_patch(plt.Circle((head[0], head[1]), 0.09, fill=False, color="0.3"))
    nose = head + qrot(world["head"], [0, 0, 0.15])
    ax.plot([head[0], nose[0]], [head[1], nose[1]], color="goldenrod", lw=1.5)
    ax.set_xlim(-0.75, 0.75)
    ax.set_ylim(0.75, 1.85)
    ax.set_aspect("equal")
    ax.set_xticks([])
    ax.set_yticks([])
    ax.set_title(title, fontsize=8)


def frame_image(video, idx):
    cap = cv2.VideoCapture(video)
    cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
    ok, bgr = cap.read()
    cap.release()
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB) if ok else None


def main(signs):
    os.makedirs(os.path.join(HERE, "contact_sheets"), exist_ok=True)
    for sign in signs:
        with gzip.open(os.path.join(HERE, "extracted", f"{sign}.json.gz"), "rt") as f:
            ex = json.load(f)
        detected = [i for i, fr in enumerate(ex["frames"]) if fr["left_hand"] or fr["right_hand"]]
        first, last = (detected[0], detected[-1]) if detected else (0, len(ex["frames"]) - 1)
        picks = [("start", first), ("middle", (first + last) // 2), ("end", last)]

        variants = [("direct (committed)", os.path.join(MOTION_DIR, f"{sign}.json")),
                    ("kalidokit (evidence)", os.path.join(MOTION_DIR, "_review", f"{sign}.kalidokit.json"))]
        variants = [(n, json.load(open(p))) for n, p in variants if os.path.exists(p)]
        video = next(os.path.join(HERE, "videos", v) for v in os.listdir(os.path.join(HERE, "videos"))
                     if v.startswith(sign + "__"))

        fig, axes = plt.subplots(len(picks), 1 + len(variants), figsize=(3.2 * (1 + len(variants)), 3 * len(picks)))
        for r, (label, t) in enumerate(picks):
            img = frame_image(video, ex["frames"][t]["frame"])
            axes[r][0].imshow(img)
            axes[r][0].set_xticks([])
            axes[r][0].set_yticks([])
            axes[r][0].set_title(f"{label}: video frame {t}", fontsize=8)
            for c, (name, motion) in enumerate(variants, start=1):
                draw_skeleton(axes[r][c], motion, t, f"{name} skeleton, frame {t}")
        fig.suptitle(f"{sign} ({ex['source']['video_id']}): orange = signer's right, blue = left; "
                     f"viewer faces the signer", fontsize=9)
        fig.tight_layout()
        out = os.path.join(HERE, "contact_sheets", f"{sign}.png")
        fig.savefig(out, dpi=110)
        plt.close(fig)
        print(f"{sign}: frames {first}/{(first + last) // 2}/{last} -> {os.path.relpath(out, HERE)}")


if __name__ == "__main__":
    main(sys.argv[1:] or ["hello", "please", "angry", "help"])
