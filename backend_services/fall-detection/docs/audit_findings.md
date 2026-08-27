# Audit Findings

These are the issues that explain **why the trained models are not
satisfying** — and what to do about each. Severity is ordered from
most → least impact on accuracy.

---

## A1 — UR Fall data is silently degenerate  *(critical)*

**Symptom.** `np.load('ur_data.npy')[0,0]` is the all-zero matrix.

**Root cause.** `backend/src/parse_ur.py` copies the body-centre
`(COMx, COMy, COMz)` into all 14 joints, and then
`apply_spatial_normalization` subtracts the hip-midpoint — which is the
same point. Result: every joint of every UR frame is `(0,0,0)`.

**Effect.**
- The ST-GCN learns nothing from UR.
- The handcrafted feature extractor produces all-zero vectors for UR,
  which means the fusion head receives systematically zero features
  whenever the true label is fall-or-ADL from UR. This *poisons* the
  feature scaler and biases the classifier.

**Fix.** Replace `parse_ur.py` with one of:
1. Run MediaPipe on the UR RGB videos offline (recommended — matches
   deployment-time data distribution).
2. Download the upstream `skeleton.zip` (Kinect-v1 20-joint per frame)
   and write a mapper to our 14-joint layout.
3. Drop UR from the ST-GCN path and feed only the COM trajectory into a
   reduced, separate feature head (last resort).

Tracked as **P0** in `improvement_plan.md`.

---

## A2 — Three conflicting 14-joint layouts in the code  *(critical)*

The 14-joint contract is referenced by three modules and they
**disagree**:

| Module | Index 13 is… | Has Torso Centre? | Has Right Ankle? |
|---|---|---|---|
| `config/settings.py` (`MEDIAPIPE_JOINT_MAP`) | Torso Centre (derived) | yes | no |
| `src/parse_ntu.py` (`NTU_MAP`) | R Ankle | no | yes |
| `src/models/stgcn.py` (adjacency edges and docstring) | Torso Centre | yes | yes (and yet only 14 indices) |

**Effect.** The adjacency matrix in `stgcn.py` is wired to a joint
layout that the parsers never produce. The graph convolution is
multiplying the wrong joints together. That alone can wipe out a large
fraction of the model's accuracy potential.

**Fix.** Standardise on **one** layout (the document
`Datasets/docs/unified_14_joint_layout.md` proposes which one — both
ankles present, no torso-centre joint, torso is *computed* from L/R
shoulder + L/R hip). Then:

- Update `MEDIAPIPE_JOINT_MAP` in `config/settings.py` to map MediaPipe
  landmarks `0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28` into
  the 14 slots (head at 0; neck at 1 computed as mid-shoulder;
  shoulders/elbows/wrists/hips/knees/ankles at 2..13).
- Update the `connections` list in `stgcn.py` to match.
- `parse_ntu.NTU_MAP` already matches the proposed layout — just
  document it.

Tracked as **P0**.

---

## A3 — Class imbalance ignored during training  *(high)*

**Symptom.** Training uses plain `CrossEntropyLoss()` with no `weight`
argument. The merged dataset is 977 FALL vs. 2,870 NORMAL — about
**3:1 toward NORMAL**.

**Effect.** Adam converges to a model that prefers to predict NORMAL.
Accuracy looks high (~75 % trivially), but recall on fall is poor.
This is the single biggest reason the model "feels" unsatisfying —
nothing in the loop is rewarding it for catching falls.

**Fix.**
- Add `class_weight = [n_normal/n_total, n_fall/n_total]` or simply
  `[1.0, 3.0]` to `CrossEntropyLoss(weight=...)`.
- Or use focal loss (γ=2.0) — often gives a couple more recall points.
- Track macro-F1 and fall-recall as the primary metric; keep accuracy
  only as a secondary number.

---

## A4 — Early stopping uses val loss, not val F1  *(high)*

**Symptom.** `train.py` checkpoints on lowest validation loss. With
class imbalance, val loss can keep going down even while fall-recall
drops — the model is just getting more confident on the easy NORMAL
samples.

**Fix.** Checkpoint on **best macro-F1** (or best fall-recall at a
fixed precision floor, e.g. 0.85). Pair with a small constant patience
(5–10 epochs) and a cosine LR schedule.

---

## A5 — No train / val / test separation  *(high)*

**Symptom.** Single 80/20 stratified split. The 20 % "validation" set
is also being used to pick the best checkpoint, so any number you
report from it is **biased upward**.

**Fix.** Three-way split: 70 % train / 15 % val / 15 % test. Train and
checkpoint on val, then evaluate the chosen checkpoint **once** on test.
Also do *one* cross-dataset run: train on NTU only, test on UR — that
is the credible robustness number to put in the report.

---

## A6 — No data augmentation  *(medium)*

**Symptom.** The model sees the same exact (90,14,3) sample on every
epoch. Skeletons admit cheap, label-preserving augmentations:

- random temporal crop / time-warp (re-sample 90 frames from a longer
  source with jitter)
- horizontal flip (swap L/R joints — biomechanically equivalent)
- additive Gaussian joint noise (σ ≈ 0.01 after normalisation)
- random small rotation around vertical axis (camera viewpoint change)

**Fix.** Implement these in `data_processor.py` (apply at training time
only, behind a flag).

---

## A7 — Padding with the last frame distorts statistics  *(medium)*

**Symptom.** `enforce_temporal_uniformity` pads short sequences by
copying the *last* frame. This kills velocity-derived features for the
padded region (zero motion) and biases the model toward thinking short
sequences end in stillness.

**Fix.** Either
- only train on sequences already ≥ TARGET_FRAMES (cheapest), or
- pad symmetrically (copy first frame for half, last frame for half),
  and mark padded frames in a per-frame mask the model receives, or
- temporally interpolate (re-sample 90 evenly spaced frames from the
  whole clip).

Option 3 is preferred.

---

## A8 — Features are not standardised before fusion  *(medium)*

**Symptom.** The 18 hand-crafted features are concatenated to the
128-D ST-GCN embedding with no per-feature scaling. F6 (kinetic energy
proxy) and F16 (path length) are on a different order of magnitude
than the angle features.

**Fix.** Fit a `StandardScaler` on the training features, save it
alongside the checkpoint, apply it both at training time and at
inference time.

---

## A9 — Binary output, no risk levels  *(design)*

**Symptom.** The model predicts FALL vs. NORMAL. The deployment
contract asks for three levels (Normal / Moderate / High-risk) and
hysteresis-based alerts.

**Fix.** Keep the model binary; layer the three-level state machine on
top of the softmax probability. See `risk_levels.md`.

---

## A10 — `requirements.txt` is empty  *(housekeeping)*

**Fix.** Pin the working set:

```
torch>=2.2,<2.5
numpy>=1.26,<2.0
scikit-learn>=1.4
pandas>=2.1
mediapipe>=0.10
opencv-python>=4.9
fastapi>=0.110
uvicorn[standard]>=0.27
websockets>=12
pydantic>=2.6
joblib>=1.3
matplotlib>=3.8
```

---

## A11 — `classifier.py`, `context_engine.py`, `api/server.py` empty *(design)*

Three modules in the project plan have no implementation yet. They are
necessary for the system as described in the proposal. See the ordered
plan in `improvement_plan.md`.
