"""
RandomForest baseline — observable fall-risk classifier.

================================================================
ROLE IN THE COMPONENT
================================================================
Trains a Random Forest on the 18 hand-crafted motion features in
`features_dataset.csv` to predict the 3-class risk score:

    low_risk   /   moderate_risk   /   high_risk

Two roles for this model:

  1. Research-grade baseline for the deep ST-GCN. Lets the report
     quantify what the GCN buys over hand-crafted features.

  2. Lightweight fallback path for the edge device. ~10 MB on disk,
     sub-millisecond inference, runs anywhere even if the GCN's CPU
     budget is exceeded.

================================================================
EXPERIMENT DESIGN
================================================================
Training data : combined NTU + UR (4,797 sequences total).

  Why combined and not per-dataset?
    UR has only 45 sequences — far too few to train a model
    independently. NTU's 4,752 give the model the *grammar* of
    human motion, while UR's 45 contribute domain exposure to a
    different camera setup. This mirrors the standard fall-detection
    literature pattern.

Splitting    : Cross-Subject (CS) protocol, see cross_subject_split.py.
                Each NTU performer (P###) and each UR recording
                session (adl-NN / fall-NN) appears in exactly ONE
                of train / val / test. No subject leakage.

Class balance : class_weight="balanced". The natural ratio is roughly
                2 : 2 : 1 (low : moderate : high). Balanced weighting
                reduces bias toward majority classes — high-risk false
                negatives (missed falls) are the worst failure mode.

Metrics      : test accuracy, macro F1, high-risk recall, per-dataset
                breakdown (UR vs NTU), 5-fold CV on TRAIN only,
                Gini feature importance.

  Why CV on train only?
    CV on the full dataset would leak test samples into the folds,
    inflating the estimate. Train-only CV gives an honest train-set
    robustness number while leaving test untouched.

================================================================
OUTPUTS — Codes/models/baseline_results/
================================================================
    val_classification_report.{txt,json}
    val_confusion_matrix.{csv,png}
    test_classification_report.{txt,json}     <- HEADLINE NUMBERS
    test_confusion_matrix.{csv,png}
    per_dataset_metrics.csv                   test, UR vs NTU
    high_risk_recall.txt                      test
    feature_importance.{csv,png}
    cv_scores.csv                             5-fold CV on train
    model.pkl                                 trained RandomForest
    summary.txt                               headline numbers in one place
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
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score
import joblib

# Allow importing paths.py and split_utils.py
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from paths import OUTPUTS
from split_utils import load_splits, split_indices_for_df


# ============================================================
# CONFIG
# ============================================================
FEATURES_PATH = OUTPUTS / "Feature_Dataset" / "features_dataset.csv"

# Output folder switches with MODELS_PROTOCOL ('cs' default, 'cv' for
# Cross-View). split_utils picks the input splits folder accordingly.
import os
_PROTOCOL = os.environ.get("MODELS_PROTOCOL", "cs").lower()
if _PROTOCOL == "cv":
    RESULTS_DIR = Path(__file__).resolve().parent / "baseline_results_cv"
else:
    RESULTS_DIR = Path(__file__).resolve().parent / "baseline_results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

TARGET_COLUMN = "risk_level"
TARGET_CLASSES = ["low_risk", "moderate_risk", "high_risk"]

NON_FEATURE_COLUMNS = [
    "sequence_id",
    "dataset",
    "label",
    "risk_level",
    "pose_array_path",
]

RANDOM_STATE = 42
CV_FOLDS = 5

RF_PARAMS = {
    "n_estimators": 300,
    "max_depth": None,
    "min_samples_split": 5,
    "min_samples_leaf": 2,
    "class_weight": "balanced",
    "random_state": RANDOM_STATE,
    "n_jobs": -1,
}


# ============================================================
# DATA + SPLITS
# ============================================================
def load_data():
    print(f"\nLoading features from: {FEATURES_PATH}")
    df = pd.read_csv(FEATURES_PATH)
    print(f"Loaded {len(df)} rows.")

    feature_cols = [c for c in df.columns if c not in NON_FEATURE_COLUMNS]

    n_before = len(df)
    df = df.dropna(subset=feature_cols).reset_index(drop=True)
    if len(df) != n_before:
        print(f"WARNING: dropped {n_before - len(df)} rows with NaN features.")

    X = df[feature_cols].values.astype(np.float32)
    y = df[TARGET_COLUMN].values

    print(f"\nFeatures used ({len(feature_cols)}):")
    for i, c in enumerate(feature_cols, 1):
        print(f"  {i:2d}. {c}")

    print(f"\nClass distribution (full corpus):")
    print(df[TARGET_COLUMN].value_counts().to_string())
    print("\nDataset distribution (full corpus):")
    print(df["dataset"].value_counts().to_string())

    return X, y, df, feature_cols


def report_split_composition(df, idx_dict):
    print("\n" + "=" * 60)
    print("  Cross-Subject splits (loaded from disk)")
    print("=" * 60)
    for name, idx in idx_dict.items():
        sub = df.iloc[idx]
        print(
            f"\n{name.upper():<5} n={len(idx):>4}  "
            f"({len(idx) / len(df) * 100:.1f}% of total)"
        )
        print("  Risk    :", sub[TARGET_COLUMN].value_counts().to_dict())
        print("  Dataset :", sub["dataset"].value_counts().to_dict())


# ============================================================
# TRAIN
# ============================================================
def train_model(X, y, train_idx):
    print("\n" + "=" * 60)
    print("  Training RandomForest on TRAIN set")
    print("=" * 60)
    print(f"Train n = {len(train_idx)}")
    print(f"Hyperparameters: {RF_PARAMS}")

    model = RandomForestClassifier(**RF_PARAMS)
    model.fit(X[train_idx], y[train_idx])
    return model


# ============================================================
# EVALUATE A SPLIT
# ============================================================
def evaluate_split(model, X, y, df, idx, split_name):
    print("\n" + "=" * 60)
    print(f"  Evaluate on {split_name.upper()} set")
    print("=" * 60)
    print(f"{split_name.upper()} n = {len(idx)}")

    y_true = y[idx]
    y_pred = model.predict(X[idx])

    report_text = classification_report(
        y_true, y_pred, labels=TARGET_CLASSES, digits=4, zero_division=0
    )
    print(report_text)

    report_dict = classification_report(
        y_true, y_pred, labels=TARGET_CLASSES, output_dict=True, zero_division=0
    )

    accuracy = accuracy_score(y_true, y_pred)
    macro_f1 = f1_score(
        y_true, y_pred, average="macro", labels=TARGET_CLASSES, zero_division=0
    )
    print(f"Accuracy : {accuracy:.4f}")
    print(f"Macro F1 : {macro_f1:.4f}")

    (RESULTS_DIR / f"{split_name}_classification_report.txt").write_text(
        report_text, encoding="utf-8"
    )
    with open(
        RESULTS_DIR / f"{split_name}_classification_report.json",
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(report_dict, f, indent=2)

    cm = confusion_matrix(y_true, y_pred, labels=TARGET_CLASSES)
    cm_df = pd.DataFrame(
        cm,
        index=[f"true_{c}" for c in TARGET_CLASSES],
        columns=[f"pred_{c}" for c in TARGET_CLASSES],
    )
    cm_df.to_csv(RESULTS_DIR / f"{split_name}_confusion_matrix.csv")

    fig, ax = plt.subplots(figsize=(7, 6))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(TARGET_CLASSES)))
    ax.set_yticks(range(len(TARGET_CLASSES)))
    ax.set_xticklabels(TARGET_CLASSES, rotation=20, ha="right")
    ax.set_yticklabels(TARGET_CLASSES)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(f"RandomForest — confusion matrix ({split_name.upper()})")
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
    plt.savefig(RESULTS_DIR / f"{split_name}_confusion_matrix.png", dpi=150)
    plt.close()

    return y_true, y_pred, accuracy, macro_f1


# ============================================================
# FEATURE IMPORTANCE
# ============================================================
def save_feature_importance(model, feature_cols):
    print("\n" + "=" * 60)
    print("  Feature importance (Gini, model trained on TRAIN only)")
    print("=" * 60)

    fi_df = (
        pd.DataFrame({"feature": feature_cols, "importance": model.feature_importances_})
        .sort_values("importance", ascending=False)
        .reset_index(drop=True)
    )
    print(fi_df.to_string(index=False))
    fi_df.to_csv(RESULTS_DIR / "feature_importance.csv", index=False)

    fig, ax = plt.subplots(figsize=(9, 7))
    ax.barh(fi_df["feature"][::-1], fi_df["importance"][::-1], color="steelblue")
    ax.set_xlabel("Gini importance")
    ax.set_title("RandomForest — motion feature importance")
    plt.tight_layout()
    plt.savefig(RESULTS_DIR / "feature_importance.png", dpi=150)
    plt.close()


# ============================================================
# PER-DATASET BREAKDOWN ON TEST
# ============================================================
def save_per_dataset_metrics(y_test, y_pred_test, df_test):
    print("\n" + "=" * 60)
    print("  Per-dataset metrics on TEST set")
    print("=" * 60)

    rows = []
    for dataset_name in ["UR", "NTU"]:
        mask = (df_test["dataset"] == dataset_name).values
        if mask.sum() == 0:
            continue
        y_t = np.asarray(y_test)[mask]
        y_p = np.asarray(y_pred_test)[mask]

        acc = accuracy_score(y_t, y_p)
        macro_f1 = f1_score(
            y_t, y_p, average="macro", labels=TARGET_CLASSES, zero_division=0
        )
        if (y_t == "high_risk").sum() > 0:
            high_risk_recall = recall_score(
                y_t, y_p, labels=["high_risk"], average="macro", zero_division=0
            )
        else:
            high_risk_recall = float("nan")

        row = {
            "dataset": dataset_name,
            "n_samples": int(mask.sum()),
            "accuracy": round(acc, 4),
            "macro_f1": round(macro_f1, 4),
            "high_risk_recall": (
                round(high_risk_recall, 4) if not np.isnan(high_risk_recall) else None
            ),
        }
        rows.append(row)
        print(
            f"{dataset_name:>4}: n={row['n_samples']:>4}  "
            f"acc={row['accuracy']:.4f}  macro_f1={row['macro_f1']:.4f}  "
            f"high_risk_recall={row['high_risk_recall']}"
        )

    pd.DataFrame(rows).to_csv(RESULTS_DIR / "per_dataset_metrics.csv", index=False)


# ============================================================
# HIGH-RISK RECALL ON TEST
# ============================================================
def save_high_risk_recall(y_test, y_pred_test):
    print("\n" + "=" * 60)
    print("  High-risk recall (TEST set)")
    print("=" * 60)

    high_risk_recall = recall_score(
        y_test, y_pred_test, labels=["high_risk"], average="macro", zero_division=0
    )
    n_high_risk = int((np.asarray(y_test) == "high_risk").sum())

    msg = (
        f"High-risk class (n={n_high_risk}) recall = {high_risk_recall:.4f}\n"
        f"\n"
        f"Of {n_high_risk} actual high-risk events in the test set,\n"
        f"  {round(high_risk_recall * n_high_risk)} were correctly flagged.\n"
        f"  The remaining {n_high_risk - round(high_risk_recall * n_high_risk)} "
        f"would be MISSED FALLS.\n"
    )
    print(msg)
    (RESULTS_DIR / "high_risk_recall.txt").write_text(msg, encoding="utf-8")
    return high_risk_recall


# ============================================================
# 5-FOLD CV ON TRAIN
# ============================================================
def cross_validate_on_train(X, y, train_idx, df):
    print("\n" + "=" * 60)
    print(f"  {CV_FOLDS}-fold CV on TRAIN set "
          f"(stratified by dataset + risk_level)")
    print("=" * 60)

    X_train = X[train_idx]
    y_train = y[train_idx]
    train_strat = (
        df.iloc[train_idx]["dataset"].astype(str)
        + "_"
        + df.iloc[train_idx][TARGET_COLUMN].astype(str)
    ).values

    codes = pd.Categorical(train_strat).codes
    skf = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    splits = list(skf.split(X_train, codes))

    model = RandomForestClassifier(**RF_PARAMS)
    scores = cross_val_score(
        model, X_train, y_train, cv=splits, scoring="accuracy", n_jobs=-1
    )
    print(f"Per-fold accuracy: {[f'{s:.4f}' for s in scores]}")
    print(f"Mean : {scores.mean():.4f}")
    print(f"Std  : {scores.std():.4f}")

    pd.DataFrame(
        {"fold": list(range(1, CV_FOLDS + 1)), "accuracy": scores}
    ).to_csv(RESULTS_DIR / "cv_scores.csv", index=False)
    return float(scores.mean()), float(scores.std())


# ============================================================
# SAVE MODEL + SUMMARY
# ============================================================
def save_model(model):
    path = RESULTS_DIR / "model.pkl"
    joblib.dump(model, path)
    print(f"\nModel saved to: {path}")
    print(f"Model size: {path.stat().st_size / 1024:.1f} KB")


def write_summary(test_acc, test_macro_f1, val_acc, val_macro_f1,
                  high_risk_recall, cv_mean, cv_std, n_train, n_val, n_test):
    protocol_label = (
        "Cross-View (CV) — train C002+C003, test C001 (NTU only)"
        if _PROTOCOL == "cv" else "Cross-Subject (CS)"
    )
    training_scope = (
        "NTU only (UR excluded; not applicable to CV)"
        if _PROTOCOL == "cv" else "combined NTU + UR"
    )
    summary = (
        f"RandomForest baseline — summary\n"
        f"================================\n"
        f"Protocol            : {protocol_label}\n"
        f"Training            : {training_scope}\n"
        f"Random seed         : {RANDOM_STATE}\n"
        f"Train samples       : {n_train}\n"
        f"Val   samples       : {n_val}\n"
        f"Test  samples       : {n_test}\n"
        f"\n"
        f"Val   accuracy      : {val_acc:.4f}\n"
        f"Val   macro F1      : {val_macro_f1:.4f}\n"
        f"\n"
        f"Test  accuracy      : {test_acc:.4f}\n"
        f"Test  macro F1      : {test_macro_f1:.4f}\n"
        f"Test  high-risk recall : {high_risk_recall:.4f}\n"
        f"\n"
        f"Train CV accuracy   : {cv_mean:.4f} ± {cv_std:.4f}  ({CV_FOLDS}-fold)\n"
    )
    print("\n" + summary)
    (RESULTS_DIR / "summary.txt").write_text(summary, encoding="utf-8")


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 60)
    print(f"  RandomForest baseline ({_PROTOCOL.upper()} protocol)")
    print("=" * 60)

    X, y, df, feature_cols = load_data()

    splits = load_splits()
    idx_dict = split_indices_for_df(df, splits)
    report_split_composition(df, idx_dict)

    model = train_model(X, y, idx_dict["train"])

    _, _, val_acc, val_macro_f1 = evaluate_split(
        model, X, y, df, idx_dict["val"], split_name="val"
    )
    df_test = df.iloc[idx_dict["test"]].reset_index(drop=True)
    y_test, y_pred_test, test_acc, test_macro_f1 = evaluate_split(
        model, X, y, df, idx_dict["test"], split_name="test"
    )

    save_feature_importance(model, feature_cols)
    save_per_dataset_metrics(y_test, y_pred_test, df_test)
    high_risk_recall = save_high_risk_recall(y_test, y_pred_test)
    cv_mean, cv_std = cross_validate_on_train(X, y, idx_dict["train"], df)

    save_model(model)

    write_summary(
        test_acc=test_acc,
        test_macro_f1=test_macro_f1,
        val_acc=val_acc,
        val_macro_f1=val_macro_f1,
        high_risk_recall=high_risk_recall,
        cv_mean=cv_mean,
        cv_std=cv_std,
        n_train=len(idx_dict["train"]),
        n_val=len(idx_dict["val"]),
        n_test=len(idx_dict["test"]),
    )

    print(f"\nAll results saved in: {RESULTS_DIR}")
    print("Done.")


if __name__ == "__main__":
    main()
