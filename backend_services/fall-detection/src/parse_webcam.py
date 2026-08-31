"""
Webcam clip ingestion.

Reads `data/processed/webcam_mediapipe/*.npz` (output of
extract_webcam_mediapipe.py), normalises each sequence, enforces the
90-frame temporal contract, extracts 18 kinematic features, and writes
five arrays:

    data/processed/webcam_data.npy      float32 (N, 90, 14, 4)
    data/processed/webcam_features.npy  float32 (N, 18)
    data/processed/webcam_labels.npy    int64   (N,)
    data/processed/webcam_subjects.npy  int64   (N,)

Usage
-----
    python -m src.parse_webcam
"""
from __future__ import annotations

import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import PROCESSED_DATA_DIR
from src.data_processor import DataProcessor
from src.features import FeatureExtractor

WEBCAM_MEDIAPIPE_DIR = os.path.join(PROCESSED_DATA_DIR, "webcam_mediapipe")
MIN_FRAMES = 30


def run():
    if not os.path.isdir(WEBCAM_MEDIAPIPE_DIR):
        print(f"[parse_webcam] No directory: {WEBCAM_MEDIAPIPE_DIR}")
        print("               Run extract_webcam_mediapipe.py first.")
        return

    npz_files = sorted(f for f in os.listdir(WEBCAM_MEDIAPIPE_DIR)
                       if f.endswith(".npz"))
    if not npz_files:
        print(f"[parse_webcam] No .npz files in {WEBCAM_MEDIAPIPE_DIR}")
        return

    print(f"[parse_webcam] Found {len(npz_files)} sequences")

    dp   = DataProcessor()
    feat = FeatureExtractor()

    data_list     = []
    feature_list  = []
    label_list    = []
    subject_list  = []
    skipped       = 0

    for name in npz_files:
        path = os.path.join(WEBCAM_MEDIAPIPE_DIR, name)
        rec  = np.load(path)
        seq  = rec["arr_0"]          # (T, 14, 4)
        lbl  = int(rec["label"])
        subj = int(rec.get("subject", 0))

        if seq.shape[1] != 14 or seq.shape[2] not in (3, 4) or len(seq) < MIN_FRAMES:
            print(f"  [skip] {name}: malformed shape {seq.shape}")
            skipped += 1
            continue

        try:
            seq_norm = dp.apply_clip_normalization(seq)
            seq_90   = dp.enforce_temporal_uniformity(seq_norm)  # (90, 14, 4)
            feats    = feat.extract_sequence_features(seq_90)     # (18,)
        except Exception as e:
            print(f"  [skip] {name}: preprocessing error — {e}")
            skipped += 1
            continue

        data_list.append(seq_90)
        feature_list.append(feats)
        label_list.append(lbl)
        subject_list.append(subj)
        print(f"  [ok]  {name}  label={lbl}  subject={subj}")

    if not data_list:
        print("[parse_webcam] No valid sequences after filtering. Exiting.")
        return

    data_arr    = np.asarray(data_list,    dtype=np.float32)   # (N, 90, 14, 4)
    feature_arr = np.asarray(feature_list, dtype=np.float32)   # (N, 18)
    label_arr   = np.asarray(label_list,   dtype=np.int64)     # (N,)
    subject_arr = np.asarray(subject_list, dtype=np.int64)     # (N,)

    os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)
    np.save(os.path.join(PROCESSED_DATA_DIR, "webcam_data.npy"),     data_arr)
    np.save(os.path.join(PROCESSED_DATA_DIR, "webcam_features.npy"), feature_arr)
    np.save(os.path.join(PROCESSED_DATA_DIR, "webcam_labels.npy"),   label_arr)
    np.save(os.path.join(PROCESSED_DATA_DIR, "webcam_subjects.npy"), subject_arr)

    fall_count   = int((label_arr == 1).sum())
    normal_count = int((label_arr == 0).sum())
    print(f"\n[parse_webcam] Done.  shape={data_arr.shape}  "
          f"fall={fall_count}  normal={normal_count}  skipped={skipped}")
    print(f"[parse_webcam] Saved to {PROCESSED_DATA_DIR}")


if __name__ == "__main__":
    run()
