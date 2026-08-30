"""
Webcam clip recorder for in-house data collection.

Controls
--------
  R       — start recording current clip
  S       — stop recording and save clip
  Q       — quit

Usage
-----
  python record_clip.py --subject 1 --label fall
  python record_clip.py --subject 1 --label normal
  python record_clip.py --subject 2 --label fall --camera 1

Output
------
  Datasets/Webcam/raw_videos/fall/subject1_fall_001.mp4
  Datasets/Webcam/raw_videos/normal/subject1_normal_001.mp4

Tips
----
  * Press R only when the subject is in position and ready.
  * Press S immediately after the action ends (don't let the clip run long).
  * Each clip should be 8–12 seconds.
  * The live preview shows a skeleton overlay so you can verify MediaPipe
    is detecting the body before you start recording.
"""
import argparse
import os
import sys
import time

import cv2
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR  = os.path.join(
    os.path.dirname(BASE_DIR), "Datasets", "Webcam", "raw_videos"
)

# ── MediaPipe joint drawing (for live preview only) ──────────────────────────
CONNECTIONS = [
    (0,1),(1,2),(1,3),(2,4),(3,5),(4,6),(5,7),
    (1,8),(1,9),(8,9),(8,10),(9,11),(10,12),(11,13),
]

def _draw_skeleton(frame, landmarks, h, w):
    if landmarks is None:
        return
    pts = {}
    for i, lm in enumerate(landmarks.landmark):
        pts[i] = (int(lm.x * w), int(lm.y * h))

    mp_to_14 = {0:0,11:2,12:3,13:4,14:5,15:6,16:7,23:8,24:9,25:10,26:11,27:12,28:13}
    joints14 = {}
    for our, mp in mp_to_14.items():
        joints14[our] = pts.get(mp, None)
    # neck = midpoint shoulders
    if joints14.get(2) and joints14.get(3):
        joints14[1] = (
            (joints14[2][0]+joints14[3][0])//2,
            (joints14[2][1]+joints14[3][1])//2,
        )

    for a, b in CONNECTIONS:
        if joints14.get(a) and joints14.get(b):
            cv2.line(frame, joints14[a], joints14[b], (0,255,0), 2)
    for pt in joints14.values():
        if pt:
            cv2.circle(frame, pt, 5, (0,100,255), -1)


def _next_clip_index(out_dir: str, subject: int, label: str) -> int:
    prefix = f"subject{subject}_{label}_"
    existing = [f for f in os.listdir(out_dir) if f.startswith(prefix)]
    return len(existing) + 1


def record(subject: int, label: str, camera: int):
    import mediapipe as mp

    out_dir = os.path.join(RAW_DIR, label)
    os.makedirs(out_dir, exist_ok=True)

    cap = cv2.VideoCapture(camera)
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT,  720)
    cap.set(cv2.CAP_PROP_FPS, 30)

    if not cap.isOpened():
        print(f"[record] Cannot open camera {camera}")
        sys.exit(1)

    fps    = cap.get(cv2.CAP_PROP_FPS) or 30
    w      = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h      = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")

    recording   = False
    writer      = None
    clip_frames = 0
    clip_index  = _next_clip_index(out_dir, subject, label)
    clip_path   = None

    print(f"\n[record] Subject={subject}  Label={label}  Camera={camera}")
    print(f"[record] Output dir: {out_dir}")
    print(f"[record] Controls:  R=record  S=stop+save  Q=quit\n")

    with mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as pose:
        while True:
            ok, frame = cap.read()
            if not ok:
                continue

            display = frame.copy()

            # MediaPipe skeleton overlay on preview
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            res = pose.process(rgb)
            _draw_skeleton(display, res.pose_landmarks, h, w)

            # Status overlay
            status_color = (0, 0, 255) if recording else (200, 200, 200)
            status_text  = f"RECORDING clip {clip_index}" if recording \
                           else f"READY  next clip: {clip_index}"
            cv2.putText(display, status_text, (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, status_color, 2)
            cv2.putText(display, f"Subject {subject} | {label.upper()}",
                        (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)
            if recording:
                cv2.putText(display, f"Frames: {clip_frames}",
                            (20, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.7,
                            (0,0,255), 2)
                cv2.circle(display, (w-40, 40), 15, (0,0,255), -1)

            cv2.imshow("Fall Risk — Clip Recorder  (R=record  S=stop  Q=quit)",
                       display)

            if recording and writer:
                writer.write(frame)
                clip_frames += 1

            key = cv2.waitKey(1) & 0xFF

            if key == ord("r") or key == ord("R"):
                if not recording:
                    clip_path = os.path.join(
                        out_dir, f"subject{subject}_{label}_{clip_index:03d}.mp4")
                    writer      = cv2.VideoWriter(clip_path, fourcc, fps, (w, h))
                    recording   = True
                    clip_frames = 0
                    print(f"[record] ● Recording → {os.path.basename(clip_path)}")

            elif key == ord("s") or key == ord("S"):
                if recording and writer:
                    writer.release()
                    writer    = None
                    recording = False
                    print(f"[record] ■ Saved: {clip_path}  ({clip_frames} frames, "
                          f"{clip_frames/fps:.1f}s)")
                    clip_index += 1
                    clip_path   = None
                    clip_frames = 0

            elif key == ord("q") or key == ord("Q"):
                if recording and writer:
                    writer.release()
                    print(f"[record] Clip discarded on quit.")
                break

    cap.release()
    cv2.destroyAllWindows()
    print(f"\n[record] Done. {clip_index-1} clips saved to {out_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Record webcam clips for fall detection.")
    parser.add_argument("--subject", type=int, required=True, help="Subject number e.g. 1")
    parser.add_argument("--label",   choices=["fall","normal"], required=True)
    parser.add_argument("--camera",  type=int, default=0, help="Camera index (default 0)")
    args = parser.parse_args()
    record(args.subject, args.label, args.camera)
