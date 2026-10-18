"""
Unit tests — SkeletalSTGCN and LateFusionNetwork (src/models/)
Run: cd backend_services/fall-detection && pytest tests/ -v
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
import torch
from src.models.stgcn import SkeletalSTGCN
from src.models.fusion import LateFusionNetwork
from config.settings import NUM_JOINTS, NUM_FEATURES

BATCH = 4
T = 90
C = 4   # x, y, z, visibility


class TestSkeletalSTGCN:
    def test_output_logits_shape(self):
        """Forward pass must return (N, 2) logits for binary classification."""
        model = SkeletalSTGCN(num_classes=2)
        x = torch.randn(BATCH, T, NUM_JOINTS, C)
        out = model(x)
        assert out.shape == (BATCH, 2), f"Expected ({BATCH}, 2), got {out.shape}"

    def test_embedding_shape(self):
        """extract_embedding=True must return (N, 128) embedding."""
        model = SkeletalSTGCN()
        x = torch.randn(BATCH, T, NUM_JOINTS, C)
        emb = model(x, extract_embedding=True)
        assert emb.shape == (BATCH, 128), f"Expected ({BATCH}, 128), got {emb.shape}"

    def test_wrong_joint_count_raises(self):
        """Passing wrong number of joints must raise AssertionError."""
        model = SkeletalSTGCN()
        x = torch.randn(BATCH, T, 17, C)   # 17 joints (COCO), not 14
        with pytest.raises(AssertionError):
            model(x)

    def test_wrong_channel_count_raises(self):
        """Passing wrong channel count must raise AssertionError."""
        model = SkeletalSTGCN()
        x = torch.randn(BATCH, T, NUM_JOINTS, 3)   # 3 channels, not 4
        with pytest.raises(AssertionError):
            model(x)

    def test_no_nan_in_output(self):
        """Model output must not contain NaN values."""
        model = SkeletalSTGCN()
        x = torch.randn(BATCH, T, NUM_JOINTS, C)
        out = model(x)
        assert not torch.isnan(out).any(), "NaN in ST-GCN logits"

    def test_eval_mode_deterministic(self):
        """In eval mode, same input must produce same output (no dropout randomness)."""
        model = SkeletalSTGCN().eval()
        x = torch.randn(BATCH, T, NUM_JOINTS, C)
        with torch.no_grad():
            out1 = model(x)
            out2 = model(x)
        assert torch.allclose(out1, out2), "Non-deterministic output in eval mode"

    def test_adjacency_matrix_registered(self):
        """Normalised adjacency A must be registered as a buffer."""
        model = SkeletalSTGCN()
        assert hasattr(model, "A"), "Adjacency matrix A not registered as buffer"
        assert model.A.shape == (NUM_JOINTS, NUM_JOINTS)

    def test_softmax_sums_to_one(self):
        """Softmax of logits must sum to 1.0 per sample."""
        model = SkeletalSTGCN().eval()
        x = torch.randn(BATCH, T, NUM_JOINTS, C)
        with torch.no_grad():
            logits = model(x)
            probs = torch.softmax(logits, dim=1)
        sums = probs.sum(dim=1)
        assert torch.allclose(sums, torch.ones(BATCH), atol=1e-5)


class TestLateFusionNetwork:
    def test_output_logits_shape(self):
        """Fusion forward must return (N, 2) logits."""
        net = LateFusionNetwork()
        emb = torch.randn(BATCH, 128)
        feats = torch.randn(BATCH, NUM_FEATURES)
        out = net(emb, feats)
        assert out.shape == (BATCH, 2), f"Expected ({BATCH}, 2), got {out.shape}"

    def test_no_nan_in_output(self):
        """Fusion output must not contain NaN."""
        net = LateFusionNetwork()
        emb = torch.randn(BATCH, 128)
        feats = torch.randn(BATCH, NUM_FEATURES)
        out = net(emb, feats)
        assert not torch.isnan(out).any(), "NaN in Fusion logits"

    def test_fall_probability_in_range(self):
        """Softmax fall probability must be in [0, 1]."""
        net = LateFusionNetwork().eval()
        emb = torch.randn(BATCH, 128)
        feats = torch.randn(BATCH, NUM_FEATURES)
        with torch.no_grad():
            logits = net(emb, feats)
            prob = torch.softmax(logits, dim=1)[:, 1]
        assert (prob >= 0).all() and (prob <= 1).all()

    def test_eval_mode_deterministic(self):
        """In eval mode, same input must give same output."""
        net = LateFusionNetwork().eval()
        emb = torch.randn(BATCH, 128)
        feats = torch.randn(BATCH, NUM_FEATURES)
        with torch.no_grad():
            out1 = net(emb, feats)
            out2 = net(emb, feats)
        assert torch.allclose(out1, out2)


class TestEndToEndPipeline:
    def test_stgcn_to_fusion_pipeline(self):
        """Full pipeline: skeleton → ST-GCN embedding → Fusion → fall probability."""
        stgcn = SkeletalSTGCN().eval()
        fusion = LateFusionNetwork().eval()
        x = torch.randn(BATCH, T, NUM_JOINTS, C)
        feats = torch.randn(BATCH, NUM_FEATURES)
        with torch.no_grad():
            emb = stgcn(x, extract_embedding=True)
            logits = fusion(emb, feats)
            prob = torch.softmax(logits, dim=1)[:, 1]
        assert prob.shape == (BATCH,)
        assert (prob >= 0).all() and (prob <= 1).all()
        assert not torch.isnan(prob).any()
