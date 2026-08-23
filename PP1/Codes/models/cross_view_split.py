"""
Cross-View (CV) split generator for NTU.

================================================================
WHY THIS PROTOCOL
================================================================
Cross-Subject (CS) tests new bodies in the same recording setup.
Cross-View tests the same bodies from a *different camera angle*.
NTU's official CV protocol (Shahroudy et al. 2016, the NTU-RGB+D
benchmark paper) trains on cameras 2 and 3 and tests on camera 1.

For our project this answers a deployment question CS cannot:
    "When I move the camera to a different room with a different
     mounting height/angle, will the model still work?"

================================================================
SCOPE
================================================================
NTU only. UR has only 2 cameras (cam0 / cam1) and the cam0 set
includes adl + fall while cam1 is fall-only — a clean CV split
on UR is not possible. We therefore exclude UR from this protocol.
The proposal already documents UR's role as a *cross-dataset*
checkpoint, not a cross-view one.

================================================================
SUBJECT IDENTIFICATION (from sequence_id)
================================================================
NTU sequence_id pattern:  S###C###P###R###A###
  S### = setup    (we don't use this here)
  C### = camera   <- we partition on this
  P### = subject  (subject overlap is ALLOWED in CV — that's the
                   point)
  R### = repetition
  A### = action

================================================================
SPLIT
================================================================
Train : C002 + C003     (about 2/3 of NTU)
Val   : 15% carved out of the train set, by SUBJECT — i.e. some
        subjects appear only in val, never in train. This makes
        early-stopping decisions honest.
Test  : C001            (about 1/3 of NTU) — held out completely

UR rows are dropped entirely (see SCOPE above).

Random seed 42 throughout — reproducible.

================================================================
OUTPUTS
================================================================
    Codes/models/splits_cv/train_split.csv
    Codes/models/splits_cv/val_split.csv
    Codes/models/splits_cv/test_split.csv
    Codes/models/splits_cv/cv_split_summary.txt

CSV format identical to the CS split files:
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

SPLITS_DIR = Path(__file__).resolve().parent / "splits_cv"
SPLITS_DIR.mkdir(parents=True, exist_ok=True)

VAL_FRAC_OF_TRAIN = 0.15
RANDOM_STATE = 42

NTU_CAMERA_RE = re.compile(r"C(\d{3})")
NTU_SUBJECT_RE = re.compile(r"P(\d{3})")


# ============================================================
# HELPERS
# ============================================================
def extract_camera(sid: str) -> str:
    m = NTU_CAMERA_RE.search(sid)
    if not m:
        raise ValueError(f"NTU sequence_id missing C###: {sid}")
    return f"C{m.group(1)}"


def extract_subject(sid: str) -> str:
    m = NTU_SUBJECT_RE.search(sid)
    if not m:
        raise ValueError(f"NTU sequence_id missing P###: {sid}")
    return f"P{m.group(1)}"


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 60)
    print("  Cross-View split generator (NTU only)")
    print("=" * 60)
    print(f"Features file : {FEATURES_PATH}")
    print(f"Output dir    : {SPLITS_DIR}")
    print(f"Random state  : {RANDOM_STATE}")
    print(f"Val frac of train : {VAL_FRAC_OF_TRAIN}")

    df = pd.read_csv(FEATURES_PATH)
    print(f"\nLoaded {len(df)} sequences total.")
    print("Per-dataset row counts:")
    print(df["dataset"].value_counts().to_string())

    # NTU only
    ntu = df[df["dataset"] == "NTU"].reset_index(drop=True).copy()
    n_ur = (df["dataset"] == "UR").sum()
    print(f"\nDropping {n_ur} UR rows (CV not applicable to UR — see file docstring).")

    ntu["camera"] = ntu["sequence_id"].apply(extract_camera)
    ntu["subject"] = ntu["sequence_id"].apply(extract_subject)
    print("\nCamera distribution (NTU):")
    print(ntu["camera"].value_counts().to_string())

    # ---- Train / test by camera ----
    test = ntu[ntu["camera"] == "C001"].reset_index(drop=True)
    train_pool = ntu[ntu["camera"].isin(["C002", "C003"])].reset_index(drop=True)
    print(f"\nTest pool (C001 only): n={len(test)}")
    print(f"Train pool (C002 + C003): n={len(train_pool)}")

    # ---- Carve val out of train pool, BY SUBJECT (no subject leakage
    # from train to val so early-stopping is honest) ----
    rng = np.random.default_rng(RANDOM_STATE)
    train_subjects = np.array(sorted(train_pool["subject"].unique()))
    rng.shuffle(train_subjects)
    n_val_subjects = max(1, int(round(len(train_subjects) * VAL_FRAC_OF_TRAIN)))
    val_subjects = set(train_subjects[:n_val_subjects].tolist())
    train_subjects_kept = set(train_subjects[n_val_subjects:].tolist())
    print(f"\nSubject inventory in train pool: {len(train_subjects)}")
    print(f"  -> train subjects: {len(train_subjects_kept)}")
    print(f"  -> val   subjects: {len(val_subjects)}")

    train = train_pool[train_pool["subject"].isin(train_subjects_kept)].reset_index(drop=True)
    val = train_pool[train_pool["subject"].isin(val_subjects)].reset_index(drop=True)

    # Sanity: train and val must be disjoint at subject level
    assert set(train["subject"]).isdisjoint(set(val["subject"])), \
        "Subject leak between train and val!"
    # CV protocol explicitly allows subject overlap between (train+val) and test.
    # Cameras must be disjoint though:
    assert "C001" not in set(train["camera"]).union(val["camera"]), \
        "Camera C001 leaked into train/val!"
    assert set(test["camera"]) == {"C001"}, "Test set has cameras other than C001!"

    # ---- Persist ----
    print("\n" + "-" * 60)
    print("  Writing split CSVs")
    print("-" * 60)
    summary_lines = [
        "Cross-View (CV) split summary",
        "==============================",
        f"Random seed              : {RANDOM_STATE}",
        f"Train cameras            : C002, C003",
        f"Test  camera             : C001",
        f"Val carved from train by : subject (no subject leakage train->val)",
        f"UR sequences             : EXCLUDED (CV not applicable)",
        f"Total NTU sequences      : {len(ntu)}",
        "",
    ]
    for split_name, sub in (("train", train), ("val", val), ("test", test)):
        out = sub[["sequence_id", "dataset", "risk_level"]].reset_index(drop=True)
        path = SPLITS_DIR / f"{split_name}_split.csv"
        out.to_csv(path, index=False)
        n = len(sub)
        risk_dist = sub["risk_level"].value_counts().to_dict()
        cam_dist = sub["camera"].value_counts().to_dict()
        line = (
            f"{split_name.upper():<5} n={n:>4}  ({n / len(ntu) * 100:5.1f}% of NTU)  "
            f"cameras={cam_dist}  risk={risk_dist}"
        )
        print(line)
        print(f"  -> wrote {path}")
        summary_lines.append(line)

    summary_path = SPLITS_DIR / "cv_split_summary.txt"
    summary_path.write_text("\n".join(summary_lines) + "\n", encoding="utf-8")
    print(f"\nSummary written to: {summary_path}")
    print("\nDone.")


if __name__ == "__main__":
    main()
