"""
Cross-Dataset (NTU -> UR) extension to the existing
cross_dataset_eval.py.

cross_dataset_eval.py covers the BASELINE RandomForest in both
directions (NTU->UR and UR->NTU). This file adds the same
NTU->UR direction for:

    1. Posture RandomForest (4-class)
    2. Fusion MLP (uses NTU-only ST-GCN + NTU-only baseline RF)

The opposite direction (UR->NTU) is NOT extended here:
    - Posture: UR has only ONE class (Lying), nothing to train.
    - Fusion : depends on a UR-only ST-GCN, which won't train on
               45 sequences.

ST-GCN under NTU->UR is trained by `stgcn/train.py` with
MODELS_PROTOCOL=cd_ntu2ur — see that file's CD branch.

================================================================
OUTPUTS — Codes/models/cross_dataset_results/
================================================================
Adds these files to the existing cross_dataset_results/ folder:

    posture_ntu_to_ur_classification_report.{txt,json}
    posture_ntu_to_ur_confusion_matrix.{csv,png}
    fusion_ntu_to_ur_classification_report.{txt,json}
    fusion_ntu_to_ur_confusion_matrix.{csv,png}
    extended_summary.csv     all CD results in one table
"""

import sys
import json
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

import torch
import torch.nn as nn
from torch.utils.data import DataLoader

import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    recall_score,
)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "stgcn"))

from paths import OUTPUTS

from stgcn.dataset import (
    LABEL_TO_INDEX,
    INDEX_TO_LABEL,
    NUM_CLASSES,
)
from stgcn.model import STGCN


# ============================================================
# CONFIG
# ============================================================
FEATURES_PATH = OUTPUTS / "Feature_Dataset" / "features_dataset.csv"
COMMON_METADATA_PATH = OUTPUTS / "Common_Joint_Sequences" / "common_joint_metadata.csv"

RESULTS_DIR = Path(__file__).resolve().parent / "cross_dataset_results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

STGCN_CD_NTU_BEST = (
    Path(__file__).resolve().parent / "stgcn_results_cd_ntu2ur" / "best_model.pt"
)

TARGET_CLASSES = ["low_risk", "moderate_risk", "high_risk"]
NON_FEATURE_COLUMNS = [
    "sequence_id",
    "dataset",
    "label",
    "risk_level",
    "pose_array_path",
]
POSTURE_CLASSES = ["Lying", "Sitting", "Standing", "Walking"]
ACTION_TO_POSTURE = {
    "sit_down":     "Sitting",
    "squat_down":   "Sitting",
    "stand_up":     "Standing",
    "staggering":   "Walking",
    "falling_down": "Lying",
    "fall":         "Lying",
}

RANDOM_STATE = 42

RF_PARAMS = {
    "n_estimators": 300,
    "max_depth": None,
    "min_samples_split": 5,
    "min_samples_leaf": 2,
    "class_weight": "balanced",
    "random_state": RANDOM_STATE,
    "n_jobs": -1,
}

POSTURE_RF_PARAMS = {
    "n_estimators": 200,
    "max_depth": None,
    "min_samples_split": 5,
    "min_samples_leaf": 2,
    "class_weight": "balanced",
    "random_state": RANDOM_STATE,
    "n_jobs": -1,
}


# ============================================================
# UTILITIES
# ============================================================
def save_confusion_matrix(cm, classes, title, path_csv, path_png):
    cm_df = pd.DataFrame(
        cm,
        index=[f"true_{c}" for c in classes],
        columns=[f"pred_{c}" for c in classes],
    )
    cm_df.to_csv(path_csv)

    fig, ax = plt.subplots(figsize=(7, 6))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(classes)))
    ax.set_yticks(range(len(classes)))
    ax.set_xticklabels(classes, rotation=20, ha="right")
    ax.set_yticklabels(classes)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(title)
    threshold = cm.max() / 2.0 if cm.max() > 0 else 0.5
    for i in range(len(classes)):
        for j in range(len(classes)):
            ax.text(
                j, i, f"{cm[i, j]}",
                ha="center", va="center",
                color="white" if cm[i, j] > threshold else "black",
                fontweight="bold",
            )
    plt.colorbar(im, ax=ax)
    plt.tight_layout()
    plt.savefig(path_png, dpi=150)
    plt.close()


# ============================================================
# 1) POSTURE — train NTU only, test UR only
# ============================================================
def compute_posture_features(sequence: np.ndarray) -> dict:
    """Same 8 features as posture_rf.py."""
    HEAD = 0
    L_SHOULDER, R_SHOULDER = 1, 2
    L_HIP, R_HIP = 7, 8
    L_KNEE, R_KNEE = 9, 10
    L_ANKLE, R_ANKLE = 11, 12

    shoulder_center = (sequence[:, L_SHOULDER, :] + sequence[:, R_SHOULDER, :]) / 2
    hip_center = (sequence[:, L_HIP, :] + sequence[:, R_HIP, :]) / 2
    torso = shoulder_center - hip_center
    incline_angles = np.degrees(
        np.arctan2(np.abs(torso[:, 0]), np.abs(torso[:, 1]) + 1e-6)
    )

    hip_y = (sequence[:, L_HIP, 1] + sequence[:, R_HIP, 1]) / 2
    knee_y = (sequence[:, L_KNEE, 1] + sequence[:, R_KNEE, 1]) / 2
    head_y = sequence[:, HEAD, 1]
    ankle_y = (sequence[:, L_ANKLE, 1] + sequence[:, R_ANKLE, 1]) / 2

    body_extent = float(np.abs(head_y - ankle_y).mean()) + 1e-6
    knee_hip_drop_ratio = float(np.abs(knee_y - hip_y).mean()) / body_extent

    ankle_xy = (sequence[:, L_ANKLE, :2] + sequence[:, R_ANKLE, :2]) / 2
    ankle_motion = (
        float(np.linalg.norm(np.diff(ankle_xy, axis=0), axis=1).mean()) / body_extent
    )

    ankle_center_3d = (sequence[:, L_ANKLE, :] + sequence[:, R_ANKLE, :]) / 2
    body_height = np.linalg.norm(sequence[:, HEAD, :] - ankle_center_3d, axis=1)
    mean_body_height = float(body_height.mean())
    std_body_height_norm = float(body_height.std()) / (mean_body_height + 1e-6)

    joint_velocity = np.diff(sequence, axis=0)
    joint_speed = np.linalg.norm(joint_velocity, axis=2)
    mean_joint_speed = float(joint_speed.mean())

    std_hip_y = float(hip_y.std())

    return {
        "mean_torso_inclination": round(float(incline_angles.mean()), 4),
        "std_torso_inclination": round(float(incline_angles.std()), 4),
        "knee_hip_drop_ratio": round(knee_hip_drop_ratio, 4),
        "ankle_motion": round(ankle_motion, 4),
        "mean_body_height": round(mean_body_height, 4),
        "std_body_height_norm": round(std_body_height_norm, 4),
        "mean_joint_speed": round(mean_joint_speed, 4),
        "std_hip_y": round(std_hip_y, 4),
    }


POSTURE_FEATURE_COLS = [
    "mean_torso_inclination",
    "std_torso_inclination",
    "knee_hip_drop_ratio",
    "ankle_motion",
    "mean_body_height",
    "std_body_height_norm",
    "mean_joint_speed",
    "std_hip_y",
]


def run_posture_ntu_to_ur():
    print("\n" + "=" * 60)
    print("  Posture RF — Cross-Dataset NTU -> UR")
    print("=" * 60)

    meta = pd.read_csv(COMMON_METADATA_PATH)
    rows = []
    for _, row in meta.iterrows():
        action_label = row["label"]
        if action_label not in ACTION_TO_POSTURE:
            continue
        try:
            pose = np.load(row["pose_array_path"])
        except Exception:
            continue
        if pose.shape != (100, 14, 3):
            continue
        feats = compute_posture_features(pose)
        rows.append({
            "sequence_id": row["sequence_id"],
            "dataset": row["dataset"],
            "posture": ACTION_TO_POSTURE[action_label],
            **feats,
        })
    df = pd.DataFrame(rows)
    print(f"  Posture-mapped sequences: {len(df)}")

    train_df = df[df["dataset"] == "NTU"].reset_index(drop=True)
    test_df = df[df["dataset"] == "UR"].reset_index(drop=True)
    print(f"  Train (NTU): n={len(train_df)}  classes={train_df['posture'].value_counts().to_dict()}")
    print(f"  Test  (UR ): n={len(test_df)}   classes={test_df['posture'].value_counts().to_dict()}")

    if len(test_df) == 0:
        print("  No UR posture-mapped sequences (UR adl excluded). Skipping.")
        return None

    X_train = train_df[POSTURE_FEATURE_COLS].values.astype(np.float32)
    y_train = train_df["posture"].values
    X_test = test_df[POSTURE_FEATURE_COLS].values.astype(np.float32)
    y_test = test_df["posture"].values

    model = RandomForestClassifier(**POSTURE_RF_PARAMS)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    txt = classification_report(
        y_test, y_pred, labels=POSTURE_CLASSES, digits=4, zero_division=0
    )
    print(txt)
    (RESULTS_DIR / "posture_ntu_to_ur_classification_report.txt").write_text(
        txt, encoding="utf-8"
    )
    rep = classification_report(
        y_test, y_pred, labels=POSTURE_CLASSES, output_dict=True, zero_division=0
    )
    with open(RESULTS_DIR / "posture_ntu_to_ur_classification_report.json",
              "w", encoding="utf-8") as f:
        json.dump(rep, f, indent=2)

    cm = confusion_matrix(y_test, y_pred, labels=POSTURE_CLASSES)
    save_confusion_matrix(
        cm, POSTURE_CLASSES,
        "Posture RF — Cross-Dataset NTU -> UR",
        RESULTS_DIR / "posture_ntu_to_ur_confusion_matrix.csv",
        RESULTS_DIR / "posture_ntu_to_ur_confusion_matrix.png",
    )

    acc = accuracy_score(y_test, y_pred)
    macro_f1 = f1_score(y_test, y_pred, average="macro",
                        labels=POSTURE_CLASSES, zero_division=0)
    print(f"Accuracy : {acc:.4f}")
    print(f"Macro F1 : {macro_f1:.4f}")

    return {
        "model": "Posture RandomForest",
        "direction": "NTU -> UR",
        "n_train": len(train_df),
        "n_test": len(test_df),
        "accuracy": round(acc, 4),
        "macro_f1": round(macro_f1, 4),
        "high_risk_recall": None,  # not applicable for posture
    }


# ============================================================
# 2) FUSION — train NTU only (using NTU-trained ST-GCN + NTU-trained RF)
#    test UR only
# ============================================================
class FusionMLP(nn.Module):
    def __init__(self, input_dim: int = 24, num_classes: int = 3):
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


@torch.no_grad()
def stgcn_logits_for_rows(model, df_rows, device, batch_size=32):
    """Run NTU-trained ST-GCN on a subset of sequences (by sequence_id).
    Returns a DataFrame with stgcn_logit_low/_moderate/_high columns."""
    rows = []
    for i in range(0, len(df_rows), batch_size):
        batch = df_rows.iloc[i:i + batch_size]
        tensors = []
        for _, r in batch.iterrows():
            pose = np.load(r["pose_array_path"])
            assert pose.shape == (100, 14, 3)
            pose = pose.transpose(2, 0, 1)
            tensors.append(torch.from_numpy(pose).float())
        x = torch.stack(tensors).to(device)
        logits = model(x).cpu().numpy()
        for j, (_, r) in enumerate(batch.iterrows()):
            rows.append({
                "sequence_id": r["sequence_id"],
                "stgcn_logit_low": float(logits[j, 0]),
                "stgcn_logit_moderate": float(logits[j, 1]),
                "stgcn_logit_high": float(logits[j, 2]),
            })
    return pd.DataFrame(rows)


def run_fusion_ntu_to_ur():
    print("\n" + "=" * 60)
    print("  Fusion MLP — Cross-Dataset NTU -> UR")
    print("=" * 60)

    if not STGCN_CD_NTU_BEST.exists():
        print(f"  SKIP: NTU-only ST-GCN checkpoint not found at\n"
              f"  {STGCN_CD_NTU_BEST}")
        print("  Run `MODELS_PROTOCOL=cd_ntu2ur python stgcn/train.py` first.")
        return None

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # --- Load pose metadata + features ---
    meta = pd.read_csv(COMMON_METADATA_PATH)
    features = pd.read_csv(FEATURES_PATH)
    feature_cols = [c for c in features.columns if c not in NON_FEATURE_COLUMNS]
    df_full = meta.merge(features.drop(columns=["dataset", "label", "risk_level",
                                                 "pose_array_path"]),
                         on="sequence_id", how="inner")

    train_df = df_full[df_full["dataset"] == "NTU"].reset_index(drop=True)
    test_df = df_full[df_full["dataset"] == "UR"].reset_index(drop=True)
    print(f"  Train (NTU): n={len(train_df)}")
    print(f"  Test  (UR ): n={len(test_df)}")

    # --- Train an RF on NTU only (for the RF prob stream) ---
    X_rf_train = train_df[feature_cols].values.astype(np.float32)
    y_rf_train = train_df["risk_level"].values
    rf = RandomForestClassifier(**RF_PARAMS)
    rf.fit(X_rf_train, y_rf_train)

    def rf_aligned_probs(df_rows):
        probs = rf.predict_proba(df_rows[feature_cols].values.astype(np.float32))
        class_to_idx = {c: i for i, c in enumerate(rf.classes_)}
        aligned = np.zeros((len(df_rows), 3), dtype=np.float32)
        for i, cls in enumerate(TARGET_CLASSES):
            aligned[:, i] = probs[:, class_to_idx[cls]]
        return aligned

    # --- ST-GCN logits using NTU-only checkpoint ---
    stgcn = STGCN(num_classes=NUM_CLASSES, in_channels=3, t_kernel=9).to(device)
    stgcn.load_state_dict(torch.load(STGCN_CD_NTU_BEST, map_location=device))
    stgcn.eval()

    print("  Running ST-GCN inference on train (NTU)...")
    stgcn_train = stgcn_logits_for_rows(stgcn, train_df, device)
    print("  Running ST-GCN inference on test (UR)...")
    stgcn_test = stgcn_logits_for_rows(stgcn, test_df, device)

    # --- Build 24-dim fusion input vectors ---
    def build_fusion_X(df_rows, stgcn_df):
        merged = df_rows.merge(stgcn_df, on="sequence_id", how="inner")
        rf_probs = rf_aligned_probs(merged)
        cols = list(merged.columns)
        feat_block = merged[feature_cols].values.astype(np.float32)
        stgcn_block = merged[
            ["stgcn_logit_low", "stgcn_logit_moderate", "stgcn_logit_high"]
        ].values.astype(np.float32)
        X = np.concatenate([stgcn_block, rf_probs, feat_block], axis=1)
        y = merged["risk_level"].map(LABEL_TO_INDEX).values.astype(np.int64)
        return X, y, merged

    X_train, y_train, train_merged = build_fusion_X(train_df, stgcn_train)
    X_test, y_test, test_merged = build_fusion_X(test_df, stgcn_test)
    print(f"  Fusion input dim: {X_train.shape[1]}")

    # --- Train fusion MLP ---
    torch.manual_seed(RANDOM_STATE)
    model = FusionMLP(input_dim=X_train.shape[1], num_classes=NUM_CLASSES).to(device)

    counts = np.bincount(y_train, minlength=NUM_CLASSES).astype(np.float32)
    cw = torch.from_numpy(len(y_train) / (NUM_CLASSES * counts)).to(device)
    criterion = nn.CrossEntropyLoss(weight=cw)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)

    X_train_t = torch.from_numpy(X_train).to(device)
    y_train_t = torch.from_numpy(y_train).to(device)
    X_test_t = torch.from_numpy(X_test).to(device)

    best_train_acc = 0.0
    for epoch in range(1, 51):
        model.train()
        perm = torch.randperm(len(X_train_t))
        bs = 64
        running = 0.0
        for i in range(0, len(perm), bs):
            idx = perm[i:i + bs]
            optimizer.zero_grad()
            logits = model(X_train_t[idx])
            loss = criterion(logits, y_train_t[idx])
            loss.backward()
            optimizer.step()
            running += loss.item() * len(idx)
        # quick train-acc check
        model.eval()
        with torch.no_grad():
            train_pred = model(X_train_t).argmax(dim=1).cpu().numpy()
        tr_acc = (train_pred == y_train).mean()
        if tr_acc > best_train_acc:
            best_train_acc = tr_acc

    # --- Test ---
    model.eval()
    with torch.no_grad():
        test_pred_idx = model(X_test_t).argmax(dim=1).cpu().numpy()

    y_true_str = [INDEX_TO_LABEL[int(l)] for l in y_test]
    y_pred_str = [INDEX_TO_LABEL[int(p)] for p in test_pred_idx]

    txt = classification_report(
        y_true_str, y_pred_str, labels=TARGET_CLASSES, digits=4, zero_division=0
    )
    print(txt)
    (RESULTS_DIR / "fusion_ntu_to_ur_classification_report.txt").write_text(
        txt, encoding="utf-8"
    )
    rep = classification_report(
        y_true_str, y_pred_str, labels=TARGET_CLASSES,
        output_dict=True, zero_division=0,
    )
    with open(RESULTS_DIR / "fusion_ntu_to_ur_classification_report.json",
              "w", encoding="utf-8") as f:
        json.dump(rep, f, indent=2)

    cm = confusion_matrix(y_true_str, y_pred_str, labels=TARGET_CLASSES)
    save_confusion_matrix(
        cm, TARGET_CLASSES,
        "Fusion MLP — Cross-Dataset NTU -> UR",
        RESULTS_DIR / "fusion_ntu_to_ur_confusion_matrix.csv",
        RESULTS_DIR / "fusion_ntu_to_ur_confusion_matrix.png",
    )

    acc = accuracy_score(y_true_str, y_pred_str)
    macro_f1 = f1_score(y_true_str, y_pred_str, average="macro",
                        labels=TARGET_CLASSES, zero_division=0)
    if (np.array(y_true_str) == "high_risk").sum() > 0:
        hr = recall_score(y_true_str, y_pred_str, labels=["high_risk"],
                          average="macro", zero_division=0)
    else:
        hr = float("nan")
    print(f"Accuracy        : {acc:.4f}")
    print(f"Macro F1        : {macro_f1:.4f}")
    print(f"High-risk recall: {hr if np.isnan(hr) else round(hr, 4)}")

    return {
        "model": "Fusion MLP",
        "direction": "NTU -> UR",
        "n_train": len(train_df),
        "n_test": len(test_df),
        "accuracy": round(acc, 4),
        "macro_f1": round(macro_f1, 4),
        "high_risk_recall": (round(hr, 4) if not np.isnan(hr) else None),
    }


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 60)
    print("  Cross-Dataset extension (Posture + Fusion, NTU -> UR)")
    print("=" * 60)

    rows = []
    posture_row = run_posture_ntu_to_ur()
    if posture_row is not None:
        rows.append(posture_row)

    fusion_row = run_fusion_ntu_to_ur()
    if fusion_row is not None:
        rows.append(fusion_row)

    if rows:
        out = pd.DataFrame(rows)
        out.to_csv(RESULTS_DIR / "extended_summary.csv", index=False)
        print("\n" + "=" * 60)
        print("  Extended summary")
        print("=" * 60)
        print(out.to_string(index=False))
        print(f"\nSaved: {RESULTS_DIR / 'extended_summary.csv'}")
    print("\nDone.")


if __name__ == "__main__":
    main()
