"""
ST-GCN evaluation on the TEST split.

Loads `stgcn_results/best_model.pt` and produces:
    test_classification_report.{txt,json}
    test_confusion_matrix.{csv,png}
    test_predictions.csv          per-sequence true/pred + softmax probs
    per_dataset_metrics.csv       UR vs NTU breakdown
    high_risk_recall.txt          recall on high_risk class

Test split is touched ONCE — these are the headline numbers.
"""

import sys
import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    recall_score,
)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dataset import CommonJointDataset, NUM_CLASSES, INDEX_TO_LABEL
from model import STGCN


# ============================================================
# CONFIG
# ============================================================
import os
_PROTOCOL = os.environ.get("MODELS_PROTOCOL", "cs").lower()
if _PROTOCOL == "cv":
    RESULTS_DIR = Path(__file__).resolve().parent.parent / "stgcn_results_cv"
elif _PROTOCOL == "cd_ntu2ur":
    RESULTS_DIR = Path(__file__).resolve().parent.parent / "stgcn_results_cd_ntu2ur"
else:
    RESULTS_DIR = Path(__file__).resolve().parent.parent / "stgcn_results"
BEST_MODEL_PATH = RESULTS_DIR / "best_model.pt"
BATCH_SIZE = 32

TARGET_CLASSES = ["low_risk", "moderate_risk", "high_risk"]


# ============================================================
# INFERENCE
# ============================================================
@torch.no_grad()
def predict(model, loader, device):
    model.eval()
    all_probs, all_preds, all_labels = [], [], []
    for x, y in loader:
        x = x.to(device, non_blocking=True)
        logits = model(x)
        probs = torch.softmax(logits, dim=1).cpu().numpy()
        preds = probs.argmax(axis=1)
        all_probs.append(probs)
        all_preds.append(preds)
        all_labels.append(y.numpy())
    return (
        np.concatenate(all_probs, axis=0),
        np.concatenate(all_preds, axis=0),
        np.concatenate(all_labels, axis=0),
    )


# ============================================================
# REPORT HELPERS
# ============================================================
def save_classification_report(y_true_str, y_pred_str):
    txt = classification_report(
        y_true_str, y_pred_str, labels=TARGET_CLASSES, digits=4, zero_division=0
    )
    print(txt)
    (RESULTS_DIR / "test_classification_report.txt").write_text(txt, encoding="utf-8")

    rep = classification_report(
        y_true_str, y_pred_str, labels=TARGET_CLASSES,
        output_dict=True, zero_division=0,
    )
    with open(RESULTS_DIR / "test_classification_report.json", "w", encoding="utf-8") as f:
        json.dump(rep, f, indent=2)


def save_confusion_matrix(y_true_str, y_pred_str):
    cm = confusion_matrix(y_true_str, y_pred_str, labels=TARGET_CLASSES)
    cm_df = pd.DataFrame(
        cm,
        index=[f"true_{c}" for c in TARGET_CLASSES],
        columns=[f"pred_{c}" for c in TARGET_CLASSES],
    )
    cm_df.to_csv(RESULTS_DIR / "test_confusion_matrix.csv")

    fig, ax = plt.subplots(figsize=(7, 6))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(TARGET_CLASSES)))
    ax.set_yticks(range(len(TARGET_CLASSES)))
    ax.set_xticklabels(TARGET_CLASSES, rotation=20, ha="right")
    ax.set_yticklabels(TARGET_CLASSES)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title("ST-GCN — confusion matrix (TEST)")
    threshold = cm.max() / 2.0
    for i in range(len(TARGET_CLASSES)):
        for j in range(len(TARGET_CLASSES)):
            ax.text(
                j, i, f"{cm[i, j]}",
                ha="center", va="center",
                color="white" if cm[i, j] > threshold else "black",
                fontweight="bold",
            )
    plt.colorbar(im, ax=ax)
    plt.tight_layout()
    plt.savefig(RESULTS_DIR / "test_confusion_matrix.png", dpi=150)
    plt.close()


def save_predictions(test_ds, probs, preds, labels):
    rows = []
    meta = test_ds.meta.reset_index(drop=True)
    for i in range(len(test_ds)):
        rows.append({
            "sequence_id": meta.iloc[i]["sequence_id"],
            "dataset": meta.iloc[i]["dataset"],
            "true_label": INDEX_TO_LABEL[int(labels[i])],
            "pred_label": INDEX_TO_LABEL[int(preds[i])],
            "p_low_risk": round(float(probs[i, 0]), 4),
            "p_moderate_risk": round(float(probs[i, 1]), 4),
            "p_high_risk": round(float(probs[i, 2]), 4),
        })
    pd.DataFrame(rows).to_csv(RESULTS_DIR / "test_predictions.csv", index=False)


def save_per_dataset(test_ds, y_true_str, y_pred_str):
    meta = test_ds.meta.reset_index(drop=True)
    rows = []
    for ds_name in ["UR", "NTU"]:
        mask = (meta["dataset"] == ds_name).values
        if mask.sum() == 0:
            continue
        y_t = np.asarray(y_true_str)[mask]
        y_p = np.asarray(y_pred_str)[mask]
        acc = accuracy_score(y_t, y_p)
        macro_f1 = f1_score(
            y_t, y_p, average="macro", labels=TARGET_CLASSES, zero_division=0
        )
        if (y_t == "high_risk").sum() > 0:
            hr = recall_score(
                y_t, y_p, labels=["high_risk"], average="macro", zero_division=0
            )
        else:
            hr = float("nan")
        row = {
            "dataset": ds_name,
            "n_samples": int(mask.sum()),
            "accuracy": round(acc, 4),
            "macro_f1": round(macro_f1, 4),
            "high_risk_recall": (round(hr, 4) if not np.isnan(hr) else None),
        }
        rows.append(row)
        print(f"  {ds_name}: n={row['n_samples']}  "
              f"acc={row['accuracy']:.4f}  macro_f1={row['macro_f1']:.4f}  "
              f"high_risk_recall={row['high_risk_recall']}")
    pd.DataFrame(rows).to_csv(RESULTS_DIR / "per_dataset_metrics.csv", index=False)


def save_high_risk_recall(y_true_str, y_pred_str):
    hr = recall_score(
        y_true_str, y_pred_str, labels=["high_risk"], average="macro", zero_division=0
    )
    n = int((np.asarray(y_true_str) == "high_risk").sum())
    msg = (
        f"High-risk class (n={n}) recall = {hr:.4f}\n"
        f"\n"
        f"Of {n} actual high-risk events in the test set,\n"
        f"  {round(hr * n)} were correctly flagged.\n"
        f"  The remaining {n - round(hr * n)} would be MISSED FALLS.\n"
    )
    print(msg)
    (RESULTS_DIR / "high_risk_recall.txt").write_text(msg, encoding="utf-8")


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 60)
    print("  ST-GCN evaluation on TEST set")
    print("=" * 60)

    if not BEST_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Best model checkpoint not found: {BEST_MODEL_PATH}\n"
            "Run train.py first."
        )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device          : {device}")

    test_ds = CommonJointDataset("test")
    print(f"Test  : n={len(test_ds)}  | distribution: {test_ds.get_label_distribution()}")
    test_loader = DataLoader(test_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    print("\nLoading best checkpoint...")
    model = STGCN(num_classes=NUM_CLASSES, in_channels=3, t_kernel=9).to(device)
    state = torch.load(BEST_MODEL_PATH, map_location=device)
    model.load_state_dict(state)
    model.eval()

    print("\nRunning inference on test split...")
    probs, preds, labels = predict(model, test_loader, device)

    y_true_str = [INDEX_TO_LABEL[int(l)] for l in labels]
    y_pred_str = [INDEX_TO_LABEL[int(p)] for p in preds]

    print("\n" + "=" * 60)
    print("  Test classification report")
    print("=" * 60)
    save_classification_report(y_true_str, y_pred_str)

    overall_acc = accuracy_score(y_true_str, y_pred_str)
    macro_f1 = f1_score(
        y_true_str, y_pred_str, average="macro", labels=TARGET_CLASSES, zero_division=0
    )
    print(f"Test accuracy : {overall_acc:.4f}")
    print(f"Macro F1      : {macro_f1:.4f}")

    save_confusion_matrix(y_true_str, y_pred_str)
    save_predictions(test_ds, probs, preds, labels)

    print("\n" + "=" * 60)
    print("  Per-dataset metrics on TEST set")
    print("=" * 60)
    save_per_dataset(test_ds, y_true_str, y_pred_str)

    print("\n" + "=" * 60)
    print("  High-risk recall on TEST set")
    print("=" * 60)
    save_high_risk_recall(y_true_str, y_pred_str)

    print(f"\nAll evaluation artifacts saved in: {RESULTS_DIR}")
    print("Done.")


if __name__ == "__main__":
    main()
