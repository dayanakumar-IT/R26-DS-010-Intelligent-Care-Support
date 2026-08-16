"""
Render 14-joint skeleton sequences as MP4 stick-figure animations.

Used by build_demo_predictions.py to produce one MP4 per demo patient.
Works for both UR and NTU sequences because both end up in the same
14-joint Common-Joint format on disk.

Joint indices (must match Codes/models/stgcn/graph.py):
    0 head
    1 left_shoulder   2 right_shoulder
    3 left_elbow      4 right_elbow
    5 left_wrist      6 right_wrist
    7 left_hip        8 right_hip
    9 left_knee      10 right_knee
   11 left_ankle     12 right_ankle
   13 spine
"""

from __future__ import annotations
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio.v2 as imageio


EDGES = [
    (13, 0), (13, 1), (13, 2), (13, 7), (13, 8),
    (1, 3), (3, 5), (2, 4), (4, 6),
    (7, 9), (9, 11), (8, 10), (10, 12),
]

LEFT_JOINTS = {1, 3, 5, 7, 9, 11}
RIGHT_JOINTS = {2, 4, 6, 8, 10, 12}

CANVAS_W, CANVAS_H = 360, 360
BG = (24, 30, 46)
BONE_COLOR = (230, 235, 245)
LEFT_COLOR = (96, 165, 250)     # blue
RIGHT_COLOR = (52, 211, 153)    # green
SPINE_COLOR = (250, 204, 21)    # yellow
JOINT_RADIUS = 4
BONE_WIDTH = 3


def _normalize_to_canvas(seq: np.ndarray) -> np.ndarray:
    """Map skeleton coords to canvas pixels.
    Input shape: (T, 14, 3) or (T, 14, 2). Uses (x, y) only.
    Returns: (T, 14, 2) int pixel coords.

    Auto-detects the source Y convention so head always renders at the top
    of the canvas:
      • NTU world coords (Y up):   head_y > ankle_y in source → invert Y
      • UR  MediaPipe (Y down):    head_y < ankle_y in source → keep Y
    """
    pts = seq[..., :2].astype(np.float32)   # (T, 14, 2)
    head_y = pts[:, 0, 1].mean()
    ankle_y = pts[:, [11, 12], 1].mean()
    y_is_up = head_y > ankle_y    # source uses Y-up if head is "higher" than ankles

    x_min, x_max = pts[..., 0].min(), pts[..., 0].max()
    y_min, y_max = pts[..., 1].min(), pts[..., 1].max()
    w = x_max - x_min if x_max > x_min else 1.0
    h = y_max - y_min if y_max > y_min else 1.0
    scale = 0.78 * min(CANVAS_W / w, CANVAS_H / h)

    cx = (x_min + x_max) / 2
    cy = (y_min + y_max) / 2

    out = np.zeros_like(pts)
    out[..., 0] = (pts[..., 0] - cx) * scale + CANVAS_W / 2
    if y_is_up:
        out[..., 1] = (cy - pts[..., 1]) * scale + CANVAS_H / 2   # NTU: flip Y
    else:
        out[..., 1] = (pts[..., 1] - cy) * scale + CANVAS_H / 2   # UR:  keep Y
    return out.astype(np.int32)


def _draw_frame(coords_2d: np.ndarray, label: str = "") -> np.ndarray:
    """coords_2d: (14, 2) int pixel coords. Returns RGB ndarray."""
    img = Image.new("RGB", (CANVAS_W, CANVAS_H), BG)
    draw = ImageDraw.Draw(img)

    # Bones
    for a, b in EDGES:
        x1, y1 = int(coords_2d[a, 0]), int(coords_2d[a, 1])
        x2, y2 = int(coords_2d[b, 0]), int(coords_2d[b, 1])
        # Colour the bone by which side it connects to
        if a in LEFT_JOINTS or b in LEFT_JOINTS:
            color = LEFT_COLOR
        elif a in RIGHT_JOINTS or b in RIGHT_JOINTS:
            color = RIGHT_COLOR
        else:
            color = SPINE_COLOR
        draw.line([(x1, y1), (x2, y2)], fill=color, width=BONE_WIDTH)

    # Joints
    for i in range(14):
        x, y = int(coords_2d[i, 0]), int(coords_2d[i, 1])
        if i == 0:                         # head — bigger circle
            r = JOINT_RADIUS + 4
        elif i in LEFT_JOINTS:
            r = JOINT_RADIUS
        elif i in RIGHT_JOINTS:
            r = JOINT_RADIUS
        else:
            r = JOINT_RADIUS + 2
        draw.ellipse([(x - r, y - r), (x + r, y + r)],
                     fill=(245, 245, 250), outline=BONE_COLOR)

    if label:
        try:
            font = ImageFont.truetype("arial.ttf", 14)
        except OSError:
            font = ImageFont.load_default()
        draw.text((10, 8), label, fill=(210, 220, 235), font=font)

    return np.asarray(img)


def render_skeleton_mp4(npy_path: Path, out_path: Path, label: str = "",
                        fps: int = 25) -> None:
    """Read a (T, 14, 3) sequence and render an MP4 stick-figure animation."""
    seq = np.load(npy_path)
    if seq.ndim != 3 or seq.shape[1] != 14:
        raise ValueError(f"{npy_path}: expected (T, 14, 3), got {seq.shape}")
    px = _normalize_to_canvas(seq)
    frames = [_draw_frame(px[t], label=label) for t in range(seq.shape[0])]

    with imageio.get_writer(str(out_path), fps=fps,
                            codec="libx264", quality=8,
                            macro_block_size=1) as w:
        for fr in frames:
            w.append_data(fr)


if __name__ == "__main__":
    # Quick test: render the first UR sequence we can find
    import sys
    repo = Path(__file__).resolve().parents[2]
    test = next((repo / "outputs" / "Common_Joint_Sequences" / "UR")
                .glob("**/*.npy"))
    out = repo / "outputs" / "demo_videos" / "_skeleton_test.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    render_skeleton_mp4(test, out, label=test.stem)
    print(f"Wrote {out}")
