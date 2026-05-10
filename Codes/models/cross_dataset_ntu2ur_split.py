"""
Cross-Dataset (NTU -> UR) split generator.

Produces train / val / test split CSVs in `splits_cd_ntu2ur/` such
that ST-GCN's existing train.py / evaluate.py — when run with
MODELS_PROTOCOL=cd_ntu2ur — train on NTU only and test on UR only.

Layout:
    train : NTU subjects minus a small val-subject hold-out (~85% of NTU)
    val   : ~15% of NTU, by SUBJECT (no subject leakage train->val)
    test  : ALL UR sequences

This is the same logic the cross_dataset_eval.py already uses for
the RF/Posture/Fusion CD evaluation, but written as a *split file
set* so the ST-GCN training pipeline (which reads splits via
split_utils) can also use it without code changes.
"""

import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import OUTPUTS


FEATURES_PATH = OUTPUTS / "Feature_Dataset" / "features_dataset.csv"
SPLITS_DIR = Path(__file__).resolve().parent / "splits_cd_ntu2ur"
SPLITS_DIR.mkdir(parents=True, exist_ok=True)

VAL_FRAC_OF_NTU_SUBJECTS = 0.15
RANDOM_STATE = 42

NTU_SUBJECT_RE = re.compile(r"P(\d{3})")


def main():
    print("=" * 60)
    print("  Cross-Dataset NTU -> UR split generator")
    print("=" * 60)
    df = pd.read_csv(FEATURES_PATH)
    print(f"\nTotal rows: {len(df)}")
    print(df["dataset"].value_counts().to_string())

    ntu = df[df["dataset"] == "NTU"].copy()
    ur = df[df["dataset"] == "UR"].copy()

    ntu["subject"] = ntu["sequence_id"].apply(
        lambda s: f"P{NTU_SUBJECT_RE.search(s).group(1)}"
    )
    rng = np.random.default_rng(RANDOM_STATE)
    ntu_subjects = np.array(sorted(ntu["subject"].unique()))
    rng.shuffle(ntu_subjects)
    n_val_subj = max(1, int(round(len(ntu_subjects) * VAL_FRAC_OF_NTU_SUBJECTS)))
    val_subjects = set(ntu_subjects[:n_val_subj].tolist())
    train_subjects = set(ntu_subjects[n_val_subj:].tolist())
    print(f"\nNTU subjects total: {len(ntu_subjects)}  "
          f"-> train: {len(train_subjects)}  val: {len(val_subjects)}")

    train = ntu[ntu["subject"].isin(train_subjects)].reset_index(drop=True)
    val = ntu[ntu["subject"].isin(val_subjects)].reset_index(drop=True)
    test = ur.reset_index(drop=True)

    summary_lines = [
        "Cross-Dataset NTU -> UR split summary",
        "=====================================",
        f"Random seed     : {RANDOM_STATE}",
        f"Train scope     : NTU only (subjects disjoint from val)",
        f"Val   scope     : NTU only (subjects disjoint from train)",
        f"Test  scope     : UR only — domain shift",
        "",
    ]
    for name, sub in (("train", train), ("val", val), ("test", test)):
        out = sub[["sequence_id", "dataset", "risk_level"]].reset_index(drop=True)
        path = SPLITS_DIR / f"{name}_split.csv"
        out.to_csv(path, index=False)
        risk = sub["risk_level"].value_counts().to_dict()
        line = f"{name.upper():<5} n={len(sub):>4}  risk={risk}"
        print(line)
        print(f"  -> wrote {path}")
        summary_lines.append(line)

    summary_path = SPLITS_DIR / "cd_ntu2ur_split_summary.txt"
    summary_path.write_text("\n".join(summary_lines) + "\n", encoding="utf-8")
    print(f"\nSummary written: {summary_path}")
    print("\nDone.")


if __name__ == "__main__":
    main()
