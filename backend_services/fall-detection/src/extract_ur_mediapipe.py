"""
Run MediaPipe Pose over the UR Fall Detection RGB image zips and dump
per-sequence 14-joint skeletons to `data/processed/ur_mediapipe/*.npz`.

Each zip in `adl_cam0/` and `fall_cam0/` contains one folder of ordered
PNG frames for one clip. For every clip we produce:

    <name>.npz
        arr_0   float32 (T, 14, 3)   # x, y, z(=0 for 2D)
        label   int                  # 0 NORMAL (adl) / 1 FALL

Notes
-----
* MediaPipe returns *normalised* image coordinates (x,y in [0,1]).
  We keep them as-is; downstream `apply_clip_normalization` re-anchors
  to the hip midpoint of frame 0 and divides by torso length so units
  become torso-lengths and are camera-invariant.
* z is set to 0.0 (2D-only). It is safe to feed the same 3-channel
  network with z=0 because `apply_clip_normalization` subtracts the
  frame-0 hip origin (which also has z=0) and the network is trained
  on similarly-normalised NTU sequences whose z is real. This is a
  known limitation and is why we still keep NTU as the primary dataset.
* Frames with no detected pose are dropped. Clips with fewer than
  30 valid frames are skipped entirely.
"""
import io
import os
import sys
import zipfile
from typing import Iterable

import numpy as np
import cv2

# MediaPipe imports lazily inside main() so `--help` etc. stay fast.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import (
    UR_ADL_CAM0_DIR,
    UR_FALL_CAM0_DIR,
    PROCESSED_DATA_DIR,
    MEDIAPIPE_JOINT_MAP,
    NUM_JOINTS,
    JOINT,
    CLASS_MAPPING,
)


OUTPUT_DIR = os.path.join(PROCESSED_DATA_DIR, "ur_mediapipe")


def _list_zips(folder: str) -> list[str]:
    if not os.path.isdir(folder):
        return []
    return sorted(
        os.path.join(folder, n)
        for n in os.listdir(folder)
        if n.endswith(".zip")
    )


def _iter_frames(zip_path: str) -> Iterable[np.ndarray]:
    """Yield decoded BGR frames from a UR RGB zip in filename order."""
    with zipfile.ZipFile(zip_path, "r") as z:
        pngs = sorted(n for n in z.namelist() if n.lower().endswith(".png"))
        for name in pngs:
            with z.open(name) as fh:
                buf = np.frombuffer(fh.read(), dtype=np.uint8)
            img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
            if img is not None:
                yield img


def _landmarks_to_14(lms) -> np.ndarray:
    """Map a MediaPipe Pose result (33 landmarks) to our (14, 4) layout.

    Columns: x, y, z, visibility.
    """
    out = np.zeros((NUM_JOINTS, 4), dtype=np.float32)
    for our_idx, mp_idx in MEDIAPIPE_JOINT_MAP.items():
        lm = lms[mp_idx]
        out[our_idx] = (lm.x, lm.y, lm.z, lm.visibility)
    # Neck = midpoint(L, R shoulder). Visibility = min of the two.
    ls = out[JOINT["l_shoulder"]]
    rs = out[JOINT["r_shoulder"]]
    out[JOINT["neck"], :3] = (ls[:3] + rs[:3]) / 2.0
    out[JOINT["neck"], 3] = min(ls[3], rs[3])
    return out


def process_zip(zip_path: str, label: int, pose) -> tuple[np.ndarray, int] | None:
    frames = []
    dropped = 0
    for img in _iter_frames(zip_path):
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        result = pose.process(rgb)
        if result.pose_landmarks is None:
            dropped += 1
            continue
        frames.append(_landmarks_to_14(result.pose_landmarks.landmark))

    if len(frames) < 30:
        print(f"  [skip] {os.path.basename(zip_path)}: only {len(frames)} valid frames (dropped {dropped})")
        return None
    arr = np.stack(frames, axis=0).astype(np.float32)
    print(f"  [ok]   {os.path.basename(zip_path)}: {arr.shape[0]} frames  (dropped {dropped})  label={label}")
    return arr, label


def run():
    import mediapipe as mp   # heavy import; do inside run()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    adl_zips  = _list_zips(UR_ADL_CAM0_DIR)
    fall_zips = _list_zips(UR_FALL_CAM0_DIR)

    print(f"[ur-mp] adl zips:  {len(adl_zips)}   fall zips: {len(fall_zips)}")
    if not (adl_zips or fall_zips):
        print(f"[ur-mp] no zips found. Expected: {UR_ADL_CAM0_DIR}, {UR_FALL_CAM0_DIR}")
        return

    with mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        enable_segmentation=False,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as pose:
        for zip_path in adl_zips:
            name = os.path.splitext(os.path.basename(zip_path))[0]
            out_path = os.path.join(OUTPUT_DIR, f"{name}.npz")
            if os.path.exists(out_path):
                continue
            res = process_zip(zip_path, CLASS_MAPPING["NORMAL"], pose)
            if res is None:
                continue
            arr, label = res
            np.savez(out_path, arr, label=label)

        for zip_path in fall_zips:
            name = os.path.splitext(os.path.basename(zip_path))[0]
            out_path = os.path.join(OUTPUT_DIR, f"{name}.npz")
            if os.path.exists(out_path):
                continue
            res = process_zip(zip_path, CLASS_MAPPING["FALL"], pose)
            if res is None:
                continue
            arr, label = res
            np.savez(out_path, arr, label=label)

    n = len([f for f in os.listdir(OUTPUT_DIR) if f.endswith(".npz")])
    print(f"[ur-mp] wrote {n} sequences to {OUTPUT_DIR}")


if __name__ == "__main__":
    run()
