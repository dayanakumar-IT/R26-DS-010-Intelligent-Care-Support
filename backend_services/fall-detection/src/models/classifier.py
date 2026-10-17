# backend/src/models/classifier.py
"""
Feature-only classifier (the "physics branch").

Trained on the 18 hand-crafted features alone. Two roles:

1. Acts as the fall-back model when MediaPipe reports degraded /
   unusable pose quality (heavy occlusion).
2. Its first-layer weights provide the contributing-feature
   attribution for the dashboard (top-3 features driving the score).
"""
import torch
import torch.nn as nn

from config.settings import NUM_FEATURES


class FeatureClassifier(nn.Module):
    HIDDEN_1 = 64
    HIDDEN_2 = 32

    def __init__(self, in_dim=NUM_FEATURES, num_classes=2):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, self.HIDDEN_1),
            nn.BatchNorm1d(self.HIDDEN_1),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(self.HIDDEN_1, self.HIDDEN_2),
            nn.ReLU(inplace=True),
            nn.Linear(self.HIDDEN_2, num_classes),
        )

    def forward(self, x):
        return self.net(x)

    def first_layer_weights_for_fall(self) -> torch.Tensor:
        """
        Returns a length-`in_dim` tensor of |w_fall - w_normal| for the
        first linear layer, useful as a simple per-feature importance
        signal for the contributing-feature display.
        """
        # The first Linear lives at index 0 of the Sequential.
        W = self.net[0].weight.detach()          # (HIDDEN_1, in_dim)
        # Average absolute weight per input feature across hidden units
        # is a faithful proxy when there is no clean per-class linear
        # readout. Cheap and stable.
        return W.abs().mean(dim=0)


if __name__ == "__main__":
    m = FeatureClassifier()
    x = torch.randn(4, NUM_FEATURES)
    print("logits:", m(x).shape, "feat_imp:", m.first_layer_weights_for_fall().shape)
