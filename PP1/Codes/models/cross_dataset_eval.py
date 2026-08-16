"""
Cross-Dataset stress test — RandomForest only.

================================================================
WHY THIS EVALUATION
================================================================
Cross-Subject (the protocol all our models use) holds OUT subjects.
Cross-Dataset goes further: it holds out an entire dataset.

Two settings:

    NTU -> UR : train on NTU only,  test on UR only
    UR  -> NTU: train on UR  only,  test on NTU only

This simulates real-world domain shift: the model sees one
camera/lab/actor pool at training time and must work on a
completely different one at deployment. It is the closest
experimental approximation to the question

    "Will this work outside the lab where we trained it?"

Only the RandomForest is evaluated this way (cheap to retrain).
Cross-dataset for the ST-GCN would mean another ~9-hour training
run for each direction — deferred to dissertation work.

================================================================
EXPERIMENT DESIGN
================================================================
- Uses the SAME 18 hand-crafted motion features as baseline_rf.py.
- Same RF hyperparameters as baseline_rf.py
  (n_estimators=300, class_weight='balanced').
- For NTU -> UR: train on ALL 4,752 NTU rows; test on all 45 UR rows.
- For UR  -> NTU: train on all 45 UR rows;  test on all 4,752 NTU rows.
                  This direction is expected to fail — 45 rows is
                  an absurdly small training set — and that's the
                  point: it shows you can't bootstrap a fall-risk
                  model from UR alone, motivating the combined
                  training strategy used in the main pipeline.

================================================================
OUTPUTS — Codes/models/cross_dataset_results/
================================================================
    ntu_to_ur_classification_report.{txt,json}
    ntu_to_ur_confusion_matrix.{csv,png}
    ur_to_ntu_classification_report.{txt,json}
    ur_to_ntu_confusion_matrix.{csv,png}
    summary.csv                    headline numbers in one table
    summary.txt                    human-readable summary
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

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import OUTPUTS


# ============================================================
# CONFIG
# ============================================================
FEATURES_PATH = OUTPUTS / "Feature_Dataset" / "features_dataset.csv"
RESULTS_DIR = Path(__file__).resolve().parent / "cross_dataset_results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

TARGET_CLASSES = ["low_risk", "moderate_risk", "high_risk"]
NON_FEATURE_COLUMNS = [
    "sequence_id",
    "dataset",
    "label",
    "risk_level",
    "pose_array_path",
]

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


# ============================================================
# HELPERS
# ============================================================
def evaluate_direction(
    direction_name: str,
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
    feature_cols,
):
    print("\n" + "=" * 60)
    print(f"  Direction: {direction_name}")
    print("=" * 60)

    print(f"  Train rows: {len(train_df)} ({train_df['dataset'].iloc[0]})")
    print(f"  Test  rows: {len(test_df)} ({test_df['dataset'].iloc[0]})")
    print(f"  Train class distribution: "
          f"{train_df['risk_level'].value_counts().to_dict()}")
    print(f"  Test  class distribution: "
          f"{test_df['risk_level'].value_counts().to_dict()}")

    X_train = train_df[feature_cols].values.astype(np.float32)
    y_train = train_df["risk_level"].values
    X_test = test_df[feature_cols].values.astype(np.float32)
    y_test = test_df["risk_level"].values

    model = RandomForestClassifier(**RF_PARAMS)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    txt = classification_report(
        y_test, y_pred, labels=TARGET_CLASSES, digits=4, zero_division=0
    )
    print(txt)

    acc = accuracy_score(y_test, y_pred)
    macro_f1 = f1_score(
        y_test, y_pred, average="macro", labels=TARGET_CLASSES, zero_division=0
    )
    if (y_test == "high_risk").sum() > 0:
        hr = recall_score(
            y_test, y_pred, labels=["high_risk"], average="macro", zero_division=0
        )
    else:
        hr = float("nan")
    print(f"Accuracy        : {acc:.4f}")
    print(f"Macro F1        : {macro_f1:.4f}")
    print(f"High-risk recall: {hr if np.isnan(hr) else round(hr, 4)}")

    # Save report
    tag = direction_name.replace(" -> ", "_to_").replace(" ", "_").lower()
    (RESULTS_DIR / f"{tag}_classification_report.txt").write_text(txt, encoding="utf-8")
    rep = classification_report(
        y_test, y_pred, labels=TARGET_CLASSES, output_dict=True, zero_division=0
    )
    with open(RESULTS_DIR / f"{tag}_classification_report.json", "w", encoding="utf-8") as f:
        json.dump(rep, f, indent=2)

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred, labels=TARGET_CLASSES)
    cm_df = pd.DataFrame(
        cm,
        index=[f"true_{c}" for c in TARGET_CLASSES],
        columns=[f"pred_{c}" for c in TARGET_CLASSES],
    )
    cm_df.to_csv(RESULTS_DIR / f"{tag}_confusion_matrix.csv")

    fig, ax = plt.subplots(figsize=(7, 6))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(TARGET_CLASSES)))
    ax.set_yticks(range(len(TARGET_CLASSES)))
    ax.set_xticklabels(TARGET_CLASSES, rotation=20, ha="right")
    ax.set_yticklabels(TARGET_CLASSES)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(f"Cross-Dataset RF — {direction_name}")
    threshold = cm.max() / 2.0 if cm.max() > 0 else 0.5
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
    plt.savefig(RESULTS_DIR / f"{tag}_confusion_matrix.png", dpi=150)
    plt.close()

    return {
        "direction": direction_name,
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
    print("  Cross-Dataset stress test (RandomForest)")
    print("=" * 60)
    print(f"Features : {FEATURES_PATH}")
    print(f"Output   : {RESULTS_DIR}")

    df = pd.read_csv(FEATURES_PATH)
    feature_cols = [c for c in df.columns if c not in NON_FEATURE_COLUMNS]
    df = df.dropna(subset=feature_cols).reset_index(drop=True)
    print(f"\nLoaded {len(df)} rows. Per-dataset breakdown:")
    print(df["dataset"].value_counts().to_string())
    print(f"Feature columns ({len(feature_cols)}): {feature_cols}")

    ntu = df[df["dataset"] == "NTU"].reset_index(drop=True)
    ur = df[df["dataset"] == "UR"].reset_index(drop=True)

    rows = []

    rows.append(
        evaluate_direction("NTU -> UR", train_df=ntu, test_df=ur,
                           feature_cols=feature_cols)
    )
    rows.append(
        evaluate_direction("UR -> NTU", train_df=ur, test_df=ntu,
                           feature_cols=feature_cols)
    )

    summary_df = pd.DataFrame(rows)
    summary_df.to_csv(RESULTS_DIR / "summary.csv", index=False)

    print("\n" + "=" * 60)
    print("  Cross-Dataset summary")
    print("=" * 60)
    print(summary_df.to_string(index=False))

    txt_lines = [
        "Cross-Dataset stress test — RandomForest",
        "========================================",
        "",
        "Two directions:",
        "  NTU -> UR : train on 4,752 NTU sequences, test on 45 UR sequences.",
        "  UR  -> NTU: train on 45 UR sequences,    test on 4,752 NTU sequences.",
        "",
        "Same RF hyperparameters and 18 motion features as baseline_rf.py.",
        "",
        "Results:",
    ]
    for r in rows:
        txt_lines.append(
            f"  {r['direction']:<10}  "
            f"acc={r['accuracy']:.4f}  macro_f1={r['macro_f1']:.4f}  "
            f"high_risk_recall={r['high_risk_recall']}  "
            f"(train n={r['n_train']}, test n={r['n_test']})"
        )
    (RESULTS_DIR / "summary.txt").write_text("\n".join(txt_lines) + "\n", encoding="utf-8")

    print(f"\nAll cross-dataset artifacts saved in: {RESULTS_DIR}")
    print("Done.")


if __name__ == "__main__":
    main()
