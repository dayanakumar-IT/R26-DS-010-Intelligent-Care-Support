"""
Run training on multiple seeds and report mean +/- std of the held-out
test metrics.

Reporting mean over 3 seeds is the standard hedge against reporting a
single lucky run.

Usage:
    python -m src.train_multi_seed --split random    # or subject
    python -m src.train_multi_seed --seeds 42 123 7
"""
import argparse
import json
import os
import statistics

import numpy as np
import torch
from sklearn.metrics import (
    average_precision_score, f1_score, precision_recall_fscore_support,
    roc_auc_score,
)

from config.settings import MODELS_DIR
from src.train import execute_training_pipeline
from src.train_classifier import main as train_classifier_main
from src.data_splits import (
    load_combined_dataset, build_or_load_splits,
    build_or_load_subject_disjoint_splits, load_ntu_subjects_padded, load_scaler,
)
from src.models.stgcn import SkeletalSTGCN
from src.models.fusion import LateFusionNetwork
from src.models.classifier import FeatureClassifier


def _test_metrics(device, suffix, split_mode):
    sk, ft, lb = load_combined_dataset()
    if split_mode == "subject":
        subj = load_ntu_subjects_padded(len(lb))
        _, _, test_idx = build_or_load_subject_disjoint_splits(lb, subj)
    else:
        _, _, test_idx = build_or_load_splits(lb)
    scaler = load_scaler()
    ft_std = scaler.transform(ft).astype(np.float32)

    stgcn = SkeletalSTGCN().to(device).eval()
    stgcn.load_state_dict(torch.load(
        os.path.join(MODELS_DIR, f"stgcn_best{suffix}.pth"),
        map_location=device, weights_only=True))
    fusion = LateFusionNetwork().to(device).eval()
    fusion.load_state_dict(torch.load(
        os.path.join(MODELS_DIR, f"fusion_best{suffix}.pth"),
        map_location=device, weights_only=True))
    clf = FeatureClassifier().to(device).eval()
    clf.load_state_dict(torch.load(
        os.path.join(MODELS_DIR, f"classifier_best{suffix}.pth"),
        map_location=device, weights_only=True))

    with torch.no_grad():
        sk_t = torch.from_numpy(sk[test_idx].astype(np.float32)).to(device)
        ft_t = torch.from_numpy(ft_std[test_idx]).to(device)
        emb = stgcn(sk_t, extract_embedding=True)
        results = {}
        for name, logits in [("stgcn", stgcn.fc(emb)),
                             ("classifier", clf(ft_t)),
                             ("fusion", fusion(emb, ft_t))]:
            probs = torch.softmax(logits, 1)[:, 1].cpu().numpy()
            preds = (probs >= 0.5).astype(int)
            y = lb[test_idx]
            prec, rec, _, _ = precision_recall_fscore_support(
                y, preds, labels=[0, 1], zero_division=0)
            try:
                roc = roc_auc_score(y, probs)
                ap = average_precision_score(y, probs)
            except ValueError:
                roc = ap = float("nan")
            results[name] = {
                "macro_f1": f1_score(y, preds, average="macro", zero_division=0),
                "fall_recall": rec[1], "fall_precision": prec[1],
                "roc_auc": roc, "pr_auc": ap,
            }
    return results


def summarise(runs):
    keys = list(runs[0].keys())        # branch names
    metrics = list(runs[0][keys[0]].keys())
    summary = {}
    for branch in keys:
        summary[branch] = {}
        for m in metrics:
            vals = [r[branch][m] for r in runs]
            summary[branch][m] = {
                "mean": statistics.mean(vals),
                "std": statistics.stdev(vals) if len(vals) > 1 else 0.0,
                "values": vals,
            }
    return summary


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--split", choices=["random", "subject"], default="random")
    parser.add_argument("--seeds", nargs="+", type=int, default=[42, 123, 7])
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[multi-seed] device={device} split={args.split} seeds={args.seeds}")

    runs = []
    for s in args.seeds:
        suffix = f"_{args.split}_s{s}"
        print(f"\n===== seed={s} =====")
        execute_training_pipeline(split_mode=args.split, seed=s, checkpoint_suffix=suffix)
        train_classifier_main(split_mode=args.split, seed=s, checkpoint_suffix=suffix)
        runs.append(_test_metrics(device, suffix, args.split))

    summary = summarise(runs)
    out = os.path.join(MODELS_DIR, f"multi_seed_{args.split}.json")
    with open(out, "w") as f:
        json.dump({"seeds": args.seeds, "summary": summary}, f, indent=2)
    print(f"\n[multi-seed] wrote {out}")

    # Compact terminal report
    print("\n=== mean +/- std over seeds ===")
    for branch, metrics in summary.items():
        print(f"[{branch}]")
        for m, v in metrics.items():
            print(f"  {m:<15s}  {v['mean']:.4f} +/- {v['std']:.4f}")


if __name__ == "__main__":
    main()
