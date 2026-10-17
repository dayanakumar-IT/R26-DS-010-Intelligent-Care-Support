"""
Visualise skeleton data extracted from a .npz file.

Shows animated skeleton with joints (dots) and bones (lines) — 14 joints.

Usage
-----
  # Show a webcam clip (subject 1, fall clip 001)
  python show_skeleton.py --npz "../Datasets/Webcam/webcam_mediapipe/fall/subject1_fall_001.npz"

  # Show a UR Fall clip
  python show_skeleton.py --npz "data/processed/ur_mediapipe/fall-01-cam0-rgb.npz"

  # Show any npz file and print joint info
  python show_skeleton.py --npz "path/to/file.npz" --info

Controls
--------
  SPACE  — pause / resume
  Q      — quit
  LEFT   — step back one frame
  RIGHT  — step forward one frame
"""
import argparse
import os
import sys
import time

import cv2
import numpy as np

# 14-joint bone connections
CONNECTIONS = [
    (0, 1),   # nose → neck
    (1, 2),   # neck → left shoulder
    (1, 3),   # neck → right shoulder
    (2, 4),   # left shoulder → left elbow
    (3, 5),   # right shoulder → right elbow
    (4, 6),   # left elbow → left wrist
    (5, 7),   # right elbow → right wrist
    (1, 8),   # neck → left hip
    (1, 9),   # neck → right hip
    (8, 9),   # left hip → right hip
    (8, 10),  # left hip → left knee
    (9, 11),  # right hip → right knee
    (10, 12), # left knee → left ankle
    (11, 13), # right knee → right ankle
]

JOINT_NAMES = [
    "Nose", "Neck",
    "L.Shoulder", "R.Shoulder",
    "L.Elbow", "R.Elbow",
    "L.Wrist", "R.Wrist",
    "L.Hip", "R.Hip",
    "L.Knee", "R.Knee",
    "L.Ankle", "R.Ankle",
]


def load_npz(path):
    data = np.load(path, allow_pickle=True)
    # Try common key names
    for key in ["keypoints", "joints", "skeleton", "data", "poses"]:
        if key in data:
            arr = data[key]
            print(f"[load] Key='{key}'  shape={arr.shape}")
            return arr
    # Fall back to first array
    key = list(data.keys())[0]
    arr = data[key]
    print(f"[load] Key='{key}' (auto)  shape={arr.shape}")
    return arr


def draw_frame(canvas, joints_2d, frame_idx, total_frames, paused):
    """Draw skeleton on canvas. joints_2d: (14, 2) normalised [0,1] coords."""
    H, W = canvas.shape[:2]

    # Convert normalised coords to pixels
    pts = {}
    for i, (x, y) in enumerate(joints_2d):
        if not (np.isnan(x) or np.isnan(y) or x == 0 and y == 0):
            pts[i] = (int(x * W), int(y * H))

    # Draw bones
    for a, b in CONNECTIONS:
        if a in pts and b in pts:
            cv2.line(canvas, pts[a], pts[b], (0, 220, 0), 2)

    # Draw joints
    for i, pt in pts.items():
        cv2.circle(canvas, pt, 6, (0, 80, 255), -1)
        cv2.circle(canvas, pt, 6, (255, 255, 255), 1)
        cv2.putText(canvas, str(i), (pt[0]+7, pt[1]-4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 200), 1)

    # Info overlay
    status = "PAUSED" if paused else "PLAYING"
    cv2.putText(canvas, f"Frame {frame_idx+1}/{total_frames}  [{status}]",
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv2.putText(canvas, "SPACE=pause  Q=quit  LEFT/RIGHT=step",
                (10, H-15), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1)

    detected = len(pts)
    color = (0, 200, 0) if detected >= 12 else (0, 140, 255) if detected >= 8 else (0, 0, 220)
    cv2.putText(canvas, f"Joints detected: {detected}/14",
                (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)


def play(arr, fps=15):
    """arr shape: (T, 14, 2) or (T, 14, 3) — normalised coords."""
    T = arr.shape[0]
    W, H = 640, 480
    frame_idx = 0
    paused = False
    delay = int(1000 / fps)

    print(f"[play] {T} frames  |  SPACE=pause  Q=quit  LEFT/RIGHT=step")

    while True:
        canvas = np.zeros((H, W, 3), dtype=np.uint8)
        joints_2d = arr[frame_idx, :, :2]  # take x,y only
        draw_frame(canvas, joints_2d, frame_idx, T, paused)

        cv2.imshow("Skeleton Viewer — 14 joints", canvas)
        key = cv2.waitKey(delay if not paused else 0) & 0xFF

        if key == ord("q") or key == ord("Q"):
            break
        elif key == ord(" "):
            paused = not paused
        elif key == 81 or key == ord("a"):  # LEFT arrow
            frame_idx = max(0, frame_idx - 1)
            paused = True
        elif key == 83 or key == ord("d"):  # RIGHT arrow
            frame_idx = min(T - 1, frame_idx + 1)
            paused = True

        if not paused:
            frame_idx = (frame_idx + 1) % T

    cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser(description="Visualise skeleton .npz file")
    parser.add_argument("--npz",  required=True, help="Path to .npz skeleton file")
    parser.add_argument("--fps",  type=int, default=15, help="Playback speed (default 15)")
    parser.add_argument("--info", action="store_true", help="Print joint stats and exit")
    args = parser.parse_args()

    if not os.path.exists(args.npz):
        print(f"[error] File not found: {args.npz}")
        sys.exit(1)

    arr = load_npz(args.npz)
    print(f"[info] Array shape: {arr.shape}  dtype: {arr.dtype}")

    # Reshape if needed: expect (T, 14, 2or3)
    if arr.ndim == 2:
        # Could be (T*14, 2) or (14, T) — try to detect
        if arr.shape[1] in (2, 3):
            T = arr.shape[0] // 14
            arr = arr[:T*14].reshape(T, 14, arr.shape[1])
            print(f"[reshape] Reshaped to {arr.shape}")
        elif arr.shape[0] == 14:
            arr = arr.T.reshape(-1, 14, 1)
            print(f"[reshape] Transposed to {arr.shape}")
    elif arr.ndim == 3 and arr.shape[1] != 14:
        # Maybe (T, 3, 14) — transpose
        if arr.shape[2] == 14:
            arr = arr.transpose(0, 2, 1)
            print(f"[reshape] Transposed to {arr.shape}")

    if args.info:
        print(f"\nJoint presence per frame (non-zero joints):")
        for t in range(min(5, arr.shape[0])):
            present = [i for i in range(14) if not (arr[t,i,0]==0 and arr[t,i,1]==0)]
            print(f"  Frame {t}: {len(present)}/14 joints — {[JOINT_NAMES[i] for i in present]}")
        return

    # Normalise to [0,1] if coords look like pixels
    if arr[:,:,:2].max() > 2.0:
        mx = arr[:,:,:2].max()
        arr = arr.astype(float)
        arr[:,:,0] /= mx
        arr[:,:,1] /= mx
        print(f"[norm] Pixel coords detected, normalised by {mx:.1f}")

    play(arr, fps=args.fps)


if __name__ == "__main__":
    main()
