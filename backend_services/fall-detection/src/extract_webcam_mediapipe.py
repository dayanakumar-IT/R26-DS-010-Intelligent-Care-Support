"""
Run MediaPipe Pose over in-house webcam .mp4 clips and dump per-clip
14-joint skeletons to `data/processed/webcam_mediapipe/*.npz`.

Reads from:
    Datasets/Webcam/raw_videos/fall/subject*_fall_*.mp4
    Datasets/Webcam/raw_videos/normal/subject*_normal_*.mp4

Each clip produces:
    <name>.npz
        arr_0   float32 (T, 14, 4)   # x, y, z, visibility
        label   int                  # 0=NORMAL  1=FALL
        subject int                  # parsed from filename

Usage
-----
    python -m src.extract_webcam_mediapipe
    python -m src.extract_webcam_mediapipe --overwrite
"""
from __future__ import annotations

import argparse
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import (
    DATASET_DIR,
    PROCESSED_DATA_DIR,
    MEDIAPIPE_JOINT_MAP,
    NUM_JOINTS,
    JOINT,
    CLASS_MAPPING,
)

RAW_DIR     = os.path.join(DATASET_DIR, "Webcam", "raw_videos")
OUTPUT_DIR  = os.path.join(PROCESSED_DATA_DIR, "webcam_mediapipe")
SKEL_VID_DIR = os.path.join(PROCESSED_DATA_DIR, "skeleton_videos")
MIN_FRAMES  = 30

CONNECTIONS = [
    (0,1),(1,2),(1,3),(2,4),(3,5),(4,6),(5,7),
    (1,8),(1,9),(8,9),(8,10),(9,11),(10,12),(11,13),
]


def _list_mp4s(folder: str) -> list[str]:
    if not os.path.isdir(folder):
        return []
    return sorted(
        os.path.join(folder, n)
        for n in os.listdir(folder)
        if n.lower().endswith(".mp4")
    )


def _parse_subject(filename: str) -> int:
    """Extract subject number from 'subject3_fall_001.mp4' → 3."""
    try:
        return int(filename.split("subject")[1].split("_")[0])
    except Exception:
        return 0


def _landmarks_to_14(lms) -> np.ndarray:
    """Map MediaPipe 33-landmark result to (14, 4) layout [x, y, z, vis]."""
    out = np.zeros((NUM_JOINTS, 4), dtype=np.float32)
    for our_idx, mp_idx in MEDIAPIPE_JOINT_MAP.items():
        lm = lms[mp_idx]
        out[our_idx] = (lm.x, lm.y, lm.z, lm.visibility)
    ls = out[JOINT["l_shoulder"]]
    rs = out[JOINT["r_shoulder"]]
    out[JOINT["neck"], :3] = (ls[:3] + rs[:3]) / 2.0
    out[JOINT["neck"], 3]  = min(ls[3], rs[3])
    return out


def _save_skeleton_video(arr: np.ndarray, name: str, label_str: str, fps: float = 30.0):
    """Render skeleton frames from npz array to a .mp4 video."""
    os.makedirs(SKEL_VID_DIR, exist_ok=True)
    out_path = os.path.join(SKEL_VID_DIR, f"{name}_skeleton.mp4")
    W, H = 480, 640
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(out_path, fourcc, fps, (W, H))

    label_color = (0, 0, 220) if label_str == "fall" else (0, 180, 0)

    for t in range(arr.shape[0]):
        canvas = np.zeros((H, W, 3), dtype=np.uint8)
        joints = arr[t, :, :2]  # x, y normalised 0-1
        pts = {}
        for i, (x, y) in enumerate(joints):
            if x > 0 or y > 0:
                pts[i] = (int(x * W), int(y * H))
        for a, b in CONNECTIONS:
            if a in pts and b in pts:
                cv2.line(canvas, pts[a], pts[b], (0, 220, 80), 2)
        for i, pt in pts.items():
            cv2.circle(canvas, pt, 6, (0, 100, 255), -1)
            cv2.circle(canvas, pt, 6, (255, 255, 255), 1)
        cv2.putText(canvas, f"{name}  frame {t+1}/{arr.shape[0]}",
                    (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)
        cv2.putText(canvas, label_str.upper(), (10, H - 15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, label_color, 2)
        writer.write(canvas)

    writer.release()
    print(f"  [skel-vid] saved → {os.path.basename(out_path)}")


def process_clip(video_path: str, label: int, pose) -> tuple | None:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"  [skip] Cannot open: {video_path}")
        return None

    frames  = []
    dropped = 0

    while True:
        ok, bgr = cap.read()
        if not ok:
            break
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        res = pose.process(rgb)
        if res.pose_landmarks is None:
            dropped += 1
        else:
            frames.append(_landmarks_to_14(res.pose_landmarks.landmark))

    cap.release()

    if len(frames) < MIN_FRAMES:
        print(f"  [skip] {os.path.basename(video_path)}: "
              f"only {len(frames)} valid frames (dropped {dropped})")
        return None

    arr = np.stack(frames, axis=0).astype(np.float32)
    print(f"  [ok]   {os.path.basename(video_path)}: "
          f"{arr.shape[0]} frames  dropped={dropped}  label={label}")
    return arr, label


def run(overwrite: bool = False):
    import mediapipe as mp

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    fall_dir   = os.path.join(RAW_DIR, "fall")
    normal_dir = os.path.join(RAW_DIR, "normal")

    fall_clips   = _list_mp4s(fall_dir)
    normal_clips = _list_mp4s(normal_dir)

    print(f"[webcam-mp] fall clips: {len(fall_clips)}   "
          f"normal clips: {len(normal_clips)}")
    if not fall_clips and not normal_clips:
        print(f"[webcam-mp] No .mp4 files found under {RAW_DIR}")
        print(f"            Record clips first:  python record_clip.py --subject 1 --label fall")
        return

    with mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        enable_segmentation=False,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as pose:
        for label_str, clips, label_int in [
            ("fall",   fall_clips,   CLASS_MAPPING["FALL"]),
            ("normal", normal_clips, CLASS_MAPPING["NORMAL"]),
        ]:
            print(f"\n-- {label_str} --")
            for clip_path in clips:
                name     = os.path.splitext(os.path.basename(clip_path))[0]
                out_path = os.path.join(OUTPUT_DIR, f"{name}.npz")
                if os.path.exists(out_path) and not overwrite:
                    print(f"  [skip] {name}.npz already exists")
                    continue
                subject = _parse_subject(os.path.basename(clip_path))
                res = process_clip(clip_path, label_int, pose)
                if res is None:
                    continue
                arr, lbl = res
                np.savez(out_path, arr, label=lbl, subject=subject)
                _save_skeleton_video(arr, name, label_str)

    n = len([f for f in os.listdir(OUTPUT_DIR) if f.endswith(".npz")])
    print(f"\n[webcam-mp] wrote {n} sequences to {OUTPUT_DIR}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract MediaPipe skeletons from webcam .mp4 clips.")
    parser.add_argument("--overwrite", action="store_true",
                        help="Re-process clips that already have a .npz")
    args = parser.parse_args()
    run(overwrite=args.overwrite)
