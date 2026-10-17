# backend/src/evaluate.py
"""Held-out test evaluation for ST-GCN, feature classifier, and fusion."""
import os
import json
import numpy as np
import torch
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
    average_precision_score,
)

from config.settings import MODELS_DIR, CLASS_NAMES, BATCH_SIZE
from src.models.stgcn import SkeletalSTGCN
from src.models.classifier import FeatureClassifier
from src.models.fusion import LateFusionNetwork
from src.data_splits import (
    load_combined_dataset,
    build_or_load_splits,
    build_or_load_subject_disjoint_splits,
    load_ntu_subjects_padded,
    load_scaler,
)


def _softmax_fall_prob(logits):
    p = torch.softmax(logits, dim=1)
    return p[:, 1].cpu().numpy()


def evaluate_all(device, split_mode: str = None, suffix: str = ""):
    if split_mode is None:
        split_mode = os.environ.get("FALLRISK_SPLIT", "random")
    skeletons, features_raw, labels = load_combined_dataset()
    if split_mode == "subject":
        subjects = load_ntu_subjects_padded(len(labels))
        _, _, test_idx = build_or_load_subject_disjoint_splits(labels, subjects)
    else:
        _, _, test_idx = build_or_load_splits(labels)
    scaler = load_scaler(suffix)
    features_std = scaler.transform(features_raw).astype(np.float32)

    # B5: load the val-optimal decision threshold (fusion branch);
    # fall back to 0.5 if the sidecar file is missing.
    thr_path = os.path.join(MODELS_DIR, f"threshold{suffix}.json")
    if os.path.exists(thr_path):
        with open(thr_path) as _tf:
            fusion_threshold = float(json.load(_tf).get("fusion_threshold", 0.5))
        print(f"[evaluate] using val-optimal fusion threshold = {fusion_threshold:.3f}")
    else:
        fusion_threshold = 0.5
        print("[evaluate] no threshold sidecar; falling back to 0.5")

    sk_test = torch.from_numpy(skeletons[test_idx])
    ph_test = torch.from_numpy(features_std[test_idx])
    y_test = labels[test_idx]
    print(f"test set: {len(y_test)} samples  fall={int((y_test==1).sum())}  normal={int((y_test==0).sum())}")

    test_ds = TensorDataset(sk_test, ph_test, torch.from_numpy(y_test))
    loader = DataLoader(test_ds, batch_size=BATCH_SIZE, shuffle=False)

    # ----- Load all three models -----
    stgcn = SkeletalSTGCN().to(device).eval()
    stgcn.load_state_dict(torch.load(os.path.join(MODELS_DIR, f"stgcn_best{suffix}.pth"), map_location=device, weights_only=True))

    fusion = LateFusionNetwork().to(device).eval()
    fusion.load_state_dict(torch.load(os.path.join(MODELS_DIR, f"fusion_best{suffix}.pth"), map_location=device, weights_only=True))

    clf_path = os.path.join(MODELS_DIR, f"classifier_best{suffix}.pth")
    if os.path.exists(clf_path):
        clf = FeatureClassifier().to(device).eval()
        clf.load_state_dict(torch.load(clf_path, map_location=device, weights_only=True))
    else:
        print(f"[evaluate] classifier_best.pth missing -- skipping feature-only model")
        clf = None

    # ----- Forward pass -----
    stgcn_logits, fusion_logits, clf_logits = [], [], []
    with torch.no_grad():
        for sk, ph, _ in loader:
            sk, ph = sk.to(device), ph.to(device)
            emb = stgcn(sk, extract_embedding=True)
            stgcn_logits.append(stgcn.fc(emb))
            fusion_logits.append(fusion(emb, ph))
            if clf is not None:
                clf_logits.append(clf(ph))
    stgcn_logits = torch.cat(stgcn_logits, dim=0)
    fusion_logits = torch.cat(fusion_logits, dim=0)
    clf_logits = torch.cat(clf_logits, dim=0) if clf_logits else None

    # ----- Report each branch -----
    report_lines = ["# Test Evaluation Report", ""]
    branches = [("ST-GCN only", stgcn_logits), ("Fusion (ST-GCN + features)", fusion_logits)]
    if clf_logits is not None:
        branches.insert(1, ("Feature-only classifier", clf_logits))

    summary = {}
    for name, logits in branches:
        probs = _softmax_fall_prob(logits)
        thr = fusion_threshold if name.startswith("Fusion") else 0.5
        preds = (probs >= thr).astype(np.int64)

        report_lines.append(f"## {name}")
        report_lines.append("```")
        report_lines.append(
            classification_report(y_test, preds, target_names=CLASS_NAMES, digits=4, zero_division=0)
        )
        cm = confusion_matrix(y_test, preds, labels=[0, 1])
        report_lines.append(f"confusion matrix [rows=true, cols=pred]:\n{cm}")
        try:
            roc = roc_auc_score(y_test, probs)
            ap = average_precision_score(y_test, probs)
        except ValueError:
            roc, ap = float("nan"), float("nan")
        report_lines.append(f"ROC-AUC: {roc:.4f}   PR-AUC: {ap:.4f}")
        report_lines.append("```")
        report_lines.append("")
        summary[name] = {
            "confusion_matrix": cm.tolist(),
            "roc_auc": float(roc),
            "pr_auc": float(ap),
            "threshold": float(thr),
            "predictions": preds.tolist(),
        }

    out_md = os.path.join(MODELS_DIR, f"eval_report{suffix}.md")
    with open(out_md, "w") as f:
        f.write("\n".join(report_lines))
    print(f"[evaluate] wrote {out_md}")

    out_json = os.path.join(MODELS_DIR, f"eval_report{suffix}.json")
    with open(out_json, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"[evaluate] wrote {out_json}")
    return summary


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--split", choices=["random", "subject"], default=None)
    parser.add_argument("--suffix", default="")
    args = parser.parse_args()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"device: {device}")
    evaluate_all(device, split_mode=args.split, suffix=args.suffix)
