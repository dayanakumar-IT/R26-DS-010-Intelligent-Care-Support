"""
Offline video analyser — panel requirement:
  "Uploaded video should be converted to skeleton and analysed."

Usage
-----
    cd backend
    python offline_analyse.py --video path/to/video.mp4
    python offline_analyse.py --video path/to/video.mp4 --suffix _webcam
    python offline_analyse.py --video path/to/video.mp4 --out results.json

Output
------
  - Console: window-by-window risk scores + summary
  - JSON:    full results saved to --out path
  - MP4:     skeleton-only privacy video saved alongside input
"""
import argparse
import json
import os
import sys
import time
import warnings
warnings.filterwarnings("ignore")

import cv2
import numpy as np
import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import (
    MODELS_DIR, TARGET_FRAMES, NUM_JOINTS,
    MEDIAPIPE_JOINT_MAP, JOINT, FEATURE_DISPLAY_NAMES,
)
from src.data_processor import DataProcessor
from src.features import FeatureExtractor
from src.models.stgcn import SkeletalSTGCN
from src.models.fusion import LateFusionNetwork
from src.postprocess import RiskPostProcessor
from src.context_engine import ContextEngine
from src.data_splits import load_scaler

CONNECTIONS = [
    (0,1),(1,2),(1,3),(2,4),(3,5),(4,6),(5,7),
    (1,8),(1,9),(8,9),(8,10),(9,11),(10,12),(11,13),
]
INFER_EVERY_N   = 3
MIN_BUFFER_FILL = 0.5


def extract_14_joints(landmarks):
    out = np.zeros((NUM_JOINTS, 4), dtype=np.float32)
    for our_idx, mp_idx in MEDIAPIPE_JOINT_MAP.items():
        lm = landmarks[mp_idx]
        out[our_idx] = (lm.x, lm.y, lm.z, lm.visibility)
    ls = out[JOINT["l_shoulder"]]
    rs = out[JOINT["r_shoulder"]]
    out[JOINT["neck"], :3] = (ls[:3] + rs[:3]) / 2.0
    out[JOINT["neck"],  3] = min(ls[3], rs[3])
    return out


def draw_skeleton(frame, joints, h, w):
    pts = {}
    for i, (x, y, *_) in enumerate(joints):
        if x > 0 or y > 0:
            pts[i] = (int(x * w), int(y * h))
    for a, b in CONNECTIONS:
        if a in pts and b in pts:
            cv2.line(frame, pts[a], pts[b], (0, 220, 80), 2)
    for pt in pts.values():
        cv2.circle(frame, pt, 5, (0, 100, 255), -1)
        cv2.circle(frame, pt, 5, (255, 255, 255), 1)


def main(video_path: str, suffix: str = "", out_path: str = None):
    import mediapipe as mp

    if not os.path.exists(video_path):
        print(f"[error] Video not found: {video_path}")
        sys.exit(1)

    print("=" * 55)
    print("  OFFLINE VIDEO ANALYSER — Fall Risk Detection")
    print(f"  Video  : {os.path.basename(video_path)}")
    print(f"  Suffix : {suffix or '(default)'}")
    print("=" * 55)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    scaler = load_scaler(suffix)

    stgcn = SkeletalSTGCN().to(device).eval()
    stgcn.load_state_dict(torch.load(
        os.path.join(MODELS_DIR, f"stgcn_best{suffix}.pth"),
        map_location=device, weights_only=True))

    fusion = LateFusionNetwork().to(device).eval()
    fusion.load_state_dict(torch.load(
        os.path.join(MODELS_DIR, f"fusion_best{suffix}.pth"),
        map_location=device, weights_only=True))

    dp       = DataProcessor()
    feat_ex  = FeatureExtractor()
    postproc = RiskPostProcessor()
    context  = ContextEngine()

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    W   = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H   = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Skeleton-only output video (privacy preserving)
    base      = os.path.splitext(video_path)[0]
    skel_path = base + "_skeleton.mp4"
    writer    = cv2.VideoWriter(
        skel_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (W, H))

    print(f"  Resolution : {W}x{H}  FPS={fps:.1f}  Frames={total_frames}")
    print(f"  Skeleton video → {skel_path}")
    print()

    buffer      = []
    frame_count = 0
    windows     = []
    last_joints = None

    with mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as pose:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            res = pose.process(rgb)

            if res.pose_landmarks:
                joints = extract_14_joints(res.pose_landmarks.landmark)
                buffer.append(joints)
                last_joints = joints
                if len(buffer) > TARGET_FRAMES:
                    buffer.pop(0)

            frame_count += 1
            t_sec = frame_count / fps

            # Skeleton-only saved frame
            skel_frame = np.zeros((H, W, 3), dtype="uint8")
            if last_joints is not None:
                draw_skeleton(skel_frame, last_joints, H, W)
            writer.write(skel_frame)

            # Run inference every INFER_EVERY_N frames
            if (frame_count % INFER_EVERY_N == 0
                    and len(buffer) >= int(TARGET_FRAMES * MIN_BUFFER_FILL)):

                arr  = np.stack(buffer, axis=0)
                arr  = dp.apply_clip_normalization(arr)
                arr  = dp.enforce_temporal_uniformity(arr, TARGET_FRAMES)
                feats = feat_ex.extract_sequence_features(arr)
                if scaler is not None:
                    feats = scaler.transform(feats.reshape(1, -1)).flatten()

                with torch.no_grad():
                    x      = torch.tensor(arr[np.newaxis], dtype=torch.float32).to(device)
                    emb    = stgcn(x, extract_embedding=True)
                    f_t    = torch.tensor(feats[np.newaxis], dtype=torch.float32).to(device)
                    logits = fusion(emb, f_t)
                    raw_score = torch.softmax(logits, dim=1)[0, 1].item()

                # Zone modifier
                if last_joints is not None:
                    ctx = context.update(last_joints, t_sec)
                    adjusted = float(np.clip(raw_score + ctx.zone_modifier, 0.0, 1.0))
                    posture  = ctx.posture
                else:
                    adjusted = raw_score
                    posture  = "UNKNOWN"

                state = postproc.update(adjusted, t_sec)

                window_result = {
                    "t_sec":      round(t_sec, 2),
                    "frame":      frame_count,
                    "risk_score": round(raw_score, 4),
                    "adjusted":   round(adjusted, 4),
                    "risk_level": state.level,
                    "posture":    posture,
                }
                windows.append(window_result)

                bar = "█" * int(raw_score * 20)
                print(f"  t={t_sec:6.1f}s  [{bar:<20}] {int(raw_score*100):3d}%  "
                      f"{state.level:<8}  {posture}")

    cap.release()
    writer.release()

    # Summary
    if not windows:
        print("\n[warn] No inference windows — video too short or no person detected.")
        return

    scores     = [w["risk_score"] for w in windows]
    peak       = max(windows, key=lambda w: w["risk_score"])
    levels     = [w["risk_level"] for w in windows]
    high_count = levels.count("HIGH")
    mod_count  = levels.count("MODERATE")

    overall = "HIGH" if high_count > 0 else ("MODERATE" if mod_count > 0 else "NORMAL")

    summary = {
        "video":         video_path,
        "total_frames":  frame_count,
        "total_windows": len(windows),
        "overall_level": overall,
        "max_score":     round(max(scores), 4),
        "mean_score":    round(float(np.mean(scores)), 4),
        "high_windows":  high_count,
        "moderate_windows": mod_count,
        "normal_windows": levels.count("NORMAL"),
        "peak_window":   peak,
        "skeleton_video": skel_path,
    }

    # Delete original video immediately after skeleton extraction (privacy)
    try:
        os.remove(video_path)
        print(f"\n  [privacy] Original video deleted: {os.path.basename(video_path)}")
        print(f"  [privacy] Only skeleton video retained: {os.path.basename(skel_path)}")
    except Exception as e:
        print(f"\n  [warn] Could not delete original video: {e}")

    print()
    print("=" * 55)
    print(f"  SUMMARY")
    print(f"  Overall risk  : {overall}")
    print(f"  Max score     : {int(summary['max_score']*100)}%")
    print(f"  Mean score    : {int(summary['mean_score']*100)}%")
    print(f"  HIGH windows  : {high_count}")
    print(f"  MODERATE      : {mod_count}")
    print(f"  Peak at       : t={peak['t_sec']}s")
    print(f"  Skeleton video: {skel_path}")
    print("=" * 55)

    result = {"summary": summary, "windows": windows}

    if out_path is None:
        out_path = base + "_analysis.json"
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\n  Full results → {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Offline fall risk analysis of a video file.")
    parser.add_argument("--video",  required=True, help="Path to .mp4 / .avi video")
    parser.add_argument("--suffix", default="",    help="Model suffix e.g. _webcam")
    parser.add_argument("--out",    default=None,  help="Output JSON path")
    args = parser.parse_args()
    main(args.video, args.suffix, args.out)
