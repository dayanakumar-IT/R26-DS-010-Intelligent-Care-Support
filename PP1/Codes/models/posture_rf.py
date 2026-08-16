"""
Posture classifier — 4-class (Lying / Sitting / Standing / Walking).

================================================================
ROLE IN THE COMPONENT
================================================================
The frontend's `Patient.posture` field expects one of four posture
states. The proposal commits to:

    "posture states such as sitting, standing, walking, and lying
     are identified using joint relationships."

This script delivers that with a real trained model rather than a
geometric heuristic.

================================================================
LABEL SOURCE — ACTION-DERIVED, NOT HEURISTIC
================================================================
Posture labels come from the dataset's own action annotations,
mapped to the four posture classes:

    NTU sit_down     -> Sitting
    NTU squat_down   -> Sitting
    NTU stand_up     -> Standing
    NTU staggering   -> Walking
    NTU falling_down -> Lying
    UR  fall (cam0+cam1) -> Lying
    UR  normal/adl    -> EXCLUDED  (mixed activities, no consistent
                                    ground-truth posture)

This is the principled alternative to a geometric heuristic. The
labels are independent of the model's input features, so trained
accuracy is a real measurement of how well the chosen features
predict action-class membership.

================================================================
INPUT FEATURES (8)
================================================================
    1. mean_torso_inclination   degrees from vertical
    2. std_torso_inclination    sway / instability
    3. knee_hip_drop_ratio      folded knees -> sitting
    4. ankle_motion             frame-to-frame ankle motion -> walking
    5. mean_body_height         head-to-ankle distance
    6. std_body_height_norm     variation indicates posture transition
    7. mean_joint_speed         overall body movement
    8. std_hip_y                vertical hip motion

================================================================
EXPERIMENT DESIGN
================================================================
Training data : combined NTU + UR (UR adl excluded — see above).
Splits        : Cross-Subject (CS) — same splits as baseline RF.
                Subjects with no posture-mapped action (UR adl)
                are dropped at row level after split assignment.
Class balance : class_weight="balanced". Sitting is roughly 2x
                larger than the others because A008 and A080 both
                map to it.

================================================================
OUTPUTS — Codes/models/posture_results/
================================================================
    posture_dataset.csv               features + posture label per
                                      sequence (model-ready frame)
    label_distribution.csv            counts per posture per dataset
    val_classification_report.{txt,json}
    val_confusion_matrix.{csv,png}
    test_classification_report.{txt,json}
    test_confusion_matrix.{csv,png}
    feature_importance.{csv,png}
    model.pkl                         trained RandomForest
    summary.txt                       headline numbers
"""

import sys
import json
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
import joblib

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from paths import OUTPUTS
from split_utils import load_splits


# ============================================================
# CONFIG
# ============================================================
COMMON_METADATA_PATH = OUTPUTS / "Common_Joint_Sequences" / "common_joint_metadata.csv"

# Output folder switches with MODELS_PROTOCOL ('cs' default, 'cv' for
# Cross-View). split_utils picks the input splits folder accordingly.
import os
_PROTOCOL = os.environ.get("MODELS_PROTOCOL", "cs").lower()
if _PROTOCOL == "cv":
    RESULTS_DIR = Path(__file__).resolve().parent / "posture_results_cv"
else:
    RESULTS_DIR = Path(__file__).resolve().parent / "posture_results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

POSTURE_CLASSES = ["Lying", "Sitting", "Standing", "Walking"]

ACTION_TO_POSTURE = {
    # NTU
    "sit_down":     "Sitting",
    "squat_down":   "Sitting",
    "stand_up":     "Standing",
    "staggering":   "Walking",
    "falling_down": "Lying",
    # UR
    "fall":         "Lying",
    # UR "normal" (adl) intentionally absent -> excluded
}

RANDOM_STATE = 42

RF_PARAMS = {
    "n_estimators": 200,
    "max_depth": None,
    "min_samples_split": 5,
    "min_samples_leaf": 2,
    "class_weight": "balanced",
    "random_state": RANDOM_STATE,
    "n_jobs": -1,
}

# 14-joint common skeleton indices
HEAD = 0
L_SHOULDER, R_SHOULDER = 1, 2
L_HIP, R_HIP = 7, 8
L_KNEE, R_KNEE = 9, 10
L_ANKLE, R_ANKLE = 11, 12

FEATURE_COLS = [
    "mean_torso_inclination",
    "std_torso_inclination",
    "knee_hip_drop_ratio",
    "ankle_motion",
    "mean_body_height",
    "std_body_height_norm",
    "mean_joint_speed",
    "std_hip_y",
]


# ============================================================
# FEATURE EXTRACTION
# ============================================================
def compute_posture_features(sequence: np.ndarray) -> dict:
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


# ============================================================
# DATASET BUILD — ACTION-DERIVED LABELS
# ============================================================
def build_dataset() -> pd.DataFrame:
    print(f"\nLoading metadata: {COMMON_METADATA_PATH}")
    meta = pd.read_csv(COMMON_METADATA_PATH)
    print(f"Total sequences in metadata: {len(meta)}")

    rows = []
    excluded_no_mapping = 0

    for idx, row in meta.iterrows():
        if (idx + 1) % 1000 == 0:
            print(f"  feature extraction: {idx + 1}/{len(meta)}")

        action_label = row["label"]
        if action_label not in ACTION_TO_POSTURE:
            excluded_no_mapping += 1
            continue

        posture = ACTION_TO_POSTURE[action_label]

        pose = np.load(row["pose_array_path"])
        if pose.shape != (100, 14, 3):
            print(f"  skipped {row['sequence_id']} (bad shape {pose.shape})")
            continue

        features = compute_posture_features(pose)
        rows.append({
            "sequence_id": row["sequence_id"],
            "dataset": row["dataset"],
            "action_label": action_label,
            "risk_level": row["risk_level"],
            **features,
            "posture": posture,
        })

    df = pd.DataFrame(rows)
    df.to_csv(RESULTS_DIR / "posture_dataset.csv", index=False)

    print(f"\nDataset built: {len(df)} sequences (excluded {excluded_no_mapping} unmapped)")
    print("\nPosture distribution (action-derived):")
    print(df["posture"].value_counts().to_string())
    print("\nDataset breakdown:")
    print(df.groupby(["dataset", "posture"]).size().to_string())

    dist = df.groupby(["dataset", "posture"]).size().reset_index(name="count")
    dist.to_csv(RESULTS_DIR / "label_distribution.csv", index=False)

    return df


# ============================================================
# SPLITTING — same CS splits as baseline RF, after dropping
# the rows with no posture mapping (UR adl).
# ============================================================
def apply_splits(df: pd.DataFrame):
    splits = load_splits()
    train_ids = set(splits["train"]["sequence_id"])
    val_ids = set(splits["val"]["sequence_id"])
    test_ids = set(splits["test"]["sequence_id"])

    df_train = df[df["sequence_id"].isin(train_ids)].reset_index(drop=True)
    df_val = df[df["sequence_id"].isin(val_ids)].reset_index(drop=True)
    df_test = df[df["sequence_id"].isin(test_ids)].reset_index(drop=True)

    print("\nSplits (after dropping unmapped sequences):")
    for name, sub in (("train", df_train), ("val", df_val), ("test", df_test)):
        print(f"  {name:>5}: n={len(sub):>4}  {sub['posture'].value_counts().to_dict()}")

    return df_train, df_val, df_test


# ============================================================
# TRAIN + EVALUATE
# ============================================================
def evaluate_split(model, df_split, split_name: str):
    X = df_split[FEATURE_COLS].values
    y = df_split["posture"].values
    y_pred = model.predict(X)

    print("\n" + "=" * 60)
    print(f"  {split_name.upper()} (n={len(df_split)})")
    print("=" * 60)

    report_text = classification_report(
        y, y_pred, labels=POSTURE_CLASSES, digits=4, zero_division=0
    )
    print(report_text)

    acc = accuracy_score(y, y_pred)
    macro_f1 = f1_score(
        y, y_pred, average="macro", labels=POSTURE_CLASSES, zero_division=0
    )
    print(f"Accuracy : {acc:.4f}")
    print(f"Macro F1 : {macro_f1:.4f}")

    (RESULTS_DIR / f"{split_name}_classification_report.txt").write_text(
        report_text, encoding="utf-8"
    )
    report_dict = classification_report(
        y, y_pred, labels=POSTURE_CLASSES, output_dict=True, zero_division=0
    )
    with open(
        RESULTS_DIR / f"{split_name}_classification_report.json",
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(report_dict, f, indent=2)

    cm = confusion_matrix(y, y_pred, labels=POSTURE_CLASSES)
    cm_df = pd.DataFrame(
        cm,
        index=[f"true_{c}" for c in POSTURE_CLASSES],
        columns=[f"pred_{c}" for c in POSTURE_CLASSES],
    )
    cm_df.to_csv(RESULTS_DIR / f"{split_name}_confusion_matrix.csv")

    fig, ax = plt.subplots(figsize=(7, 6))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(POSTURE_CLASSES)))
    ax.set_yticks(range(len(POSTURE_CLASSES)))
    ax.set_xticklabels(POSTURE_CLASSES, rotation=20, ha="right")
    ax.set_yticklabels(POSTURE_CLASSES)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(f"Posture classifier — confusion matrix ({split_name.upper()})")
    threshold = cm.max() / 2.0
    for i in range(len(POSTURE_CLASSES)):
        for j in range(len(POSTURE_CLASSES)):
            ax.text(
                j, i, f"{cm[i, j]}",
                ha="center", va="center",
                color="white" if cm[i, j] > threshold else "black",
                fontweight="bold",
            )
    plt.colorbar(im, ax=ax)
    plt.tight_layout()
    plt.savefig(RESULTS_DIR / f"{split_name}_confusion_matrix.png", dpi=150)
    plt.close()

    return acc, macro_f1


def save_feature_importance(model):
    fi_df = (
        pd.DataFrame({"feature": FEATURE_COLS, "importance": model.feature_importances_})
        .sort_values("importance", ascending=False)
        .reset_index(drop=True)
    )
    print("\n" + "=" * 60)
    print("  Feature importance (Gini)")
    print("=" * 60)
    print(fi_df.to_string(index=False))
    fi_df.to_csv(RESULTS_DIR / "feature_importance.csv", index=False)

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.barh(fi_df["feature"][::-1], fi_df["importance"][::-1], color="steelblue")
    ax.set_xlabel("Gini importance")
    ax.set_title("Posture classifier — feature importance")
    plt.tight_layout()
    plt.savefig(RESULTS_DIR / "feature_importance.png", dpi=150)
    plt.close()


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 60)
    print(f"  Posture classifier ({_PROTOCOL.upper()} protocol)")
    print("=" * 60)

    df = build_dataset()
    df_train, df_val, df_test = apply_splits(df)

    print("\n" + "=" * 60)
    print("  Training RandomForest")
    print("=" * 60)
    print(f"Hyperparameters: {RF_PARAMS}")

    X_train = df_train[FEATURE_COLS].values
    y_train = df_train["posture"].values

    model = RandomForestClassifier(**RF_PARAMS)
    model.fit(X_train, y_train)

    val_acc, val_macro_f1 = evaluate_split(model, df_val, "val")
    test_acc, test_macro_f1 = evaluate_split(model, df_test, "test")

    save_feature_importance(model)

    joblib.dump(model, RESULTS_DIR / "model.pkl")

    protocol_label = (
        "Cross-View (CV) — train C002+C003, test C001 (NTU only)"
        if _PROTOCOL == "cv" else "Cross-Subject (CS)"
    )
    training_scope = (
        "NTU only (UR excluded; CV not applicable)"
        if _PROTOCOL == "cv" else "combined NTU + UR (UR adl excluded)"
    )
    summary = (
        f"Posture classifier — summary (action-derived labels)\n"
        f"=====================================================\n"
        f"Protocol            : {protocol_label}\n"
        f"Training            : {training_scope}\n"
        f"Random seed         : {RANDOM_STATE}\n"
        f"Train samples       : {len(df_train)}\n"
        f"Val   samples       : {len(df_val)}\n"
        f"Test  samples       : {len(df_test)}\n"
        f"Classes             : {POSTURE_CLASSES}\n"
        f"Hyperparameters     : {RF_PARAMS}\n"
        f"\n"
        f"Validation accuracy : {val_acc:.4f}\n"
        f"Validation macro F1 : {val_macro_f1:.4f}\n"
        f"Test       accuracy : {test_acc:.4f}\n"
        f"Test       macro F1 : {test_macro_f1:.4f}\n"
        f"\n"
        f"Model saved         : {RESULTS_DIR / 'model.pkl'}\n"
    )
    print("\n" + summary)
    (RESULTS_DIR / "summary.txt").write_text(summary, encoding="utf-8")

    print(f"\nAll results saved in: {RESULTS_DIR}")
    print("Done.")


if __name__ == "__main__":
    main()
