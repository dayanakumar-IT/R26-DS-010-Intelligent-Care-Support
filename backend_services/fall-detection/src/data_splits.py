# backend/src/data_splits.py
"""Shared dataset loading + 70/15/15 stratified split (persisted to disk)."""
import os
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from config.settings import (
    PROCESSED_DATA_DIR,
    MODELS_DIR,
    SEED,
    TRAIN_VAL_TEST_SPLIT,
)


# ---------------------------------------------------------------------------
# Disk loaders
# ---------------------------------------------------------------------------
def _load_pair(stem):
    """Return (skeletons, features, labels) for one dataset or empty stubs
    if the files are missing."""
    base = PROCESSED_DATA_DIR
    sk_path = os.path.join(base, f"{stem}_data.npy")
    ft_path = os.path.join(base, f"{stem}_features.npy")
    lb_path = os.path.join(base, f"{stem}_labels.npy")
    if not (os.path.exists(sk_path) and os.path.exists(ft_path) and os.path.exists(lb_path)):
        return None
    return np.load(sk_path), np.load(ft_path), np.load(lb_path)


def load_combined_dataset(return_origin: bool = False):
    """Concatenate available datasets into (skeletons, features, labels).

    Datasets that have not been produced yet (e.g. UR before its
    MediaPipe dump is created) are silently skipped.

    When `return_origin=True`, also returns an int array where
    0=NTU, 1=UR — used by the cross-dataset evaluator.
    """
    stems = ("ntu", "ur")
    parts = [(_load_pair(s), s) for s in stems]
    parts = [(p, s) for p, s in parts if p is not None]
    if not parts:
        raise RuntimeError(
            "No processed datasets found. Run `python main.py` first to "
            "produce data/processed/*.npy."
        )
    sk = np.concatenate([p[0] for p, _ in parts], axis=0).astype(np.float32)
    ft = np.concatenate([p[1] for p, _ in parts], axis=0).astype(np.float32)
    lb = np.concatenate([p[2] for p, _ in parts], axis=0).astype(np.int64)
    if not return_origin:
        return sk, ft, lb
    origin = np.concatenate(
        [np.full(p[0].shape[0], 0 if s == "ntu" else 1, dtype=np.int32) for p, s in parts]
    )
    return sk, ft, lb, origin


def load_ntu_subjects_padded(n_total: int) -> np.ndarray:
    """Return an aligned subjects array with -1 for non-NTU rows.

    The combined dataset concatenation is (NTU then UR). Every NTU row
    gets its recorded subject ID; UR rows get -1.
    """
    path = os.path.join(PROCESSED_DATA_DIR, "ntu_subjects.npy")
    if not os.path.exists(path):
        return np.full(n_total, -1, dtype=np.int32)
    ntu_subj = np.load(path)
    pad = np.full(n_total - len(ntu_subj), -1, dtype=np.int32)
    return np.concatenate([ntu_subj, pad]).astype(np.int32)


# ---------------------------------------------------------------------------
# Splits
# ---------------------------------------------------------------------------
SPLIT_PATH = os.path.join(PROCESSED_DATA_DIR, "split_idx.npz")
SUBJECT_SPLIT_PATH = os.path.join(PROCESSED_DATA_DIR, "split_idx_subject.npz")


def build_or_load_splits(labels):
    """Return (train_idx, val_idx, test_idx) — persisted across runs."""
    if os.path.exists(SPLIT_PATH):
        rec = np.load(SPLIT_PATH)
        train_idx = rec["train_idx"]
        val_idx = rec["val_idx"]
        test_idx = rec["test_idx"]
        if len(train_idx) + len(val_idx) + len(test_idx) == len(labels):
            return train_idx, val_idx, test_idx
        print(f"[splits] persisted file size mismatch -> rebuilding")

    n = len(labels)
    train_frac, val_frac, test_frac = TRAIN_VAL_TEST_SPLIT
    assert abs(train_frac + val_frac + test_frac - 1.0) < 1e-9

    idx = np.arange(n)
    train_idx, temp_idx = train_test_split(
        idx, train_size=train_frac, stratify=labels, random_state=SEED
    )
    rel_val = val_frac / (val_frac + test_frac)
    val_idx, test_idx = train_test_split(
        temp_idx,
        train_size=rel_val,
        stratify=labels[temp_idx],
        random_state=SEED,
    )

    os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)
    np.savez(SPLIT_PATH, train_idx=train_idx, val_idx=val_idx, test_idx=test_idx)
    print(f"[splits] wrote {SPLIT_PATH} (train={len(train_idx)} val={len(val_idx)} test={len(test_idx)})")
    return train_idx, val_idx, test_idx


def build_or_load_subject_disjoint_splits(labels, subjects):
    """
    Subject-disjoint train/val/test at ~70/15/15 by *unique NTU subject*.
    Non-NTU rows (subject == -1) go into the training set — cross-dataset
    generalisation is measured separately by `cross_dataset.py`.

    Persisted to `split_idx_subject.npz` so reruns are stable.
    """
    if os.path.exists(SUBJECT_SPLIT_PATH):
        rec = np.load(SUBJECT_SPLIT_PATH)
        tr, va, te = rec["train_idx"], rec["val_idx"], rec["test_idx"]
        if len(tr) + len(va) + len(te) == len(labels):
            return tr, va, te
        print("[splits] subject-disjoint file size mismatch -> rebuilding")

    rng = np.random.default_rng(SEED)
    ntu_mask = subjects >= 0
    subj_ids = np.unique(subjects[ntu_mask])
    rng.shuffle(subj_ids)

    n = len(subj_ids)
    n_train = int(round(n * TRAIN_VAL_TEST_SPLIT[0]))
    n_val   = int(round(n * TRAIN_VAL_TEST_SPLIT[1]))
    train_subj = set(subj_ids[:n_train].tolist())
    val_subj   = set(subj_ids[n_train : n_train + n_val].tolist())
    test_subj  = set(subj_ids[n_train + n_val :].tolist())

    all_idx = np.arange(len(labels))
    train_idx, val_idx, test_idx = [], [], []
    for i in all_idx:
        s = int(subjects[i])
        if s < 0:
            train_idx.append(i)              # non-NTU rows -> train pool
        elif s in train_subj:
            train_idx.append(i)
        elif s in val_subj:
            val_idx.append(i)
        elif s in test_subj:
            test_idx.append(i)
        else:
            train_idx.append(i)

    train_idx = np.asarray(train_idx, dtype=np.int64)
    val_idx   = np.asarray(val_idx,   dtype=np.int64)
    test_idx  = np.asarray(test_idx,  dtype=np.int64)

    os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)
    np.savez(SUBJECT_SPLIT_PATH,
             train_idx=train_idx, val_idx=val_idx, test_idx=test_idx,
             train_subj=np.asarray(sorted(train_subj), dtype=np.int32),
             val_subj=np.asarray(sorted(val_subj), dtype=np.int32),
             test_subj=np.asarray(sorted(test_subj), dtype=np.int32))
    print(
        f"[splits] subject-disjoint  subj: train={len(train_subj)} val={len(val_subj)} test={len(test_subj)}  "
        f"rows: train={len(train_idx)} val={len(val_idx)} test={len(test_idx)}"
    )
    return train_idx, val_idx, test_idx


# ---------------------------------------------------------------------------
# Feature scaler
# ---------------------------------------------------------------------------
SCALER_PATH = os.path.join(MODELS_DIR, "feature_scaler.joblib")


def _scaler_path(suffix: str = "") -> str:
    return os.path.join(MODELS_DIR, f"feature_scaler{suffix}.joblib")


def fit_and_save_scaler(features_train, suffix: str = ""):
    os.makedirs(MODELS_DIR, exist_ok=True)
    scaler = StandardScaler().fit(features_train)
    path = _scaler_path(suffix)
    joblib.dump(scaler, path)
    print(f"[splits] wrote scaler -> {path}")
    return scaler


def load_scaler(suffix: str = ""):
    path = _scaler_path(suffix)
    if not os.path.exists(path):
        # Fall back to the default (unsuffixed) location so legacy
        # code paths still work.
        if suffix and os.path.exists(SCALER_PATH):
            path = SCALER_PATH
        else:
            raise FileNotFoundError(f"Feature scaler missing at {path}.")
    return joblib.load(path)


def compute_class_weights(labels):
    """Inverse-frequency class weights, normalised so mean weight == 1."""
    classes, counts = np.unique(labels, return_counts=True)
    inv = counts.sum() / (len(classes) * counts)   # mean ≈ 1.0
    return inv.astype(np.float32)
