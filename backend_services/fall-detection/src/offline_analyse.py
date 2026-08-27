"""
Offline video analyser — answers the panel requirement:
"uploaded video should be converted to skeleton and analysed."

Accepts any .mp4 / .avi / .mov video file.  Runs MediaPipe frame-by-frame,
builds the (T, 14, 4) skeleton sequence, normalises it, runs all three
models, and prints a full risk report.

Usage
-----
    python -m src.offline_analyse --video path/to/clip.mp4
    python -m src.offline_analyse --video clip.mp4 --suffix _subj
    python -m src.offline_analyse --video clip.mp4 --output report.json

Output
------
    Console: per-window risk scores + final summary
    JSON (optional): full frame-by-frame results + summary
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import cv2
import numpy as np
import torch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import (
    MODELS_DIR, TARGET_FRAMES, FRAME_RATE, CLASS_NAMES, FEATURE_NAMES,
    FEATURE_DISPLAY_NAMES,
)
from src.data_processor import DataProcessor
from src.features import FeatureExtractor
from src.models.stgcn import SkeletalSTGCN
from src.models.classifier import FeatureClassifier
from src.models.fusion import LateFusionNetwork
from src.data_splits import load_scaler

# Analyse one window every STRIDE frames (non-overlapping 3-sec windows)
STRIDE = TARGET_FRAMES   # change to TARGET_FRAMES//2 for 50% overlap


def _landmarks_to_14(mp_results, dp: DataProcessor) -> np.ndarray:
    return dp.extract_mediapipe_14_joints(mp_results)


def _pose_quality(frame: np.ndarray, vis_thresh: float = 0.4) -> str:
    frac = float((frame[:, 3] >= vis_thresh).mean())
    if frac >= 0.85:
        return "GOOD"
    if frac >= 0.5:
        return "DEGRADED"
    return "UNAVAILABLE"


def analyse_video(
    video_path: str,
    suffix:     str = "",
    output_json: str = None,
    device:     torch.device = None,
) -> dict:
    if not os.path.exists(video_path):
        print(f"[offline] File not found: {video_path}")
        sys.exit(1)

    device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[offline] Device: {device}")
    print(f"[offline] Video:  {video_path}")

    # ── Load models ──────────────────────────────────────────────────────
    scaler = load_scaler(suffix)

    stgcn = SkeletalSTGCN().to(device).eval()
    stgcn.load_state_dict(torch.load(
        os.path.join(MODELS_DIR, f"stgcn_best{suffix}.pth"),
        map_location=device, weights_only=True))

    fusion = LateFusionNetwork().to(device).eval()
    fusion.load_state_dict(torch.load(
        os.path.join(MODELS_DIR, f"fusion_best{suffix}.pth"),
        map_location=device, weights_only=True))

    clf_path = os.path.join(MODELS_DIR, f"classifier_best{suffix}.pth")
    clf = None
    if os.path.exists(clf_path):
        clf = FeatureClassifier().to(device).eval()
        clf.load_state_dict(torch.load(clf_path, map_location=device,
                                       weights_only=True))

    # Load val-optimal threshold
    thr_path = os.path.join(MODELS_DIR, f"threshold{suffix}.json")
    fusion_thr = 0.5
    if os.path.exists(thr_path):
        with open(thr_path) as f:
            fusion_thr = float(json.load(f).get("fusion_threshold", 0.5))
    print(f"[offline] Fusion threshold: {fusion_thr:.3f}")

    dp   = DataProcessor()
    feat = FeatureExtractor()

    # ── Extract skeleton frames via MediaPipe ────────────────────────────
    import mediapipe as mp
    print("[offline] Extracting skeleton with MediaPipe …")

    all_frames: list[np.ndarray] = []
    all_timestamps: list[float]  = []
    dropped = 0

    cap = cv2.VideoCapture(video_path)
    src_fps = cap.get(cv2.CAP_PROP_FPS) or FRAME_RATE
    print(f"[offline] Source FPS: {src_fps:.1f}")

    with mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        enable_segmentation=False,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as pose:
        frame_idx = 0
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            ts  = frame_idx / src_fps
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            res = pose.process(rgb)
            if res.pose_landmarks is None:
                dropped += 1
            else:
                jf = _landmarks_to_14(res, dp)
                all_frames.append(jf)
                all_timestamps.append(ts)
            frame_idx += 1

    cap.release()
    total_src = frame_idx
    print(f"[offline] Source frames: {total_src}  "
          f"Valid: {len(all_frames)}  Dropped: {dropped}")

    if len(all_frames) < 30:
        print("[offline] Too few valid frames (<30). Cannot analyse.")
        sys.exit(1)

    # ── Slide a TARGET_FRAMES window and infer ───────────────────────────
    window_results = []
    i = 0
    win_id = 0

    while i + TARGET_FRAMES <= len(all_frames):
        window  = np.stack(all_frames[i : i + TARGET_FRAMES], axis=0)  # (90,14,4)
        t_start = all_timestamps[i]
        t_end   = all_timestamps[i + TARGET_FRAMES - 1]
        quality = _pose_quality(window[-1])

        if quality == "UNAVAILABLE":
            window_results.append({
                "window": win_id,
                "t_start": round(t_start, 3),
                "t_end":   round(t_end, 3),
                "pose_quality": "UNAVAILABLE",
                "fusion_score": None,
                "risk_level":   "UNKNOWN",
            })
            i      += STRIDE
            win_id += 1
            continue

        try:
            seq_norm  = dp.apply_clip_normalization(window)
            seq_90    = dp.enforce_temporal_uniformity(seq_norm)
            raw_feats = feat.extract_sequence_features(seq_90)
            feats_std = scaler.transform(
                raw_feats.reshape(1, -1)).astype(np.float32)
        except Exception as e:
            print(f"  [win {win_id}] preprocessing error: {e}")
            i += STRIDE; win_id += 1
            continue

        sk_t = torch.from_numpy(seq_90[np.newaxis].astype(np.float32)).to(device)
        ft_t = torch.from_numpy(feats_std).to(device)

        with torch.no_grad():
            emb         = stgcn(sk_t, extract_embedding=True)
            stgcn_prob  = float(torch.softmax(stgcn.fc(emb), 1)[0, 1])
            fusion_prob = float(torch.softmax(fusion(emb, ft_t), 1)[0, 1])
            feat_prob   = 0.0
            if clf is not None:
                feat_prob = float(torch.softmax(clf(ft_t), 1)[0, 1])

        risk_level = "HIGH" if fusion_prob >= fusion_thr else \
                     "MODERATE" if fusion_prob >= 0.35 else "NORMAL"

        # Top contributing features
        top_feats = []
        for fi, val in enumerate(raw_feats):
            if abs(float(val)) > 1.5:
                name = FEATURE_NAMES[fi]
                top_feats.append(FEATURE_DISPLAY_NAMES.get(name, name))
        top_feats = top_feats[:3] or ["stable movement"]

        win_res = {
            "window":       win_id,
            "t_start":      round(t_start, 3),
            "t_end":        round(t_end, 3),
            "pose_quality": quality,
            "stgcn_score":  round(stgcn_prob, 4),
            "feat_score":   round(feat_prob, 4),
            "fusion_score": round(fusion_prob, 4),
            "risk_level":   risk_level,
            "key_factors":  top_feats,
        }
        window_results.append(win_res)

        print(f"  [win {win_id:02d}] t={t_start:.1f}–{t_end:.1f}s  "
              f"fusion={fusion_prob:.3f}  level={risk_level:8s}  "
              f"quality={quality}  factors={top_feats}")

        i += STRIDE; win_id += 1

    if not window_results:
        print("[offline] No windows analysed.")
        sys.exit(1)

    # ── Summary ──────────────────────────────────────────────────────────
    scored = [w for w in window_results if w["fusion_score"] is not None]
    if scored:
        max_score  = max(w["fusion_score"] for w in scored)
        mean_score = sum(w["fusion_score"] for w in scored) / len(scored)
        peak_win   = max(scored, key=lambda w: w["fusion_score"])
        level_counts = {}
        for w in scored:
            level_counts[w["risk_level"]] = \
                level_counts.get(w["risk_level"], 0) + 1
        overall_level = (
            "HIGH"     if level_counts.get("HIGH", 0) > 0 else
            "MODERATE" if level_counts.get("MODERATE", 0) > 0 else
            "NORMAL"
        )
    else:
        max_score = mean_score = 0.0
        peak_win  = None
        level_counts  = {}
        overall_level = "UNKNOWN"

    summary = {
        "video":          video_path,
        "total_windows":  len(window_results),
        "scored_windows": len(scored),
        "overall_level":  overall_level,
        "max_score":      round(max_score, 4),
        "mean_score":     round(mean_score, 4),
        "level_counts":   level_counts,
        "peak_window":    peak_win,
        "fusion_threshold": fusion_thr,
    }

    print("\n" + "="*60)
    print(f"  VIDEO ANALYSIS SUMMARY")
    print(f"  File:           {os.path.basename(video_path)}")
    print(f"  Windows:        {len(scored)} analysed")
    print(f"  Overall level:  {overall_level}")
    print(f"  Peak score:     {max_score:.3f}")
    print(f"  Mean score:     {mean_score:.3f}")
    print(f"  Level counts:   {level_counts}")
    if peak_win:
        print(f"  Peak window:    {peak_win['t_start']}–{peak_win['t_end']}s  "
              f"→ {peak_win['key_factors']}")
    print("="*60)

    report = {"summary": summary, "windows": window_results}

    if output_json:
        with open(output_json, "w") as f:
            json.dump(report, f, indent=2)
        print(f"[offline] Report saved: {output_json}")

    return report


def main():
    parser = argparse.ArgumentParser(
        description="Analyse a video file for fall risk.")
    parser.add_argument("--video",  required=True,
                        help="Path to .mp4 / .avi / .mov video file")
    parser.add_argument("--suffix", default="",
                        help="Model suffix e.g. _subj (default: '')")
    parser.add_argument("--output", default=None,
                        help="Save JSON report to this path")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    analyse_video(args.video, suffix=args.suffix,
                  output_json=args.output, device=device)


if __name__ == "__main__":
    main()
