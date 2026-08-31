# backend/src/baseline_rf.py
"""Random Forest baseline on the 18 handcrafted features."""
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, f1_score

from config.settings import CLASS_NAMES, SEED
from src.data_splits import load_combined_dataset, build_or_load_splits


def train_classical_baseline():
    print("=" * 65)
    print("       RANDOM FOREST BASELINE (18 features)")
    print("=" * 65)

    _, features, labels = load_combined_dataset()
    train_idx, val_idx, _ = build_or_load_splits(labels)

    X_train, y_train = features[train_idx], labels[train_idx]
    X_val,   y_val   = features[val_idx],   labels[val_idx]

    rf = RandomForestClassifier(
        n_estimators=300,
        max_depth=None,
        class_weight="balanced",
        random_state=SEED,
        n_jobs=-1,
    )
    print(f"training on {X_train.shape[0]} samples ...")
    rf.fit(X_train, y_train)

    y_pred = rf.predict(X_val)
    acc = accuracy_score(y_val, y_pred) * 100
    f1 = f1_score(y_val, y_pred, average="macro")
    print(f"val accuracy  : {acc:.2f}%")
    print(f"val macro-F1  : {f1:.4f}")
    print(classification_report(y_val, y_pred, target_names=CLASS_NAMES, zero_division=0))


if __name__ == "__main__":
    train_classical_baseline()
