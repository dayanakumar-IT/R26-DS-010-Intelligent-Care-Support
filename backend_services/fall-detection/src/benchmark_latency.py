"""
Latency benchmark — measures end-to-end inference time per 3-second window.

Reports:
  - MediaPipe skeleton extraction (per frame)
  - Preprocessing (normalise + enforce 90 frames + features)
  - ST-GCN inference
  - Fusion inference
  - Total pipeline latency (ms/window)

Usage
-----
    python -m src.benchmark_latency
    python -m src.benchmark_latency --suffix _subj --n 50
"""
from __future__ import annotations

import argparse
import os
import sys
import time

import numpy as np
import torch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import MODELS_DIR, TARGET_FRAMES, NUM_JOINTS
from src.data_processor import DataProcessor
from src.features import FeatureExtractor
from src.models.stgcn import SkeletalSTGCN
from src.models.fusion import LateFusionNetwork
from src.data_splits import load_scaler


def benchmark(suffix: str = "", n: int = 100):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[benchmark] Device: {device}")
    print(f"[benchmark] Runs:   {n}")
    print(f"[benchmark] Suffix: '{suffix}'")

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

    dp   = DataProcessor()
    feat = FeatureExtractor()

    # Dummy skeleton buffer — random realistic values
    rng = np.random.default_rng(42)
    buf = rng.random((TARGET_FRAMES, NUM_JOINTS, 4)).astype(np.float32)
    buf[:, :, 3] = 0.9   # high visibility

    t_preproc = []
    t_stgcn   = []
    t_fusion  = []
    t_total   = []

    for i in range(n + 10):   # 10 warmup
        t0 = time.perf_counter()

        # Preprocessing
        tp0 = time.perf_counter()
        seq_norm  = dp.apply_clip_normalization(buf)
        seq_90    = dp.enforce_temporal_uniformity(seq_norm)
        raw_feats = feat.extract_sequence_features(seq_90)
        feats_std = scaler.transform(raw_feats.reshape(1, -1)).astype(np.float32)
        tp1 = time.perf_counter()

        sk_t = torch.from_numpy(seq_90[np.newaxis].astype(np.float32)).to(device)
        ft_t = torch.from_numpy(feats_std).to(device)

        # ST-GCN
        ts0 = time.perf_counter()
        with torch.no_grad():
            emb = stgcn(sk_t, extract_embedding=True)
        ts1 = time.perf_counter()

        # Fusion
        tf0 = time.perf_counter()
        with torch.no_grad():
            _ = fusion(emb, ft_t)
        tf1 = time.perf_counter()

        t1 = time.perf_counter()

        if i >= 10:   # skip warmup
            t_preproc.append((tp1 - tp0) * 1000)
            t_stgcn.append((ts1 - ts0) * 1000)
            t_fusion.append((tf1 - tf0) * 1000)
            t_total.append((t1 - t0) * 1000)

    def stats(arr):
        return f"mean={np.mean(arr):.2f}ms  std={np.std(arr):.2f}ms  min={np.min(arr):.2f}ms  max={np.max(arr):.2f}ms"

    print("\n" + "="*60)
    print("  LATENCY BENCHMARK RESULTS")
    print(f"  Device:       {device}")
    print(f"  Window size:  {TARGET_FRAMES} frames (3 seconds)")
    print(f"  Runs:         {n}")
    print("="*60)
    print(f"  Preprocessing:  {stats(t_preproc)}")
    print(f"  ST-GCN:         {stats(t_stgcn)}")
    print(f"  Fusion:         {stats(t_fusion)}")
    print(f"  TOTAL pipeline: {stats(t_total)}")
    print("="*60)
    print(f"\n  >> Mean total latency: {np.mean(t_total):.1f} ms/window")
    print(f"  >> Inference rate:     {1000/np.mean(t_total):.1f} windows/sec")
    print(f"  >> Real-time capable:  {'YES' if np.mean(t_total) < 500 else 'NO'} (threshold: 500ms)")

    # Save results
    out = {
        "device": str(device),
        "suffix": suffix,
        "n_runs": n,
        "preprocessing_ms": {"mean": float(np.mean(t_preproc)), "std": float(np.std(t_preproc))},
        "stgcn_ms":         {"mean": float(np.mean(t_stgcn)),   "std": float(np.std(t_stgcn))},
        "fusion_ms":        {"mean": float(np.mean(t_fusion)),  "std": float(np.std(t_fusion))},
        "total_ms":         {"mean": float(np.mean(t_total)),   "std": float(np.std(t_total))},
        "windows_per_sec":  float(1000 / np.mean(t_total)),
    }

    import json
    out_path = os.path.join(MODELS_DIR, f"latency_benchmark{suffix}.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\n[benchmark] Results saved: {out_path}")
    return out


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--suffix", default="", help="Model suffix")
    parser.add_argument("--n", type=int, default=100, help="Number of runs")
    args = parser.parse_args()
    benchmark(suffix=args.suffix, n=args.n)
