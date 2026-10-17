# Changelog — Backend Refactor

Date: 2026-06-30

## What changed in this pass

All P0 audit findings (A1–A8) and one P1 item (classifier) are now
addressed in code. The full backend training/eval pipeline is wired
end-to-end and smoke-tested.

### Joint layout standardised (A2)
- One canonical 14-joint layout lives in
  [config/settings.py](../config/settings.py): `JOINT_NAMES`, `JOINT`,
  `SKELETON_EDGES`, `LR_FLIP_PAIRS`.
- [src/parse_ntu.py](../src/parse_ntu.py), [src/models/stgcn.py](../src/models/stgcn.py),
  [src/data_processor.py](../src/data_processor.py), and [src/features.py](../src/features.py)
  all read from those constants — no more layout drift.
- Adjacency is built from `SKELETON_EDGES` at runtime by
  `build_normalised_adjacency()` in `stgcn.py`.

### Spatial normalisation switched to clip-level (new design call)
- Was: subtract each frame's own hip → hip never moves in any clip →
  every hip-velocity / path-length / std feature was identically zero.
  This was a silent bug in the original pipeline.
- Now: subtract **frame 0's** hip and divide by **frame 0's** torso
  length, once per clip (`DataProcessor.apply_clip_normalization`).
  Hip motion within the clip is preserved, so F0–F4 and F13–F16 carry
  real signal.
- `apply_spatial_normalization` (per-frame) is kept for ablation only.

### Feature extractor sign-fixed and hardened (A8 + bug)
- Vertical-drop features now report the *signed downward* component
  (we negate y) so a fall produces large positive values. Previously
  the sign convention silently flipped the feature.
- `np.nan_to_num` guard added so a degenerate input cannot produce
  NaN/Inf into the model.

### UR Fall ingestion gated off (A1)
- UR CSVs locally only contain (frame, time, scalar) — there is no
  per-joint data on disk. The previous parser fabricated all-zero
  joints; that has been removed.
- `src/parse_ur.py` now skips UR unless `data/processed/ur_mediapipe/`
  exists (filled by the offline MediaPipe-on-UR step in P0-2 of
  `improvement_plan.md`).

### Training pipeline rewritten (A3, A4, A5, A7)
- 70 / 15 / 15 stratified split, persisted under
  `data/processed/split_idx.npz` so train / val / test never drift
  across runs.
- Class weights computed from training labels (≈ 0.667 NORMAL,
  ≈ 1.993 FALL).
- Augmentation chain (temporal jitter, L/R flip, yaw rotation,
  Gaussian joint noise) applied inside `__getitem__`; the 18
  handcrafted features are recomputed on the augmented sequence so
  the deep and physics branches stay consistent.
- `StandardScaler` fitted on training features only; persisted to
  `models/saved/feature_scaler.joblib`.
- Cosine LR, gradient clipping at norm 1.0, AdamW with weight decay
  1e-4.
- Early stopping and best-checkpoint selection on **macro-F1**,
  not val loss.
- Per-epoch CSV log at `models/saved/train_log.csv`.

### Feature-only classifier implemented (P1-1)
- `src/models/classifier.py` — small two-hidden-layer MLP over the 18
  features. Used as the fallback when pose quality is degraded, and
  as the source of the contributing-feature attribution.
- `src/train_classifier.py` trains it with class-weighted CE on the
  same split.

### Fusion head slightly improved (A8)
- `LateFusionNetwork` now LayerNorm-s the 128-D embedding before
  concatenating the standardised 18 features. Keeps the two branches
  on comparable magnitudes so the linear layer can use both.

### Evaluation script (P0-4)
- `src/evaluate.py` loads the saved checkpoints + scaler + persisted
  test indices, runs the three branches, and writes
  `models/saved/eval_report.md` + `eval_report.json`.

### Housekeeping
- `requirements.txt` populated with the minimum runtime pins.
- `src/data_splits.py` introduced as the shared loader/splitter/scaler
  so all training and evaluation scripts agree on the data.

## Verification done in this pass

- NTU re-ingested with the new pipeline → 3,777 sequences, real
  per-joint variation, no degenerate sequences.
- Features re-extracted and inspected per class:
  - `max_vy_hip`: FALL +3.69 vs NORMAL +2.60
  - `mean_vy_head`: FALL +0.51 vs NORMAL -0.01
  - `max_torso_angle`: FALL ~60° vs NORMAL ~40°
  - `max_aspect_ratio`: FALL +1.22 vs NORMAL +0.64
  - `min_hip_height_ratio`: FALL 0.47 vs NORMAL 0.68
- Random Forest baseline on these features: **96.7 % val macro-F1**.
- Smoke training run (1 epoch) on the fusion path:
  val macro-F1 = 0.981, fall recall = 0.979.
- Held-out **test** evaluation after the same 1-epoch run:
  | Model | Macro-F1 | Fall Recall | Fall Precision | ROC-AUC |
  |---|---|---|---|---|
  | Feature classifier | 0.889 | 0.972 | 0.742 | 0.977 |
  | Fusion             | 0.976 | 0.958 | 0.971 | 0.990 |

## What you should do next

1. **Run real training** (full 60 epochs):
   ```powershell
   cd backend
   .\venv\Scripts\Activate.ps1
   python -m src.train               # ~30 min on CPU; faster on GPU
   python -m src.train_classifier
   python -m src.evaluate
   ```
   The saved checkpoints currently in `models/saved/` are from the OLD
   buggy pipeline; `train.py` will overwrite them.

2. **Refresh the train log** and the eval report:
   - `models/saved/train_log.csv`
   - `models/saved/train_classifier_log.csv`
   - `models/saved/eval_report.md`

3. **Move to P1-4 onward** in `improvement_plan.md`:
   - cross-dataset experiment (NTU → UR once UR skeletons are
     produced),
   - subject-disjoint NTU split,
   - the live MediaPipe inference loop (`src/inference.py`),
   - the FastAPI server (`api/server.py`),
   - the context engine (`src/context_engine.py`).

## What did NOT change

- `api/server.py` is still empty — P1-8.
- `src/context_engine.py` is still empty — P1-5.
- `src/inference.py` does not exist yet — P1-7.
- `src/postprocess.py` (risk-level state machine) does not exist
  yet — P1-6.
- UR Fall data still cannot contribute skeletons until either the
  upstream `skeleton.zip` is downloaded *or* MediaPipe is run offline
  on the UR RGB videos.
