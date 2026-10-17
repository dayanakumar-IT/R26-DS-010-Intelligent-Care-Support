# backend/src/models/stgcn.py
"""Spatio-Temporal Graph Convolutional Network over the 14-joint layout."""
import numpy as np
import torch
import torch.nn as nn

from config.settings import NUM_JOINTS, SKELETON_EDGES

IN_CHANNELS = 4     # x, y, z, visibility


def build_normalised_adjacency():
    """Symmetric-normalised adjacency D^{-1/2} (A + I) D^{-1/2} for the
    canonical 14-joint graph defined in `config/settings.SKELETON_EDGES`."""
    A = np.zeros((NUM_JOINTS, NUM_JOINTS), dtype=np.float32)
    for i, j in SKELETON_EDGES:
        A[i, j] = 1.0
        A[j, i] = 1.0
    A += np.eye(NUM_JOINTS, dtype=np.float32)  # self-loops

    deg = A.sum(axis=1)
    d_inv_sqrt = np.zeros_like(deg)
    d_inv_sqrt[deg > 0] = np.power(deg[deg > 0], -0.5)
    D = np.diag(d_inv_sqrt)
    return torch.from_numpy(D @ A @ D)


class SpatialGraphConv(nn.Module):
    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.conv = nn.Conv2d(in_channels, out_channels, kernel_size=1)

    def forward(self, x, A):
        x = self.conv(x)
        # x: (N, C, T, V) ; A: (V, V)
        return torch.einsum("nctv,vw->nctw", x, A).contiguous()


class STGCNBlock(nn.Module):
    def __init__(self, in_channels, out_channels, stride=1):
        super().__init__()
        self.sgc = SpatialGraphConv(in_channels, out_channels)
        self.tgc = nn.Sequential(
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=(9, 1),
                      stride=(stride, 1), padding=(4, 0)),
            nn.BatchNorm2d(out_channels),
            nn.Dropout(0.3),
        )
        if in_channels != out_channels or stride != 1:
            self.residual = nn.Sequential(
                nn.Conv2d(in_channels, out_channels, kernel_size=1, stride=(stride, 1)),
                nn.BatchNorm2d(out_channels),
            )
        else:
            self.residual = nn.Identity()
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x, A):
        res = self.residual(x)
        x = self.sgc(x, A)
        x = self.tgc(x)
        return self.relu(x + res)


class SkeletalSTGCN(nn.Module):
    """
    Input:  (N, T=90, V=14, C=3)
    Output: logits (N, num_classes) -- or (N, 128) embedding when
            `extract_embedding=True`.
    """
    EMBED_DIM = 128

    def __init__(self, num_classes=2):
        super().__init__()
        self.register_buffer("A", build_normalised_adjacency())

        self.data_bn = nn.BatchNorm1d(IN_CHANNELS * NUM_JOINTS)
        self.block1 = STGCNBlock(IN_CHANNELS, 32, stride=1)
        self.block2 = STGCNBlock(32, 64, stride=2)
        self.block3 = STGCNBlock(64, self.EMBED_DIM, stride=2)
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Linear(self.EMBED_DIM, num_classes)

    def forward(self, x, extract_embedding=False):
        N, T, V, C = x.size()
        assert V == NUM_JOINTS, f"Expected {NUM_JOINTS} joints, got {V}"
        assert C == IN_CHANNELS, f"Expected {IN_CHANNELS} channels, got {C}"

        # Reshape for data-norm
        x = x.permute(0, 3, 2, 1).contiguous()      # (N, C, V, T)
        x = x.view(N, C * V, T)
        x = self.data_bn(x)
        x = x.view(N, C, V, T).permute(0, 1, 3, 2).contiguous()  # (N, C, T, V)

        x = self.block1(x, self.A)
        x = self.block2(x, self.A)
        x = self.block3(x, self.A)

        x = self.pool(x).view(N, self.EMBED_DIM)
        if extract_embedding:
            return x
        return self.fc(x)


if __name__ == "__main__":
    model = SkeletalSTGCN()
    x = torch.randn(2, 90, NUM_JOINTS, IN_CHANNELS)
    print("logits:", model(x).shape, "embed:", model(x, extract_embedding=True).shape)
