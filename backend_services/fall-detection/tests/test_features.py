"""
Unit tests — FeatureExtractor (src/features.py)
Run: cd backend_services/fall-detection && pytest tests/ -v
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pytest
from src.features import FeatureExtractor
from config.settings import NUM_FEATURES, FEATURE_NAMES

T = 90   # 3-second window at 30fps
V = 14   # joints
C = 4    # x, y, z, visibility

rng = np.random.default_rng(42)


def _make_seq(T=T, V=V, C=C):
    """Synthetic (T, V, C) skeleton sequence — random but in normalised range."""
    return rng.random((T, V, C)).astype(np.float32)


def _make_standing_seq():
    """Sequence where torso is vertical (low fall risk)."""
    seq = np.zeros((T, V, C), dtype=np.float32)
    # Joint 1 = neck (y≈0.3), Joint 8/9 = hips (y≈0.6)
    for t in range(T):
        seq[t, 1, 1] = 0.30   # neck y
        seq[t, 8, 1] = 0.60   # l_hip y
        seq[t, 9, 1] = 0.60   # r_hip y
        seq[t, 0, 1] = 0.15   # head y
    return seq


def _make_falling_seq():
    """Sequence simulating downward hip motion (fall)."""
    seq = np.zeros((T, V, C), dtype=np.float32)
    for t in range(T):
        drop = t / T * 0.5   # hip drops from y=0.4 → y=0.9 (downward = increasing y)
        seq[t, 8, 1] = 0.4 + drop
        seq[t, 9, 1] = 0.4 + drop
        seq[t, 1, 1] = 0.2 + drop
    return seq


class TestFeatureExtractorShape:
    def test_output_shape(self):
        """Feature vector must always be exactly NUM_FEATURES (18) long."""
        fe = FeatureExtractor()
        seq = _make_seq()
        feats = fe.extract_sequence_features(seq)
        assert feats.shape == (NUM_FEATURES,), f"Expected ({NUM_FEATURES},), got {feats.shape}"

    def test_output_shape_3channel_input(self):
        """Also works with (T, V, 3) input — visibility channel dropped internally."""
        fe = FeatureExtractor()
        seq = _make_seq(C=3)
        feats = fe.extract_sequence_features(seq)
        assert feats.shape == (NUM_FEATURES,)

    def test_feature_names_count(self):
        """FEATURE_NAMES list must have exactly NUM_FEATURES entries."""
        assert len(FEATURE_NAMES) == NUM_FEATURES

    def test_no_nan_or_inf(self):
        """Feature vector must be finite — no NaN or Inf from degenerate input."""
        fe = FeatureExtractor()
        seq = _make_seq()
        feats = fe.extract_sequence_features(seq)
        assert np.all(np.isfinite(feats)), "Feature vector contains NaN or Inf"

    def test_zero_sequence_no_crash(self):
        """All-zero skeleton should not crash — returns finite zeros or small values."""
        fe = FeatureExtractor()
        seq = np.zeros((T, V, C), dtype=np.float32)
        feats = fe.extract_sequence_features(seq)
        assert feats.shape == (NUM_FEATURES,)
        assert np.all(np.isfinite(feats))

    def test_dtype_float32(self):
        """Output must be float32 (matches model input expectations)."""
        fe = FeatureExtractor()
        seq = _make_seq()
        feats = fe.extract_sequence_features(seq)
        assert feats.dtype == np.float32


class TestFeatureSemantics:
    def test_falling_has_higher_velocity_than_standing(self):
        """
        Falling sequence should produce higher mean vertical hip drop velocity (F1)
        than a stable standing sequence.
        """
        fe = FeatureExtractor()
        fall_feats = fe.extract_sequence_features(_make_falling_seq())
        stand_feats = fe.extract_sequence_features(_make_standing_seq())
        # F1 = mean vertical velocity; falling has larger magnitude (may be negative)
        assert abs(fall_feats[0]) > abs(stand_feats[0]), (
            f"|Fall F1|={abs(fall_feats[0]):.4f} should exceed |Stand F1|={abs(stand_feats[0]):.4f}"
        )

    def test_stable_sequence_low_sway(self):
        """
        A perfectly still (constant) sequence should have near-zero sway (F13).
        """
        fe = FeatureExtractor()
        seq = np.ones((T, V, C), dtype=np.float32) * 0.5
        feats = fe.extract_sequence_features(seq)
        f13 = feats[12]   # std_torso_sway
        assert f13 < 0.05, f"Sway should be near-zero for constant sequence, got {f13:.4f}"
