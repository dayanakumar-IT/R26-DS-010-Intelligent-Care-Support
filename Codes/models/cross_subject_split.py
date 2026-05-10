"""
Cross-Subject (CS) split generator for the unified UR + NTU corpus.

================================================================
WHY THIS PROTOCOL
================================================================
NTU contains 106 unique performers (P001..P106) and the same person
appears in many sequences across many actions. A per-sequence random
split therefore puts the SAME person in train, val, and test — the
model learns to identify the *person* as well as the motion. NTU's
official benchmark uses Cross-Subject (CS) for exactly this reason:
each subject's sequences appear entirely in ONE of train/val/test.

UR has no exposed actor IDs but each (action_type, recording_number)
is a single recording session — so we treat `adl-NN` and `fall-NN`
as the "subject group" so paired cameras of the same recording
(cam0 + cam1) stay together.

================================================================
PROTOCOL DETAILS
================================================================
- 70 / 15 / 15 split of SUBJECTS (not sequences), stratified by
  dataset so both UR and NTU appear in every split.
- Class distribution within each split is reported but not enforced
  — at the subject level, perfect class stratification is impossible
  because one subject contributes sequences across multiple risk
  levels.
- Random seed 42 throughout — reproducible.

================================================================
OUTPUTS
================================================================
    Codes/models/splits/train_split.csv
    Codes/models/splits/val_split.csv
    Codes/models/splits/test_split.csv
    Codes/models/splits/cs_split_summary.txt

CSV format (matches what every downstream model script expects):
    sequence_id,dataset,risk_level
"""

import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import OUTPUTS


# ============================================================
# CONFIG
# ============================================================
FEATURES_PATH = OUTPUTS / "Feature_Dataset" / "features_dataset.csv"

SPLITS_DIR = Path(__file__).resolve().parent / "splits"
SPLITS_DIR.mkdir(parents=True, exist_ok=True)

TRAIN_FRAC = 0.70
VAL_FRAC = 0.15
TEST_FRAC = 0.15

RANDOM_STATE = 42


# ============================================================
# SUBJECT-ID EXTRACTION
# ============================================================
NTU_SUBJECT_RE = re.compile(r"P(\d{3})")
UR_SUBJECT_RE = re.compile(r"^(adl|fall)-(\d+)")


def extract_subject_id(sequence_id: str, dataset: str) -> str:
    if dataset == "NTU":
        m = NTU_SUBJECT_RE.search(sequence_id)
        if not m:
            raise ValueError(f"NTU sequence_id missing P###: {sequence_id}")
        return f"NTU_P{m.group(1)}"

    if dataset == "UR":
        m = UR_SUBJECT_RE.match(sequence_id)
        if not m:
            raise ValueError(f"UR sequence_id unrecognised: {sequence_id}")
        return f"UR_{m.group(1)}-{int(m.group(2)):02d}"

    raise ValueError(f"Unknown dataset: {dataset}")


# ============================================================
# SUBJECT-LEVEL SPLITTER (stratified by dataset)
# ============================================================
def split_subjects(subjects: np.ndarray, rng: np.random.Generator):
    n = len(subjects)
    if n == 0:
        return np.array([]), np.array([]), np.array([])

    shuffled = subjects.copy()
    rng.shuffle(shuffled)

    n_test = max(1, int(round(n * TEST_FRAC)))
    n_val = max(1, int(round(n * VAL_FRAC)))
    n_train = n - n_val - n_test
    if n_train < 1:
        n_train = max(1, n - n_test)
        n_val = n - n_train - n_test

    train = shuffled[:n_train]
    val = shuffled[n_train : n_train + n_val]
    test = shuffled[n_train + n_val :]
    return train, val, test


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 60)
    print("  Cross-Subject split generator")
    print("=" * 60)
    print(f"Features file : {FEATURES_PATH}")
    print(f"Output dir    : {SPLITS_DIR}")
    print(f"Random state  : {RANDOM_STATE}")
    print(f"Fractions     : train={TRAIN_FRAC} val={VAL_FRAC} test={TEST_FRAC}")

    df = pd.read_csv(FEATURES_PATH)
    print(f"\nLoaded {len(df)} sequences total.")
    print("Per-dataset row counts:")
    print(df["dataset"].value_counts().to_string())

    df["subject_id"] = df.apply(
        lambda r: extract_subject_id(r["sequence_id"], r["dataset"]), axis=1
    )

    rng = np.random.default_rng(RANDOM_STATE)

    train_subjects, val_subjects, test_subjects = [], [], []

    print("\n" + "-" * 60)
    print("  Per-dataset subject inventory and split")
    print("-" * 60)
    for dataset_name in sorted(df["dataset"].unique()):
        subjects = np.array(
            sorted(df.loc[df["dataset"] == dataset_name, "subject_id"].unique())
        )
        n = len(subjects)
        tr, va, te = split_subjects(subjects, rng)
        print(
            f"{dataset_name:>4} : {n:>3} subjects  -> "
            f"train={len(tr):>3}  val={len(va):>3}  test={len(te):>3}"
        )
        train_subjects.extend(tr.tolist())
        val_subjects.extend(va.tolist())
        test_subjects.extend(te.tolist())

    train_subjects = set(train_subjects)
    val_subjects = set(val_subjects)
    test_subjects = set(test_subjects)

    assert train_subjects.isdisjoint(val_subjects), \
        "Subject leak between train and val!"
    assert train_subjects.isdisjoint(test_subjects), \
        "Subject leak between train and test!"
    assert val_subjects.isdisjoint(test_subjects), \
        "Subject leak between val and test!"

    def assign_split(sid):
        if sid in train_subjects:
            return "train"
        if sid in val_subjects:
            return "val"
        if sid in test_subjects:
            return "test"
        raise RuntimeError(f"Subject {sid} not assigned to any split")

    df["split"] = df["subject_id"].map(assign_split)

    print("\n" + "-" * 60)
    print("  Writing split CSVs")
    print("-" * 60)
    summary_lines = [
        "Cross-Subject (CS) split summary",
        "================================",
        f"Random seed     : {RANDOM_STATE}",
        f"Total sequences : {len(df)}",
        "",
    ]
    for split_name in ("train", "val", "test"):
        sub = df[df["split"] == split_name]
        out = sub[["sequence_id", "dataset", "risk_level"]].reset_index(drop=True)
        path = SPLITS_DIR / f"{split_name}_split.csv"
        out.to_csv(path, index=False)
        n = len(sub)
        risk_dist = sub["risk_level"].value_counts().to_dict()
        ds_dist = sub["dataset"].value_counts().to_dict()
        n_subj = sub["subject_id"].nunique()
        line = (
            f"{split_name.upper():<5} n={n:>4}  ({n / len(df) * 100:5.1f}%)  "
            f"subjects={n_subj:>3}  "
            f"risk={risk_dist}  dataset={ds_dist}"
        )
        print(line)
        print(f"  -> wrote {path}")
        summary_lines.append(line)

    summary_path = SPLITS_DIR / "cs_split_summary.txt"
    summary_path.write_text("\n".join(summary_lines) + "\n", encoding="utf-8")
    print(f"\nSummary written to: {summary_path}")
    print("\nDone.")


if __name__ == "__main__":
    main()
