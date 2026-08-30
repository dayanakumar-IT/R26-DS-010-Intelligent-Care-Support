# backend/src/models/fusion.py
"""Late-fusion head over [ST-GCN embedding | standardised 18 features]."""
import torch
import torch.nn as nn

from config.settings import NUM_FEATURES


class LateFusionNetwork(nn.Module):
    def __init__(self, stgcn_embed_dim=128, physics_dim=NUM_FEATURES, num_classes=2):
        super().__init__()
        # LayerNorm on the embedding side keeps it on the same magnitude
        # scale as the standardised physics features; otherwise the deep
        # branch dominates the linear layer at the start of training.
        self.embed_norm = nn.LayerNorm(stgcn_embed_dim)
        total = stgcn_embed_dim + physics_dim
        self.head = nn.Sequential(
            nn.Linear(total, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(64, num_classes),
        )

    def forward(self, stgcn_features, physics_features):
        z = self.embed_norm(stgcn_features)
        x = torch.cat((z, physics_features), dim=1)
        return self.head(x)


if __name__ == "__main__":
    net = LateFusionNetwork()
    e = torch.randn(2, 128)
    p = torch.randn(2, NUM_FEATURES)
    print("logits:", net(e, p).shape)
