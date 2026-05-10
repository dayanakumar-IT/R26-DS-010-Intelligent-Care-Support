"""
Shared loader for the train / val / test splits.

Every model script imports from this module so there is exactly ONE
source of truth for which sequence_id belongs to which split.

Two protocols are supported via the MODELS_PROTOCOL environment
variable:

    MODELS_PROTOCOL=cs    (default) -> reads splits/  (Cross-Subject)
    MODELS_PROTOCOL=cv              -> reads splits_cv/ (Cross-View)

The CD (Cross-Dataset) protocol does NOT use this loader — it works
directly on raw dataset slices, see cross_dataset_eval*.py.

Usage
-----
    from split_utils import load_splits, split_indices_for_df

    splits = load_splits()                       # dict of DataFrames
    idx = split_indices_for_df(df, splits)       # dict of np.ndarrays

Folder layout
-------------
    Codes/models/splits/        produced by cross_subject_split.py
    Codes/models/splits_cv/     produced by cross_view_split.py
"""

import os
from pathlib import Path
import numpy as np
import pandas as pd

PROTOCOL = os.environ.get("MODELS_PROTOCOL", "cs").lower()
if PROTOCOL == "cv":
    SPLITS_DIR = Path(__file__).resolve().parent / "splits_cv"
elif PROTOCOL == "cs":
    SPLITS_DIR = Path(__file__).resolve().parent / "splits"
elif PROTOCOL == "cd_ntu2ur":
    SPLITS_DIR = Path(__file__).resolve().parent / "splits_cd_ntu2ur"
else:
    raise ValueError(
        f"MODELS_PROTOCOL='{PROTOCOL}' is unsupported. "
        "Use 'cs', 'cv', or 'cd_ntu2ur'."
    )

SPLIT_NAMES = ("train", "val", "test")


def load_splits() -> dict:
    """Return {'train': df, 'val': df, 'test': df}, each with columns
    sequence_id, dataset, risk_level. Raises if any CSV is missing."""
    splits = {}
    for name in SPLIT_NAMES:
        path = SPLITS_DIR / f"{name}_split.csv"
        if not path.exists():
            raise FileNotFoundError(
                f"Split file not found: {path}\n"
                "Run `python Codes/models/cross_subject_split.py` first."
            )
        splits[name] = pd.read_csv(path)
    return splits


def split_indices_for_df(df: pd.DataFrame, splits: dict) -> dict:
    """Map each split's sequence_id list to row indices in `df`.

    Returns {'train': np.ndarray[int64], 'val': ..., 'test': ...}.
    Raises a clear error if any split sequence_id is missing from `df`.
    """
    if "sequence_id" not in df.columns:
        raise ValueError("`df` must contain a 'sequence_id' column.")

    id_to_index = {sid: i for i, sid in enumerate(df["sequence_id"].values)}
    out = {}
    for name, split_df in splits.items():
        ids = split_df["sequence_id"].tolist()
        missing = [s for s in ids if s not in id_to_index]
        if missing:
            raise RuntimeError(
                f"{len(missing)} sequence_ids in {name}_split.csv are not "
                f"present in the supplied DataFrame "
                f"(first few: {missing[:3]}). Splits and data are out of sync."
            )
        out[name] = np.array([id_to_index[s] for s in ids], dtype=np.int64)
    return out
