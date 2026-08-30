"""
Evaluate fine-tuned Model C (stgcn_best_webcam.pth + fusion_best_webcam.pth)
on the held-out webcam test set (subject2 — subject-disjoint, never seen during
fine-tuning).

Writes:
    models/saved/eval_report_webcam.md    ← human-readable
    models/saved/eval_report_webcam.json  ← machine-readable
    models/saved/latency_benchmark_webcam.json

Usage:
    python -m src.eval_webcam_holdout
"""
from __future__ import annotations

import json
import os
import sys
import time

import numpy as np
import torch
from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, average_precision_score, f1_score,
)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import PROCESSED_DATA_DIR, MODELS_DIR
from src.models.stgcn  import SkeletalSTGCN
from src.models.fusion import LateFusionNetwork
from src.models.classifier import FeatureClassifier
from src.data_splits import load_scaler

LABELS = ["NORMAL", "FALL"]


def _load_webcam_test():
    """
    Reproduce the exact same subject-disjoint split used in finetune_webcam.py:
    hold out the LAST subject (subject2) as the test set.
    """
    # Files land in data/processed/processed/ (double-nested) from parse_webcam.py
    _wdir = os.path.join(PROCESSED_DATA_DIR, "processed")
    if not os.path.exists(os.path.join(_wdir, "webcam_data.npy")):
        _wdir = PROCESSED_DATA_DIR   # fallback to flat layout
    data     = np.load(os.path.join(_wdir, "webcam_data.npy"))     # (N,90,14,4)
    features = np.load(os.path.join(_wdir, "webcam_features.npy")) # (N,18)
    labels   = np.load(os.path.join(_wdir, "webcam_labels.npy"))   # (N,)
    subj_path = os.path.join(_wdir, "webcam_subjects.npy")
    subjects = np.load(subj_path) if os.path.exists(subj_path) else np.zeros(len(labels), int)

    unique = np.unique(subjects)
    if len(unique) >= 2:
        val_subj  = unique[-1]
        test_mask = subjects == val_subj
        print(f"[eval] Subject-disjoint test set — subject={val_subj}  "
              f"clips={test_mask.sum()}")
    else:
        # Fallback: last 20% by index
        rng  = np.random.default_rng(42)
        idx  = rng.permutation(len(labels))
        split = int(0.8 * len(labels))
        test_mask = np.zeros(len(labels), bool)
        test_mask[idx[split:]] = True
        print(f"[eval] Random 80/20 fallback — test clips={test_mask.sum()}")

    sk_test = data[test_mask].astype(np.float32)
    ft_test = features[test_mask].astype(np.float32)
    lb_test = labels[test_mask].astype(int)
    return sk_test, ft_test, lb_test


def _standardise(features, scaler):
    return scaler.transform(features).astype(np.float32)


def _section(title, report, cm, roc, pr, threshold=None):
    lines = [f"## {title}"]
    lines.append("```")
    lines.append(report)
    lines.append(f"confusion matrix [rows=true, cols=pred]:")
    lines.append(str(cm))
    lines.append(f"ROC-AUC: {roc:.4f}   PR-AUC: {pr:.4f}")
    if threshold is not None:
        lines.append(f"Decision threshold (val-optimal): {threshold:.3f}")
    lines.append("```")
    return "\n".join(lines)


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[eval] Device: {device}")

    sk_test, ft_test, lb_test = _load_webcam_test()
    N = len(lb_test)
    print(f"[eval] Test set: {N} clips  "
          f"fall={int((lb_test==1).sum())}  normal={int((lb_test==0).sum())}")

    if N == 0:
        print("[eval] No test clips found — check webcam_subjects.npy")
        sys.exit(1)

    # Standardise features
    scaler = load_scaler("")   # Model A scaler
    ft_std = _standardise(ft_test, scaler)

    # Convert to tensors
    sk_t  = torch.from_numpy(sk_test)   # (N,90,14,4)
    ft_t  = torch.from_numpy(ft_std)    # (N,18)

    # ── Load fine-tuned models ───────────────────────────────────────────────
    stgcn = SkeletalSTGCN().to(device)
    stgcn.load_state_dict(torch.load(
        os.path.join(MODELS_DIR, "stgcn_best_webcam.pth"),
        map_location=device, weights_only=True))
    stgcn.eval()

    fusion = LateFusionNetwork().to(device)
    fusion.load_state_dict(torch.load(
        os.path.join(MODELS_DIR, "fusion_best_webcam.pth"),
        map_location=device, weights_only=True))
    fusion.eval()

    clf = FeatureClassifier()
    clf_path = os.path.join(MODELS_DIR, "classifier_best.pth")
    if os.path.exists(clf_path):
        clf.load_state_dict(torch.load(clf_path, map_location=device, weights_only=True))
    clf = clf.to(device)
    clf.eval()

    # Load val-optimal threshold for fusion
    thr_path = os.path.join(MODELS_DIR, "threshold_webcam.json")
    fusion_thr = 0.5
    if os.path.exists(thr_path):
        with open(thr_path) as f:
            fusion_thr = json.load(f).get("fusion_threshold", 0.5)
    print(f"[eval] Fusion threshold (webcam val-optimal): {fusion_thr:.3f}")

    sections = []
    json_results = {}

    # ── Latency benchmark ────────────────────────────────────────────────────
    sk_bench = sk_t[:1].to(device)
    ft_bench = ft_t[:1].to(device)
    with torch.no_grad():
        # Warm-up
        for _ in range(5):
            emb_ = stgcn(sk_bench, extract_embedding=True)
            _    = fusion(emb_, ft_bench)
        # Timed
        t0 = time.perf_counter()
        REPS = 100
        for _ in range(REPS):
            emb_ = stgcn(sk_bench, extract_embedding=True)
            _    = fusion(emb_, ft_bench)
        elapsed_ms = (time.perf_counter() - t0) / REPS * 1000

    print(f"[eval] Inference latency (fusion, 1 clip): {elapsed_ms:.2f} ms")
    lat_result = {"inference_ms_per_clip": round(elapsed_ms, 3),
                  "device": str(device),
                  "note": "90-frame window (3 s at 30 FPS) — MediaPipe not included"}
    with open(os.path.join(MODELS_DIR, "latency_benchmark_webcam.json"), "w") as f:
        json.dump(lat_result, f, indent=2)

    # ── Helper: run inference in batches ─────────────────────────────────────
    def _infer_batch(sk_all, ft_all, batch=16):
        stgcn_probs, fusion_probs, feat_probs = [], [], []
        for i in range(0, len(sk_all), batch):
            sk_b = sk_all[i:i+batch].to(device)
            ft_b = ft_all[i:i+batch].to(device)
            with torch.no_grad():
                emb      = stgcn(sk_b, extract_embedding=True)
                s_logits = stgcn(sk_b)
                f_logits = fusion(emb, ft_b)
                c_logits = clf(ft_b)
            stgcn_probs.append(torch.softmax(s_logits, 1)[:, 1].cpu().numpy())
            fusion_probs.append(torch.softmax(f_logits, 1)[:, 1].cpu().numpy())
            feat_probs.append(torch.softmax(c_logits,  1)[:, 1].cpu().numpy())
        return (np.concatenate(stgcn_probs),
                np.concatenate(fusion_probs),
                np.concatenate(feat_probs))

    stgcn_p, fusion_p, feat_p = _infer_batch(sk_t, ft_t)

    def _metrics(probs, true, threshold=0.5, name=""):
        preds = (probs >= threshold).astype(int)
        rep   = classification_report(true, preds, target_names=LABELS, digits=4)
        cm    = confusion_matrix(true, preds)
        try:
            roc = roc_auc_score(true, probs)
        except Exception:
            roc = float("nan")
        try:
            pr_auc = average_precision_score(true, probs)
        except Exception:
            pr_auc = float("nan")
        fall_recall = cm[1, 1] / max(cm[1].sum(), 1)
        fall_prec   = cm[1, 1] / max(cm[:, 1].sum(), 1)
        normal_fp   = cm[0, 1] / max(cm[0].sum(), 1)   # false positive rate
        macro_f1    = f1_score(true, preds, average="macro", zero_division=0)
        acc         = (preds == true).mean()
        print(f"[eval] {name}: acc={acc:.4f}  macro-F1={macro_f1:.4f}  "
              f"fall_recall={fall_recall:.4f}  roc={roc:.4f}")
        return dict(
            accuracy     = round(float(acc),         4),
            macro_f1     = round(float(macro_f1),    4),
            fall_recall  = round(float(fall_recall), 4),
            fall_precision = round(float(fall_prec), 4),
            normal_fp_rate = round(float(normal_fp), 4),
            roc_auc      = round(float(roc),         4),
            pr_auc       = round(float(pr_auc),      4),
            threshold    = round(float(threshold),   3),
            n_clips      = int(N),
            n_fall       = int((true==1).sum()),
            n_normal     = int((true==0).sum()),
            report       = rep,
            confusion    = cm.tolist(),
        )

    # ── Evaluate all three models ────────────────────────────────────────────
    r_stgcn  = _metrics(stgcn_p,  lb_test, 0.5,          "ST-GCN (webcam fine-tuned)")
    r_feat   = _metrics(feat_p,   lb_test, 0.5,          "Feature-only")
    r_fusion = _metrics(fusion_p, lb_test, fusion_thr,   "Fusion (webcam fine-tuned)")

    json_results = {
        "dataset": "in-house webcam (Hikvision DS-U02)",
        "split":   "subject-disjoint (subject2 held out)",
        "stgcn_webcam":   r_stgcn,
        "feature_only":   r_feat,
        "fusion_webcam":  r_fusion,
        "latency_ms":     round(elapsed_ms, 3),
    }

    with open(os.path.join(MODELS_DIR, "eval_report_webcam.json"), "w") as f:
        json.dump(json_results, f, indent=2)

    # ── Markdown report ──────────────────────────────────────────────────────
    def _md_section(title, r, thr=None):
        lines = [f"## {title}"]
        lines.append("```")
        lines.append(r["report"].strip())
        lines.append("")
        lines.append("confusion matrix [rows=true, cols=pred]:")
        cm_arr = np.array(r["confusion"])
        lines.append(str(cm_arr))
        lines.append(f"ROC-AUC: {r['roc_auc']:.4f}   PR-AUC: {r['pr_auc']:.4f}")
        if thr is not None:
            lines.append(f"Decision threshold (val-optimal): {thr:.3f}")
        lines.append("```")
        return "\n".join(lines)

    md_lines = [
        "# Webcam Held-Out Test Evaluation Report (Model C)",
        "",
        f"**Dataset**: In-house webcam clips — Hikvision DS-U02, 30 FPS, 1280×720",
        f"**Split**: Subject-disjoint — subject2 held out ({N} clips: "
        f"{int((lb_test==1).sum())} fall, {int((lb_test==0).sum())} normal)",
        f"**Models**: Fine-tuned on subject1 webcam clips (Model C)",
        f"**Inference latency**: {elapsed_ms:.2f} ms per 90-frame window (CPU: {device})",
        "",
        _md_section("ST-GCN only (webcam fine-tuned)", r_stgcn),
        "",
        _md_section("Feature-only classifier", r_feat),
        "",
        _md_section("Fusion — ST-GCN + Features (webcam fine-tuned)", r_fusion, fusion_thr),
        "",
        "## Summary",
        "",
        f"| Model | Accuracy | Macro-F1 | Fall Recall | Fall Precision | Normal FP Rate | ROC-AUC |",
        f"|---|---|---|---|---|---|---|",
        f"| ST-GCN (fine-tuned) | {r_stgcn['accuracy']:.4f} | {r_stgcn['macro_f1']:.4f} | {r_stgcn['fall_recall']:.4f} | {r_stgcn['fall_precision']:.4f} | {r_stgcn['normal_fp_rate']:.4f} | {r_stgcn['roc_auc']:.4f} |",
        f"| Feature-only        | {r_feat['accuracy']:.4f} | {r_feat['macro_f1']:.4f} | {r_feat['fall_recall']:.4f} | {r_feat['fall_precision']:.4f} | {r_feat['normal_fp_rate']:.4f} | {r_feat['roc_auc']:.4f} |",
        f"| Fusion (fine-tuned) | {r_fusion['accuracy']:.4f} | {r_fusion['macro_f1']:.4f} | {r_fusion['fall_recall']:.4f} | {r_fusion['fall_precision']:.4f} | {r_fusion['normal_fp_rate']:.4f} | {r_fusion['roc_auc']:.4f} |",
    ]

    md = "\n".join(md_lines)
    with open(os.path.join(MODELS_DIR, "eval_report_webcam.md"), "w") as f:
        f.write(md)

    print("\n[eval] Reports saved:")
    print(f"  {os.path.join(MODELS_DIR, 'eval_report_webcam.md')}")
    print(f"  {os.path.join(MODELS_DIR, 'eval_report_webcam.json')}")
    print(f"  {os.path.join(MODELS_DIR, 'latency_benchmark_webcam.json')}")


if __name__ == "__main__":
    main()
