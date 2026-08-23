"""
Live fall risk monitor — camera window with skeleton overlay and risk score.

Usage:
    python live_test.py
    python live_test.py --camera 1
    python live_test.py --suffix _webcam

Controls:
    Q  — quit
"""
import argparse
import os
import sys
import time
import threading
import datetime
import warnings
warnings.filterwarnings("ignore")

import cv2
import numpy as np
import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import MODELS_DIR, TARGET_FRAMES, NUM_JOINTS, MEDIAPIPE_JOINT_MAP, JOINT
from src.data_processor import DataProcessor
from src.features import FeatureExtractor
from src.models.stgcn import SkeletalSTGCN
from src.models.fusion import LateFusionNetwork
from src.postprocess import RiskPostProcessor
from src.context_engine import ContextEngine
from src.data_splits import load_scaler
from src.database import get_patient

CONNECTIONS = [
    (0,1),(1,2),(1,3),(2,4),(3,5),(4,6),(5,7),
    (1,8),(1,9),(8,9),(8,10),(9,11),(10,12),(11,13),
]
INFER_EVERY_N   = 3
MIN_BUFFER_FILL = 0.5

RISK_COLORS = {
    "NORMAL":   (0, 200, 0),
    "MODERATE": (0, 165, 255),
    "HIGH":     (0, 0, 220),
}


def beep():
    try:
        import sounddevice as sd
        fs = 44100
        t  = np.linspace(0, 0.5, int(fs * 0.5))
        sd.play(0.5 * np.sin(2 * np.pi * 880 * t).astype(np.float32), fs)
        sd.wait()
    except Exception:
        print("\a", end="", flush=True)


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


def draw_skeleton(frame, joints):
    h, w = frame.shape[:2]
    pts = {}
    for i, (x, y, *_) in enumerate(joints):
        if x > 0 or y > 0:
            pts[i] = (int(x * w), int(y * h))
    for a, b in CONNECTIONS:
        if a in pts and b in pts:
            cv2.line(frame, pts[a], pts[b], (0, 220, 80), 2)
    for pt in pts.values():
        cv2.circle(frame, pt, 6, (0, 100, 255), -1)
        cv2.circle(frame, pt, 6, (255, 255, 255), 1)


def blur_face(frame, joints):
    """Blur face region around nose joint for privacy."""
    h, w = frame.shape[:2]
    nose = joints[0]  # joint 0 = nose
    x, y = nose[0], nose[1]
    if x <= 0 and y <= 0:
        return
    cx, cy = int(x * w), int(y * h)
    # Estimate face size from neck-nose distance
    neck = joints[1]
    nx, ny = int(neck[0] * w), int(neck[1] * h)
    radius = max(40, int(abs(cy - ny) * 1.5))
    x1 = max(0, cx - radius)
    y1 = max(0, cy - radius)
    x2 = min(w, cx + radius)
    y2 = min(h, cy + radius)
    if x2 > x1 and y2 > y1:
        roi = frame[y1:y2, x1:x2]
        blurred = cv2.GaussianBlur(roi, (51, 51), 20)
        frame[y1:y2, x1:x2] = blurred


def draw_overlay(frame, level, score, posture, alert_count, buffering):
    h, w = frame.shape[:2]
    color = RISK_COLORS.get(level, (200, 200, 200))

    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 95), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

    if buffering:
        cv2.putText(frame, "Loading... please stand in frame",
                    (15, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 220, 220), 2)
        cv2.putText(frame, "Stand 1.5-2 metres from camera — full body visible",
                    (15, 78), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 180), 1)
        cv2.putText(frame, "Q = quit", (15, h - 15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (120, 120, 120), 1)
        return

    pct = int(score * 100)
    cv2.putText(frame, f"{level}  {pct}%", (15, 50),
                cv2.FONT_HERSHEY_SIMPLEX, 1.3, color, 3)
    cv2.putText(frame, f"Posture: {posture}", (15, 82),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)

    # Risk bar
    bx, by, bw, bh = w - 220, 18, 200, 22
    cv2.rectangle(frame, (bx, by), (bx + bw, by + bh), (60, 60, 60), -1)
    cv2.rectangle(frame, (bx, by), (bx + int(bw * score), by + bh), color, -1)
    cv2.rectangle(frame, (bx, by), (bx + bw, by + bh), (150, 150, 150), 1)

    cv2.putText(frame, f"Alerts: {alert_count}", (w - 130, h - 15),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 180), 1)
    cv2.putText(frame, "Q = quit", (15, h - 15),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (120, 120, 120), 1)

    if level == "HIGH":
        cv2.rectangle(frame, (0, 0), (w, h), (0, 0, 200), 5)
        cv2.putText(frame, "!!! HIGH FALL RISK !!!", (w // 2 - 195, h - 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 220), 3)


def main(camera=0, suffix="_webcam"):
    import mediapipe as mp

    print("=" * 50)
    print("  FALL RISK LIVE MONITOR")
    print("  Loading models...")
    print("=" * 50)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Load models
    scaler = load_scaler(suffix)

    stgcn = SkeletalSTGCN().to(device).eval()
    stgcn.load_state_dict(torch.load(
        os.path.join(MODELS_DIR, f"stgcn_best{suffix}.pth"),
        map_location=device, weights_only=True))

    fusion = LateFusionNetwork().to(device).eval()
    fusion.load_state_dict(torch.load(
        os.path.join(MODELS_DIR, f"fusion_best{suffix}.pth"),
        map_location=device, weights_only=True))

    dp      = DataProcessor()
    feat_ex = FeatureExtractor()
    postproc = RiskPostProcessor()
    context  = ContextEngine()

    # Resolve patient name for display
    _pt = get_patient("P001")
    patient_name = _pt.get("name") if _pt else "Patient 01"

    print(f"Models loaded on {device}. Opening camera...")

    cap = cv2.VideoCapture(camera)
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT,  720)
    cap.set(cv2.CAP_PROP_FPS, 30)

    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Video writer
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "data", "processed", "skeleton_videos", "live")
    os.makedirs(out_dir, exist_ok=True)
    ts      = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    vid_path = os.path.join(out_dir, f"live_{ts}_skeleton.mp4")
    writer  = cv2.VideoWriter(vid_path, cv2.VideoWriter_fourcc(*"mp4v"), 20.0, (W, H))
    print(f"Saving video → {vid_path}")
    print("\nStand in front of the camera!\n")

    buffer           = []
    frame_count      = 0
    level            = "NORMAL"
    prev_level       = "NORMAL"
    score            = 0.0
    posture          = "UNKNOWN"
    alert_count      = 0
    buffering        = True
    last_joints      = None
    last_seen_time   = 0.0   # track when person was last detected
    NO_PERSON_HOLD   = 3.0   # seconds to hold last state before resetting

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

            # MediaPipe
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            res = pose.process(rgb)

            now_t = time.time()
            if res.pose_landmarks:
                joints = extract_14_joints(res.pose_landmarks.landmark)
                buffer.append(joints)
                last_joints    = joints
                last_seen_time = now_t
                if len(buffer) > TARGET_FRAMES:
                    buffer.pop(0)
            else:
                # No person detected — hold last state for NO_PERSON_HOLD seconds
                # (person may have fallen and MediaPipe lost tracking temporarily)
                if now_t - last_seen_time > NO_PERSON_HOLD:
                    buffer.clear()
                    last_joints = None
                    level       = "NORMAL"
                    score       = 0.0
                    buffering   = True

            frame_count += 1

            # Run inference every INFER_EVERY_N frames — only if person detected
            person_visible = res.pose_landmarks is not None
            if (frame_count % INFER_EVERY_N == 0
                    and len(buffer) >= int(TARGET_FRAMES * MIN_BUFFER_FILL)
                    and person_visible):

                arr = np.stack(buffer, axis=0)
                arr = dp.apply_clip_normalization(arr)
                arr = dp.enforce_temporal_uniformity(arr, TARGET_FRAMES)

                feats = feat_ex.extract_sequence_features(arr)
                if scaler is not None:
                    feats = scaler.transform(feats.reshape(1, -1)).flatten()

                with torch.no_grad():
                    x = torch.tensor(arr[np.newaxis], dtype=torch.float32).to(device)
                    emb   = stgcn(x, extract_embedding=True)
                    f_t   = torch.tensor(feats[np.newaxis], dtype=torch.float32).to(device)
                    logits = fusion(emb, f_t)
                    risk_score = torch.softmax(logits, dim=1)[0, 1].item()

                now = time.time()

                # Context — posture, zone, zone modifier
                if last_joints is not None:
                    ctx     = context.update(last_joints, now)
                    posture = ctx.posture
                    # Apply zone-aware modifier before post-processing
                    adjusted_score = float(np.clip(
                        risk_score + ctx.zone_modifier, 0.0, 1.0))
                else:
                    adjusted_score = risk_score

                proc  = postproc.update(adjusted_score, now)
                prev_level = level
                level      = proc.level
                score      = proc.score
                buffering  = False

                if level == "MODERATE" and prev_level == "NORMAL":
                    print(f"[alert] MODERATE — {patient_name} | score={int(score*100)}% | posture={posture}")

                if proc.alert:
                    alert_count += 1
                    threading.Thread(target=beep, daemon=True).start()
                    print(f"[alert] HIGH — {patient_name} | score={int(score*100)}% | posture={posture}")

            # Display window — original camera + face blur + skeleton (for operator)
            display = frame.copy()
            if last_joints is not None:
                blur_face(display, last_joints)
                draw_skeleton(display, last_joints)
            draw_overlay(display, level, score, posture, alert_count, buffering)

            # Saved video — skeleton on black only (privacy preserving, no raw video)
            skel_frame = np.zeros((H, W, 3), dtype="uint8")
            if last_joints is not None:
                draw_skeleton(skel_frame, last_joints)
            draw_overlay(skel_frame, level, score, posture, alert_count, buffering)
            writer.write(skel_frame)

            cv2.imshow("Fall Risk Monitor  (Q = quit)", display)

            if cv2.waitKey(1) & 0xFF in (ord("q"), ord("Q"), 27):
                break

    cap.release()
    writer.release()
    cv2.destroyAllWindows()
    print(f"\nStopped. Video saved → {vid_path}")
    print(f"Total alerts fired: {alert_count}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--suffix", default="_webcam")
    args = parser.parse_args()
    main(camera=args.camera, suffix=args.suffix)
