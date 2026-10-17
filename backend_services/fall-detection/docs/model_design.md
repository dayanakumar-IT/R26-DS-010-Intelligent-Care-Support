# Model Design

## Why a hybrid model

A single end-to-end ST-GCN works, but it is brittle in two ways that
matter on the edge:

1. **Long-tail kinematics.** A real fall has a sharp vertical drop and
   a torso lean exceeding ~60°. These are *physics*, not learned
   patterns — a tiny network of hand-crafted features captures them
   precisely with no training data needed. Wherever the deep model is
   under-confident, the physics features hold the line.
2. **Explainability.** Caregivers must see *why* an alert fired. The
   handcrafted features (vertical drop, torso angle, kinetic spike,
   etc.) are directly nameable; ST-GCN embeddings are not.

So the system runs **both branches** and combines them with a small
late-fusion layer.

```
        sequence (90, 14, 3)
                │
        ┌───────┴────────────────────────────┐
        │                                    │
   ST-GCN encoder                  hand-crafted features
   (3 → 32 → 64 → 128 chan.)             (18 floats)
        │                                    │
   embedding (128)                  standardised (18)
        └───────────────┬────────────────────┘
                        │
                  concat (146)
                        │
                fusion MLP (146 → 64 → 2)
                        │
                  softmax → P(fall)
```

We also train a tiny **feature-only classifier** (`classifier.py`) on
the same 18 features. At inference it acts as a fallback when MediaPipe
flags low joint visibility (heavy occlusion) — see *Pose quality* in
the project proposal. It also gives us a third number to report in the
evaluation: ST-GCN-only, features-only, and fusion.

## ST-GCN — choices and why

- **14-joint graph** (see `Datasets/docs/unified_14_joint_layout.md`)
  with bidirectional edges + self-loops + symmetric degree
  normalisation. Standard ST-GCN trick.
- **Channels: 3 → 32 → 64 → 128.** This is roughly the smallest
  channel ladder that still trains well on 4k sequences. Bigger ladders
  (3→64→128→256) overfit our dataset and slow CPU inference.
- **Temporal kernel 9, stride 2 in two blocks.** Compresses 90 frames
  down to ~23 — enough receptive field to see a 3 s window globally,
  but cheap enough to run on the Victus CPU.
- **AdaptiveAvgPool2d(1).** Removes the dependency on exact temporal
  length, so a slightly shorter live buffer is still accepted.
- **`extract_embedding` flag.** During fusion training, we want the
  128-D pre-classifier representation, not the 2-class logits. The
  current `stgcn.py` already supports this.

## Feature-only classifier (`classifier.py` — to be implemented)

A two-layer MLP is enough; gradient-boosted trees also fine. Keep it
under 5k parameters so it remains fast on CPU.

```python
class FeatureClassifier(nn.Module):
    def __init__(self, in_dim=18, num_classes=2):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, num_classes),
        )

    def forward(self, x):
        return self.net(x)
```

Train it separately on the same 80/15/15 split using class-weighted
cross-entropy.

## Late fusion (`fusion.py`)

Already implemented. Two important refinements to add:

1. **Standardise the 18 features** before concatenation. Persist the
   scaler (`joblib.dump` to `models/saved/feature_scaler.joblib`).
2. **Add a small `LayerNorm` on the 128-D embedding** before concat.
   Otherwise ST-GCN's bigger magnitudes dominate the linear layer and
   the physics features are effectively ignored.

## Loss and calibration

- Class-weighted cross-entropy (or focal loss with γ=2.0).
- After training, do a **temperature calibration** pass on val:
  multiply logits by `1/T` where `T` is chosen by minimising NLL.
  This makes the softmax probability *meaningful* for the risk
  threshold in `risk_levels.md`.

## Edge cost (approximate)

| Branch | Params | FLOPs / forward | CPU time on Victus (est.) |
|---|---|---|---|
| ST-GCN | ~220 k | ~85 M | 25 ms |
| Feature extractor (NumPy) | n/a | ~0.5 M | 3 ms |
| Feature classifier | ~3 k | ~6 k | <1 ms |
| Fusion MLP | ~10 k | ~20 k | <1 ms |
| **Total / window** | | | **~30 ms** |

We target inference every 6 frames @ 30 FPS — i.e. 5 Hz risk update.
That leaves the CPU comfortably under 30 % utilisation, with MediaPipe
already taking another ~25 %.
