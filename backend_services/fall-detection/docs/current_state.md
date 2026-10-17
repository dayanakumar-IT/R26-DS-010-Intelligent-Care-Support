# Current State (snapshot 2026-06-30)

Below is exactly what has been built so far, with file paths and the
verified behaviour of each piece. **Bugs are listed in
`audit_findings.md`, not here.**

## 1 — Data ingestion

### `backend/src/parse_ntu.py`
- Streams `.skeleton` files directly out of the two NTU zips.
- Filters by `NTU_TARGET_CLASSES = ["A043","A008","A009","A027"]`.
- Discards secondary bodies; keeps body #1 only.
- Maps NTU's 25 joints to our 14-joint layout via `NTU_MAP`.
- Drops sequences shorter than 30 frames.
- Output: `data/processed/ntu_data.npy` of shape `(3777, 90, 14, 3)`,
  plus `ntu_labels.npy` of shape `(3777,)`.

### `backend/src/parse_ur.py`
- Reads `*-data.csv` from `adl/` and `fall/`.
- Pulls columns 2–4 (`COMx, COMy, COMz`) only.
- Copies that single 3D point into all 14 joints. **(This is the bug —
  see audit.)**
- Output: `data/processed/ur_data.npy` of shape `(70, 90, 14, 3)` —
  all zeros after normalisation.

### `backend/src/data_processor.py`
- `apply_spatial_normalization` translates each frame so that the
  hip-midpoint is at the origin, then divides by the torso length
  (neck-to-hip distance) so scale is camera-invariant.
- `enforce_temporal_uniformity` truncates to 90 frames or pads with
  copies of the last frame.
- `extract_mediapipe_14_joints` builds a `(14, 4)` tensor from a
  MediaPipe result (xyz + visibility). Used at inference time only.

### `backend/main.py`
- Runs `run_ur_pipeline()` then `run_ntu_pipeline()` and exits.
  Successfully produces the `.npy` files listed above.

## 2 — Hand-crafted features

### `backend/src/features.py`
- One class `FeatureExtractor`, one method
  `extract_sequence_features(seq)` that consumes a `(90, 14, 3)`
  tensor and emits a length-18 float32 vector.
- The 18 features are grouped into four categories: vertical/linear
  velocities (F1–F4), acceleration & kinetic energy (F5–F7), body
  geometry & orientation (F8–F12), micro-movement & gait (F13–F18).
- `batch_compile_features(in_path, out_path)` writes the matrix to
  disk. Already executed — see
  `data/processed/ntu_features.npy` (3777, 18) and
  `ur_features.npy` (70, 18).

## 3 — Models

### `backend/src/models/stgcn.py`
- 14-node adjacency built from a hard-coded edge list (with a self-loop
  and symmetric normalisation `D^-1/2 A D^-1/2`).
- Three `STGCNBlock`s: 3 → 32 → 64 → 128 channels, temporal stride
  reducing 90 → 45 → 23 frames.
- Global average pool → 128-D embedding → `Linear(128 → 2)` head.
- `forward(x, extract_embedding=False)` lets the fusion model grab the
  embedding instead of class logits.

### `backend/src/models/fusion.py`
- `LateFusionNetwork(128 + 18 → 64 → 2)` with BatchNorm + dropout.

### `backend/src/models/classifier.py`
- **Empty file.** The feature-only branch described in the project
  proposal does not exist yet.

## 4 — Training

### `backend/src/train.py`
- Loads NTU + UR `.npy` arrays, concatenates them, stratified 80/20 split.
- Trains ST-GCN and fusion jointly with Adam (lr=1e-4, weight decay=1e-4).
- Early stopping on validation **loss** with patience 5; up to 40 epochs.
- Saves best `stgcn_best.pth` and `fusion_best.pth` to `models/saved/`.
- **No class weighting, no augmentation, no held-out test split, no
  metric beyond accuracy.**

### `backend/src/baseline_rf.py`
- Trains `RandomForestClassifier(n_estimators=100, max_depth=10)` on
  the concatenated 18-feature matrix.
- Prints `classification_report` over a 20 % validation split.

## 5 — API

### `backend/api/server.py`
- **Empty file.** No endpoints, no WebSocket, no MediaPipe live loop yet.

## 6 — Context engine

### `backend/src/context_engine.py`
- **Empty file.** No zone calibration, posture classifier, or
  transition detector yet.

## 7 — Saved artefacts

```
backend/models/saved/
├── stgcn_best.pth   (~875 KB)   from a prior training run
└── fusion_best.pth  (~ 43 KB)
backend/data/processed/
├── ntu_data.npy        (55 MB)  (3777, 90, 14, 3)
├── ntu_features.npy    (266 KB) (3777, 18)
├── ntu_labels.npy      (30 KB)  (3777,)
├── ur_data.npy         (1.1 MB) (70, 90, 14, 3)  — DEGENERATE (all zeros)
├── ur_features.npy     (5.1 KB) (70, 18)         — DEGENERATE
└── ur_labels.npy       (688 B)  (70,)
```

The saved `.pth` checkpoints come from training **before** the audit
findings were known. They should be **retrained** after the P0 fixes
are applied — see `improvement_plan.md`.
