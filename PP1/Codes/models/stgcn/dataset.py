"""
PyTorch Dataset for the 14-joint common skeleton sequences.

Reads `outputs/Common_Joint_Sequences/common_joint_metadata.csv` and
uses the protocol-specific split CSVs (CS / CV / CD-NTU2UR) so that
ST-GCN trains/validates/tests on EXACTLY the same sequences as the
RandomForest baseline. Apples-to-apples comparison guaranteed.

Each sample returns:
    pose : (C=3, T=100, V=14) float32 tensor — channels-first
           convention used throughout the ST-GCN paper
    label: int — 0=low_risk, 1=moderate_risk, 2=high_risk

================================================================
TRAINING-TIME AUGMENTATION (train split only)
================================================================
When `augment=True` (default for the 'train' split during training),
each loaded sample is independently transformed with three optional
augmentations, each fired with probability 0.5 and applied in this
order:

    1. Random rotation around the vertical (Y) axis, ±15 degrees.
       Forces the model to learn motion semantics independent of
       the camera's azimuthal angle.
    2. Horizontal (left/right) mirror — swaps left-side and
       right-side joint indices, negates X. Doubles the effective
       training distribution.
    3. Time-jitter — drops 5 random frames, then re-interpolates back
       to 100 frames. Forces robustness to small temporal misalignments.

Augmentation is DISABLED for val and test splits, and DISABLED for
the inference path used by fusion_mlp.py. Inference must always see
canonical inputs.
"""

import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset

# Allow importing paths.py and split_utils.py
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from paths import OUTPUTS
from split_utils import load_splits


# ============================================================
# CONSTANTS
# ============================================================
COMMON_METADATA = OUTPUTS / "Common_Joint_Sequences" / "common_joint_metadata.csv"

LABEL_TO_INDEX = {
    "low_risk": 0,
    "moderate_risk": 1,
    "high_risk": 2,
}
INDEX_TO_LABEL = {v: k for k, v in LABEL_TO_INDEX.items()}
NUM_CLASSES = len(LABEL_TO_INDEX)


# ============================================================
# AUGMENTATION HELPERS
# ============================================================
# Left/right joint pairs in the 14-joint common skeleton:
#   (1, 2)  shoulders
#   (3, 4)  elbows
#   (5, 6)  wrists
#   (7, 8)  hips
#   (9, 10) knees
#   (11,12) ankles
LEFT_RIGHT_JOINT_PAIRS = [(1, 2), (3, 4), (5, 6),
                          (7, 8), (9, 10), (11, 12)]
# Joints unaffected by mirror: head (0) and spine (13).

ROTATION_DEG_RANGE = 15.0     # +/-15 degrees around vertical (Y) axis
TIME_JITTER_DROP_FRAMES = 5   # number of frames to drop and re-interpolate
AUG_PROB = 0.5                # each augmentation fires independently


def _augment_rotate_y(pose: np.ndarray) -> np.ndarray:
    """Rotate every joint around the vertical (Y) axis by a uniformly
    sampled angle in [-15, +15] degrees.

    Input/output shape: (T, V, 3)  with axis convention (X, Y, Z).
    """
    theta = np.deg2rad(np.random.uniform(-ROTATION_DEG_RANGE, ROTATION_DEG_RANGE))
    cos_t, sin_t = np.cos(theta), np.sin(theta)
    R = np.array([
        [cos_t, 0.0, sin_t],
        [0.0,   1.0,   0.0],
        [-sin_t, 0.0, cos_t],
    ], dtype=pose.dtype)
    # (T, V, 3) @ (3, 3).T == apply R to each joint coordinate
    return pose @ R.T


def _augment_mirror(pose: np.ndarray) -> np.ndarray:
    """Mirror the skeleton across the body's vertical (Y-Z) plane:
    swap left/right joint indices and negate X coordinates."""
    out = pose.copy()
    out[:, :, 0] = -out[:, :, 0]
    for left, right in LEFT_RIGHT_JOINT_PAIRS:
        out[:, [left, right], :] = out[:, [right, left], :]
    return out


def _augment_time_jitter(pose: np.ndarray) -> np.ndarray:
    """Drop `TIME_JITTER_DROP_FRAMES` frames at random and linearly
    interpolate back to T=100 frames.

    Forces robustness to small temporal misalignments — the model
    can no longer rely on specific frames at specific time steps.
    """
    T = pose.shape[0]
    keep_count = T - TIME_JITTER_DROP_FRAMES
    if keep_count < 2:
        return pose
    keep_idx = np.sort(np.random.choice(T, size=keep_count, replace=False))
    kept = pose[keep_idx]                              # (keep_count, V, 3)
    # Linear interpolation back to T frames
    new_t = np.linspace(0, keep_count - 1, T)
    floor_idx = np.floor(new_t).astype(int)
    ceil_idx = np.minimum(floor_idx + 1, keep_count - 1)
    alpha = (new_t - floor_idx).reshape(-1, 1, 1)
    return ((1 - alpha) * kept[floor_idx]
            + alpha * kept[ceil_idx]).astype(pose.dtype)


def apply_augmentations(pose: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Apply each augmentation independently with probability AUG_PROB.

    Args:
        pose : (T, V, 3) float32
        rng  : numpy Generator (so we don't tangle with the global RNG)
    Returns:
        Augmented (T, V, 3) float32
    """
    if rng.random() < AUG_PROB:
        pose = _augment_rotate_y(pose)
    if rng.random() < AUG_PROB:
        pose = _augment_mirror(pose)
    if rng.random() < AUG_PROB:
        pose = _augment_time_jitter(pose)
    return pose


# ============================================================
# DATASET
# ============================================================
class CommonJointDataset(Dataset):
    """Lazy-loading dataset of (100, 14, 3) skeleton sequences.

    Args:
        split   : "train" | "val" | "test"
        augment : if True, apply random rotation / mirror / time-jitter on
                  __getitem__. Default is True for split=="train" only.
                  Inference paths (e.g. fusion_mlp.py) MUST pass
                  augment=False explicitly.
    """

    def __init__(self, split: str, augment: bool = None):
        assert split in ("train", "val", "test"), f"unknown split: {split}"
        self.split = split

        # Default policy: augment iff this is the train split. Callers can
        # explicitly disable (for fusion logit computation on the train
        # split, where canonical inputs are required).
        if augment is None:
            augment = (split == "train")
        self.augment = augment

        # Per-instance RNG so multiple datasets / workers don't fight over
        # the global numpy state.
        self._rng = np.random.default_rng()

        meta = pd.read_csv(COMMON_METADATA)
        splits = load_splits()
        split_ids = splits[split]["sequence_id"].tolist()

        meta_indexed = meta.set_index("sequence_id")
        missing = [sid for sid in split_ids if sid not in meta_indexed.index]
        if missing:
            raise RuntimeError(
                f"{len(missing)} sequences in {split}_split.csv are missing "
                f"from common_joint_metadata.csv (first few: {missing[:3]})"
            )
        self.meta = meta_indexed.loc[split_ids].reset_index()

        self.labels = self.meta["risk_level"].map(LABEL_TO_INDEX).values
        if np.any(pd.isna(self.labels)):
            unknown = self.meta.loc[
                self.meta["risk_level"].map(LABEL_TO_INDEX).isna(),
                "risk_level",
            ].unique()
            raise ValueError(f"Unknown risk_level values: {unknown}")

        self.pose_paths = self.meta["pose_array_path"].tolist()
        for p in self.pose_paths:
            if not Path(p).exists():
                raise FileNotFoundError(f"Pose file missing: {p}")

    def __len__(self):
        return len(self.meta)

    def __getitem__(self, idx):
        pose = np.load(self.pose_paths[idx])
        assert pose.shape == (100, 14, 3), (
            f"Unexpected shape for {self.meta.iloc[idx]['sequence_id']}: {pose.shape}"
        )

        # Training-time augmentation BEFORE the channel transpose so the
        # helpers can stay in (T, V, 3) coordinates.
        if self.augment:
            pose = apply_augmentations(pose.astype(np.float32), self._rng)

        # (T, V, C) -> (C, T, V)
        pose = pose.transpose(2, 0, 1)
        pose = torch.from_numpy(pose).float()
        label = int(self.labels[idx])
        return pose, label

    def get_class_weights(self) -> torch.Tensor:
        counts = np.bincount(self.labels.astype(int), minlength=NUM_CLASSES)
        weights = len(self.labels) / (NUM_CLASSES * counts.astype(np.float32))
        return torch.from_numpy(weights)

    def get_label_distribution(self) -> dict:
        counts = np.bincount(self.labels.astype(int), minlength=NUM_CLASSES)
        return {INDEX_TO_LABEL[i]: int(counts[i]) for i in range(NUM_CLASSES)}


if __name__ == "__main__":
    for split in ("train", "val", "test"):
        ds = CommonJointDataset(split)
        sample, lbl = ds[0]
        print(f"\n{split.upper()}: n={len(ds)}")
        print(f"  Sample shape: {tuple(sample.shape)}, label: {lbl} "
              f"({INDEX_TO_LABEL[lbl]})")
        print(f"  Label distribution: {ds.get_label_distribution()}")
        print(f"  Class weights: {ds.get_class_weights().tolist()}")
