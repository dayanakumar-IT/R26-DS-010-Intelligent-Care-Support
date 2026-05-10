"""
Fusion MLP — late-fusion of ST-GCN logits + RF probabilities + motion features.

================================================================
ROLE IN THE COMPONENT
================================================================
The proposal explicitly commits to fusion:

    "These contextual and temporal features are fused with the
     ST-GCN-based movement analysis to produce a more reliable
     and context-aware fall risk assessment."

The trained ST-GCN and RF baseline have complementary strengths
(deep spatio-temporal pattern learning vs. interpretable hand-crafted
features). Late fusion learns how to weight them per-class via a
small MLP.

================================================================
ARCHITECTURE
================================================================
Input  : 24-dim per sequence
            ST-GCN logits        (3)   from best_model.pt
            RF probabilities     (3)   from RF model.pkl
            18 motion features   (18)  from features_dataset.csv

MLP    : Linear(24, 64) -> BN -> ReLU -> Dropout(0.3)
       -> Linear(64, 32) -> BN -> ReLU -> Dropout(0.2)
       -> Linear(32,  3)

Output : 3-class risk_level (low / moderate / high)

================================================================
EXPERIMENT DESIGN
================================================================
- SAME train/val/test sequence IDs as RF baseline + ST-GCN
  (Cross-Subject protocol). Apples-to-apples comparison.
- ST-GCN logits + RF probabilities are computed in INFERENCE mode
  on every sequence — what the deployed pipeline would see.
- Class-weighted CrossEntropy (matches RF and ST-GCN balancing).
- Adam + cosine LR. Early stopping on val accuracy, patience 10.
- Random seed 42 throughout.

================================================================
OUTPUTS — Codes/models/fusion_results/
================================================================
    fusion_features.csv             24-dim input + label per sequence
    best_model.pt                   best checkpoint by val accuracy
    training_log.csv                per-epoch loss + accuracy
    training_curves.png             loss + accuracy plots
    test_classification_report.{txt,json}
    test_confusion_matrix.{csv,png}
    test_predictions.csv            per-sequence true/pred + softmax probs
    per_dataset_metrics.csv         test-set UR vs NTU breakdown
    high_risk_recall.txt            recall on high_risk class
    comparison.csv                  RF vs ST-GCN vs Fusion side-by-side
    summary.txt
"""

import sys
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

import joblib
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    recall_score,
)

# Allow importing paths.py and split_utils.py
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "stgcn"))

from paths import OUTPUTS
from split_utils import load_splits

# ST-GCN dataset + model
from stgcn.dataset import (
    CommonJointDataset,
    NUM_CLASSES,
    LABEL_TO_INDEX,
    INDEX_TO_LABEL,
)
from stgcn.model import STGCN


# ============================================================
# CONFIG
# ============================================================
FEATURES_PATH = OUTPUTS / "Feature_Dataset" / "features_dataset.csv"

# All paths switch with MODELS_PROTOCOL — Fusion under CV reads the CV
# RF and the CV ST-GCN, and writes to fusion_results_cv.
import os
_PROTOCOL = os.environ.get("MODELS_PROTOCOL", "cs").lower()
if _PROTOCOL == "cv":
    RF_MODEL_PATH = Path(__file__).resolve().parent / "baseline_results_cv" / "model.pkl"
    STGCN_BEST_PATH = Path(__file__).resolve().parent / "stgcn_results_cv" / "best_model.pt"
    RESULTS_DIR = Path(__file__).resolve().parent / "fusion_results_cv"
else:
    RF_MODEL_PATH = Path(__file__).resolve().parent / "baseline_results" / "model.pkl"
    STGCN_BEST_PATH = Path(__file__).resolve().parent / "stgcn_results" / "best_model.pt"
    RESULTS_DIR = Path(__file__).resolve().parent / "fusion_results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

TARGET_CLASSES = ["low_risk", "moderate_risk", "high_risk"]
NON_FEATURE_COLUMNS = [
    "sequence_id",
    "dataset",
    "label",
    "risk_level",
    "pose_array_path",
]

RANDOM_SEED = 42

# Training hyperparameters
BATCH_SIZE = 64
MAX_EPOCHS = 100
LEARNING_RATE = 1e-3
WEIGHT_DECAY = 1e-4
EARLY_STOPPING_PATIENCE = 15

INPUT_DIM = 24


# ============================================================
# UTILITIES
# ============================================================
def set_seed(seed: int):
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


# ============================================================
# STEP 1 — BUILD 24-DIM FUSION FEATURE TABLE
# ============================================================
@torch.no_grad()
def stgcn_logits_for_split(model, split_name: str, device) -> pd.DataFrame:
    """Return a DataFrame indexed by sequence_id with columns
    stgcn_logit_low / _moderate / _high  for every sequence in the
    requested split. Uses the same CommonJointDataset the ST-GCN was
    trained on (so order and pre-processing match exactly)."""
    # Inference path — augmentation must be disabled even for the train
    # split so the fusion MLP is trained on canonical ST-GCN logits.
    ds = CommonJointDataset(split_name, augment=False)
    loader = DataLoader(ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    rows = []
    cursor = 0
    for x, _ in loader:
        x = x.to(device, non_blocking=True)
        logits = model(x).cpu().numpy()
        n = logits.shape[0]
        for i in range(n):
            sid = ds.meta.iloc[cursor + i]["sequence_id"]
            rows.append({
                "sequence_id": sid,
                "stgcn_logit_low": float(logits[i, 0]),
                "stgcn_logit_moderate": float(logits[i, 1]),
                "stgcn_logit_high": float(logits[i, 2]),
            })
        cursor += n

    return pd.DataFrame(rows)


def rf_probs_for_features(rf_model, features_df: pd.DataFrame,
                          feature_cols) -> pd.DataFrame:
    """Use the trained RF to score every row in `features_df`. Returns
    a DataFrame with columns sequence_id, rf_prob_low, rf_prob_moderate,
    rf_prob_high (probabilities sum to 1 per row)."""
    X = features_df[feature_cols].values.astype(np.float32)
    probs = rf_model.predict_proba(X)
    # rf_model.classes_ may be in alphabetical order; align to TARGET_CLASSES
    class_to_idx = {c: i for i, c in enumerate(rf_model.classes_)}
    aligned = np.zeros_like(probs)
    for i, cls in enumerate(TARGET_CLASSES):
        aligned[:, i] = probs[:, class_to_idx[cls]]
    return pd.DataFrame({
        "sequence_id": features_df["sequence_id"].values,
        "rf_prob_low": aligned[:, 0],
        "rf_prob_moderate": aligned[:, 1],
        "rf_prob_high": aligned[:, 2],
    })


def build_fusion_table(rf_model, stgcn_model, device, features_df,
                       feature_cols, splits) -> pd.DataFrame:
    """Compute, for every sequence in the union of all splits, the
    24-dim fusion vector, plus the assigned split and risk label."""
    print("\n" + "=" * 60)
    print("  Building 24-dim fusion features for every sequence")
    print("=" * 60)

    # ST-GCN logits per split (so we run inference on the SAME
    # examples the model was trained/validated/tested on)
    stgcn_dfs = []
    for split_name in ("train", "val", "test"):
        print(f"  ST-GCN inference on {split_name} split...")
        stgcn_dfs.append(stgcn_logits_for_split(stgcn_model, split_name, device))
    stgcn_all = pd.concat(stgcn_dfs, ignore_index=True)

    # RF probabilities for ALL feature rows (covers all three splits)
    print("  RandomForest inference on all sequences...")
    rf_all = rf_probs_for_features(rf_model, features_df, feature_cols)

    # Hand-crafted feature columns
    feat_cols_only = features_df[["sequence_id"] + feature_cols].copy()

    # Merge: stgcn + rf + features
    df = (
        feat_cols_only
        .merge(rf_all, on="sequence_id", how="inner")
        .merge(stgcn_all, on="sequence_id", how="inner")
    )

    # Attach split assignment + risk_level
    split_lookup = {}
    for split_name, sdf in splits.items():
        for sid in sdf["sequence_id"].values:
            split_lookup[sid] = split_name
    df["split"] = df["sequence_id"].map(split_lookup)
    df = df.merge(
        features_df[["sequence_id", "dataset", "risk_level"]],
        on="sequence_id",
        how="left",
    )
    df = df[df["split"].notna()].reset_index(drop=True)

    # Save the fusion feature table for transparency / reproducibility
    df.to_csv(RESULTS_DIR / "fusion_features.csv", index=False)
    print(f"  Wrote {RESULTS_DIR / 'fusion_features.csv'}  (rows={len(df)})")
    return df


# ============================================================
# DATASET WRAPPER
# ============================================================
class FusionDataset(Dataset):
    """Wraps the 24-dim fusion table for one split."""

    def __init__(self, df: pd.DataFrame):
        feature_columns = [
            "stgcn_logit_low", "stgcn_logit_moderate", "stgcn_logit_high",
            "rf_prob_low", "rf_prob_moderate", "rf_prob_high",
        ] + sorted(c for c in df.columns
                   if c not in {"sequence_id", "dataset", "risk_level", "split",
                                "stgcn_logit_low", "stgcn_logit_moderate",
                                "stgcn_logit_high",
                                "rf_prob_low", "rf_prob_moderate", "rf_prob_high"})
        self.feature_columns = feature_columns
        self.X = df[feature_columns].values.astype(np.float32)
        self.y = df["risk_level"].map(LABEL_TO_INDEX).values.astype(np.int64)
        self.meta = df[["sequence_id", "dataset", "risk_level"]].reset_index(drop=True)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return torch.from_numpy(self.X[idx]), int(self.y[idx])


# ============================================================
# MODEL
# ============================================================
class FusionMLP(nn.Module):
    def __init__(self, input_dim: int = INPUT_DIM, num_classes: int = NUM_CLASSES):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),

            nn.Linear(64, 32),
            nn.BatchNorm1d(32),
            nn.ReLU(inplace=True),
            nn.Dropout(0.2),

            nn.Linear(32, num_classes),
        )

    def forward(self, x):
        return self.net(x)

    def count_parameters(self):
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


# ============================================================
# TRAIN + VAL EPOCHS
# ============================================================
def run_train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss, correct, total = 0.0, 0, 0
    for x, y in loader:
        x = x.to(device); y = y.to(device)
        optimizer.zero_grad()
        logits = model(x)
        loss = criterion(logits, y)
        loss.backward()
        optimizer.step()
        bs = y.size(0)
        total_loss += loss.item() * bs
        correct += (logits.argmax(dim=1) == y).sum().item()
        total += bs
    return total_loss / total, correct / total


@torch.no_grad()
def run_eval_epoch(model, loader, criterion, device):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0
    for x, y in loader:
        x = x.to(device); y = y.to(device)
        logits = model(x)
        loss = criterion(logits, y)
        bs = y.size(0)
        total_loss += loss.item() * bs
        correct += (logits.argmax(dim=1) == y).sum().item()
        total += bs
    return total_loss / total, correct / total


# ============================================================
# TEST EVALUATION + REPORTING
# ============================================================
@torch.no_grad()
def predict_split(model, ds: FusionDataset, device):
    loader = DataLoader(ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
    model.eval()
    all_probs, all_preds, all_labels = [], [], []
    for x, y in loader:
        x = x.to(device)
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


def write_test_artifacts(test_ds, probs, preds, labels):
    y_true = [INDEX_TO_LABEL[int(l)] for l in labels]
    y_pred = [INDEX_TO_LABEL[int(p)] for p in preds]

    txt = classification_report(
        y_true, y_pred, labels=TARGET_CLASSES, digits=4, zero_division=0
    )
    print(txt)
    (RESULTS_DIR / "test_classification_report.txt").write_text(txt, encoding="utf-8")
    rep = classification_report(
        y_true, y_pred, labels=TARGET_CLASSES, output_dict=True, zero_division=0
    )
    with open(RESULTS_DIR / "test_classification_report.json", "w", encoding="utf-8") as f:
        json.dump(rep, f, indent=2)

    cm = confusion_matrix(y_true, y_pred, labels=TARGET_CLASSES)
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
    ax.set_title("Fusion MLP — confusion matrix (TEST)")
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

    # Per-sequence predictions
    rows = []
    for i in range(len(test_ds)):
        rows.append({
            "sequence_id": test_ds.meta.iloc[i]["sequence_id"],
            "dataset": test_ds.meta.iloc[i]["dataset"],
            "true_label": y_true[i],
            "pred_label": y_pred[i],
            "p_low_risk": round(float(probs[i, 0]), 4),
            "p_moderate_risk": round(float(probs[i, 1]), 4),
            "p_high_risk": round(float(probs[i, 2]), 4),
        })
    pd.DataFrame(rows).to_csv(RESULTS_DIR / "test_predictions.csv", index=False)

    # Per-dataset breakdown
    per_ds_rows = []
    for ds_name in ["UR", "NTU"]:
        mask = (test_ds.meta["dataset"] == ds_name).values
        if mask.sum() == 0:
            continue
        y_t = np.asarray(y_true)[mask]
        y_p = np.asarray(y_pred)[mask]
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
        per_ds_rows.append({
            "dataset": ds_name,
            "n_samples": int(mask.sum()),
            "accuracy": round(acc, 4),
            "macro_f1": round(macro_f1, 4),
            "high_risk_recall": (round(hr, 4) if not np.isnan(hr) else None),
        })
        print(f"  {ds_name}: n={int(mask.sum())}  acc={acc:.4f}  "
              f"macro_f1={macro_f1:.4f}  high_risk_recall={hr:.4f}")
    pd.DataFrame(per_ds_rows).to_csv(RESULTS_DIR / "per_dataset_metrics.csv", index=False)

    # High-risk recall
    hr = recall_score(
        y_true, y_pred, labels=["high_risk"], average="macro", zero_division=0
    )
    n = int((np.asarray(y_true) == "high_risk").sum())
    msg = (
        f"High-risk class (n={n}) recall = {hr:.4f}\n"
        f"\n"
        f"Of {n} actual high-risk events, {round(hr * n)} were correctly flagged.\n"
        f"  The remaining {n - round(hr * n)} would be MISSED FALLS.\n"
    )
    print(msg)
    (RESULTS_DIR / "high_risk_recall.txt").write_text(msg, encoding="utf-8")

    overall_acc = accuracy_score(y_true, y_pred)
    macro_f1 = f1_score(
        y_true, y_pred, average="macro", labels=TARGET_CLASSES, zero_division=0
    )
    return overall_acc, macro_f1, hr


# ============================================================
# COMPARISON TABLE — RF vs ST-GCN vs Fusion
# ============================================================
def write_comparison(test_acc_fusion, test_macro_f1_fusion, hr_fusion):
    """Pull headline numbers from each model's summary and write a
    side-by-side comparison CSV."""
    rows = []

    def parse_summary(path: Path):
        if not path.exists():
            return {}
        text = path.read_text(encoding="utf-8")
        out = {}
        for line in text.splitlines():
            if "Test  accuracy" in line or "Test accuracy" in line:
                out["test_accuracy"] = float(line.split(":")[-1].strip())
            elif "Test  macro F1" in line or "Test macro F1" in line:
                out["test_macro_f1"] = float(line.split(":")[-1].strip())
            elif "high-risk recall" in line.lower():
                try:
                    out["high_risk_recall"] = float(line.split(":")[-1].strip())
                except ValueError:
                    pass
        return out

    rf_summary = parse_summary(
        Path(__file__).resolve().parent / "baseline_results" / "summary.txt"
    )
    rows.append({
        "model": "Baseline RandomForest (18 motion features)",
        "test_accuracy": rf_summary.get("test_accuracy"),
        "test_macro_f1": rf_summary.get("test_macro_f1"),
        "high_risk_recall": rf_summary.get("high_risk_recall"),
    })

    # ST-GCN — read its test_classification_report.json for headline
    stgcn_report = (
        Path(__file__).resolve().parent / "stgcn_results"
        / "test_classification_report.json"
    )
    stgcn_acc, stgcn_macro = None, None
    stgcn_hr = None
    if stgcn_report.exists():
        with open(stgcn_report) as f:
            r = json.load(f)
        stgcn_acc = r.get("accuracy")
        stgcn_macro = r.get("macro avg", {}).get("f1-score")
        stgcn_hr = r.get("high_risk", {}).get("recall")
    rows.append({
        "model": "ST-GCN (3M params, 14-joint skeleton)",
        "test_accuracy": stgcn_acc,
        "test_macro_f1": stgcn_macro,
        "high_risk_recall": stgcn_hr,
    })

    rows.append({
        "model": "Fusion MLP (ST-GCN + RF + features)",
        "test_accuracy": round(test_acc_fusion, 4),
        "test_macro_f1": round(test_macro_f1_fusion, 4),
        "high_risk_recall": round(hr_fusion, 4),
    })

    df = pd.DataFrame(rows)
    df.to_csv(RESULTS_DIR / "comparison.csv", index=False)
    print("\nComparison (RF vs ST-GCN vs Fusion):")
    print(df.to_string(index=False))


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 60)
    print(f"  Fusion MLP ({_PROTOCOL.upper()} protocol)")
    print("=" * 60)

    set_seed(RANDOM_SEED)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device          : {device}")

    # ---- Load ingredients ----
    if not RF_MODEL_PATH.exists():
        raise FileNotFoundError(f"RF model not found: {RF_MODEL_PATH}")
    if not STGCN_BEST_PATH.exists():
        raise FileNotFoundError(f"ST-GCN best checkpoint not found: {STGCN_BEST_PATH}")

    print(f"\nLoading features:  {FEATURES_PATH}")
    features_df = pd.read_csv(FEATURES_PATH)
    feature_cols = [c for c in features_df.columns if c not in NON_FEATURE_COLUMNS]
    print(f"  rows={len(features_df)}  feature_cols={len(feature_cols)}")

    print(f"\nLoading RF model:  {RF_MODEL_PATH}")
    rf_model = joblib.load(RF_MODEL_PATH)
    print(f"  classes_={list(rf_model.classes_)}")

    print(f"\nLoading ST-GCN best checkpoint: {STGCN_BEST_PATH}")
    stgcn_model = STGCN(num_classes=NUM_CLASSES, in_channels=3, t_kernel=9).to(device)
    stgcn_model.load_state_dict(torch.load(STGCN_BEST_PATH, map_location=device))
    stgcn_model.eval()

    splits = load_splits()

    # ---- Build fusion feature table ----
    fusion_df = build_fusion_table(
        rf_model, stgcn_model, device, features_df, feature_cols, splits
    )

    train_df = fusion_df[fusion_df["split"] == "train"].reset_index(drop=True)
    val_df = fusion_df[fusion_df["split"] == "val"].reset_index(drop=True)
    test_df = fusion_df[fusion_df["split"] == "test"].reset_index(drop=True)

    train_ds = FusionDataset(train_df)
    val_ds = FusionDataset(val_df)
    test_ds = FusionDataset(test_df)
    print(f"\nFusion samples — train={len(train_ds)}  val={len(val_ds)}  test={len(test_ds)}")
    print(f"Input feature columns ({len(train_ds.feature_columns)}):")
    for i, c in enumerate(train_ds.feature_columns, 1):
        print(f"  {i:2d}. {c}")

    # ---- Train ----
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False)

    model = FusionMLP(input_dim=len(train_ds.feature_columns),
                      num_classes=NUM_CLASSES).to(device)
    print(f"\nTrainable parameters: {model.count_parameters():,}")

    # Class weights from train labels
    counts = np.bincount(train_ds.y, minlength=NUM_CLASSES).astype(np.float32)
    cw = torch.from_numpy(len(train_ds.y) / (NUM_CLASSES * counts)).to(device)
    print(f"Class weights (low / moderate / high): "
          f"{cw.cpu().numpy().round(3).tolist()}")
    criterion = nn.CrossEntropyLoss(weight=cw)
    optimizer = torch.optim.Adam(
        model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=MAX_EPOCHS
    )

    print("\n" + "=" * 60)
    print("  Training Fusion MLP")
    print("=" * 60)

    log_rows = []
    best_val_acc = -1.0
    best_epoch = -1
    epochs_no_improve = 0
    total_start = time.time()

    for epoch in range(1, MAX_EPOCHS + 1):
        train_loss, train_acc = run_train_epoch(
            model, train_loader, optimizer, criterion, device
        )
        val_loss, val_acc = run_eval_epoch(model, val_loader, criterion, device)
        scheduler.step()
        lr = optimizer.param_groups[0]["lr"]

        log_rows.append({
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "train_acc": round(train_acc, 4),
            "val_loss": round(val_loss, 4),
            "val_acc": round(val_acc, 4),
            "lr": round(lr, 6),
        })

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_epoch = epoch
            epochs_no_improve = 0
            torch.save(model.state_dict(), RESULTS_DIR / "best_model.pt")
            mark = "  *** new best ***"
        else:
            epochs_no_improve += 1
            mark = ""

        print(
            f"Epoch {epoch:3d}/{MAX_EPOCHS}  "
            f"train_loss={train_loss:.4f} train_acc={train_acc:.4f}  "
            f"val_loss={val_loss:.4f} val_acc={val_acc:.4f}{mark}"
        )

        pd.DataFrame(log_rows).to_csv(RESULTS_DIR / "training_log.csv", index=False)

        if epochs_no_improve >= EARLY_STOPPING_PATIENCE:
            print(f"\nEarly stopping at epoch {epoch} "
                  f"(no improvement for {EARLY_STOPPING_PATIENCE} epochs).")
            break

    total_elapsed = time.time() - total_start
    print(f"\nTraining done. Best epoch={best_epoch}  best_val_acc={best_val_acc:.4f}  "
          f"wall_time={total_elapsed/60:.1f} min")

    # ---- Plot training curves ----
    df_log = pd.DataFrame(log_rows)
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    axes[0].plot(df_log["epoch"], df_log["train_loss"], label="train")
    axes[0].plot(df_log["epoch"], df_log["val_loss"], label="val")
    axes[0].axvline(best_epoch, color="green", linestyle="--", alpha=0.5,
                    label=f"best (epoch {best_epoch})")
    axes[0].set_xlabel("epoch"); axes[0].set_ylabel("loss")
    axes[0].set_title("Loss"); axes[0].legend(); axes[0].grid(alpha=0.3)

    axes[1].plot(df_log["epoch"], df_log["train_acc"], label="train")
    axes[1].plot(df_log["epoch"], df_log["val_acc"], label="val")
    axes[1].axvline(best_epoch, color="green", linestyle="--", alpha=0.5,
                    label=f"best (epoch {best_epoch})")
    axes[1].set_xlabel("epoch"); axes[1].set_ylabel("accuracy")
    axes[1].set_title("Accuracy"); axes[1].legend(); axes[1].grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(RESULTS_DIR / "training_curves.png", dpi=150)
    plt.close()

    # ---- Test on best checkpoint ----
    print("\n" + "=" * 60)
    print("  Test set — Fusion MLP best checkpoint")
    print("=" * 60)
    model.load_state_dict(torch.load(RESULTS_DIR / "best_model.pt", map_location=device))
    probs, preds, labels = predict_split(model, test_ds, device)
    test_acc, test_macro_f1, hr = write_test_artifacts(test_ds, probs, preds, labels)
    print(f"\nTest accuracy : {test_acc:.4f}")
    print(f"Macro F1      : {test_macro_f1:.4f}")
    print(f"High-risk recall: {hr:.4f}")

    # ---- Summary ----
    summary = (
        f"Fusion MLP — summary ({_PROTOCOL.upper()} protocol)\n"
        f"=============================================\n"
        f"Random seed         : {RANDOM_SEED}\n"
        f"Input dim           : {len(train_ds.feature_columns)}\n"
        f"Train samples       : {len(train_ds)}\n"
        f"Val samples         : {len(val_ds)}\n"
        f"Test samples        : {len(test_ds)}\n"
        f"Best epoch          : {best_epoch}\n"
        f"Best val accuracy   : {best_val_acc:.4f}\n"
        f"Wall time           : {total_elapsed/60:.1f} min\n"
        f"\n"
        f"Test  accuracy      : {test_acc:.4f}\n"
        f"Test  macro F1      : {test_macro_f1:.4f}\n"
        f"Test  high-risk recall : {hr:.4f}\n"
    )
    print("\n" + summary)
    (RESULTS_DIR / "summary.txt").write_text(summary, encoding="utf-8")

    # ---- Side-by-side comparison ----
    write_comparison(test_acc, test_macro_f1, hr)

    print(f"\nAll fusion artifacts saved in: {RESULTS_DIR}")
    print("Done.")


if __name__ == "__main__":
    main()
