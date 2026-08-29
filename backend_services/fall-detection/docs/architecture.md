# Architecture

## Two phases — offline training, online inference

```
┌───────────────────────────────────────────────────────────────┐
│  PHASE A — Offline training (runs once, on your laptop)        │
│                                                                │
│  Datasets/  ──► parse_ntu.py ─┐                                │
│                               ├─► data_processor.py ──► .npy   │
│             ──► parse_ur.py  ─┘   (90 × 14 × 3 sequences)      │
│                                                                │
│  .npy ──► features.py ──► hand-crafted 18-feature .npy         │
│  .npy ──► train.py                                             │
│           ├─► stgcn.py        (saved as stgcn_best.pth)        │
│           ├─► classifier.py   (saved as classifier_best.pth)   │
│           └─► fusion.py       (saved as fusion_best.pth)       │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│  PHASE B — Online inference (runs continuously on edge)        │
│                                                                │
│  USB camera ──► MediaPipe Pose ──► 33-landmark frames          │
│           ──► data_processor.extract_mediapipe_14_joints       │
│           ──► 90-frame sliding buffer (3 s @ 30 Hz)            │
│                                                                │
│  buffer ─┬─► stgcn (128-D embedding)                           │
│          ├─► features.py (18 physics features)                 │
│          └─► fusion → softmax → risk score                     │
│                       │                                        │
│          context_engine: zone + posture + transitions          │
│          temporal smoother (EMA + hysteresis) → risk level     │
│                                                                │
│  api/server.py:                                                │
│    /ws/live    push: { skeleton, risk_score, risk_level,       │
│                        contributing_features, posture, zone }  │
│    /api/alerts POST: triggered by server when HIGH persists    │
│    /api/replay GET : last 5 s skeleton-only replay             │
└───────────────────────────────────────────────────────────────┘
```

## Module responsibilities

| Path | Responsibility | Status |
|---|---|---|
| `config/settings.py` | Paths, hyperparameters, joint maps, class IDs | done (but joint map needs reconciliation — see audit) |
| `src/parse_ntu.py` | Read NTU `.skeleton` text, map 25→14 joints | done; subject to joint-layout fix |
| `src/parse_ur.py` | Read UR CSVs into 14-joint sequences | **broken — joints collapse to zero** |
| `src/data_processor.py` | Hip-origin translation, torso normalisation, temporal padding/truncation, MediaPipe→14 mapping | done; should also gain visibility-aware masking |
| `src/features.py` | 18 hand-crafted features per 90-frame window | done; should be unit-tested |
| `src/models/stgcn.py` | Spatio-temporal GCN producing a 128-D embedding | done; adjacency depends on the canonical joint layout |
| `src/models/classifier.py` | Small MLP/LogReg over the 18 features → 2-class logits | **empty stub** |
| `src/models/fusion.py` | Concat embedding + features → 2-class logits | done |
| `src/train.py` | Joint training of ST-GCN + fusion | done; lacks class weighting, test split, augmentation, metrics |
| `src/baseline_rf.py` | RF baseline over 18 features | done |
| `src/context_engine.py` | Zone calibration, posture classifier, transitions | **empty stub** |
| `api/server.py` | FastAPI + WebSocket app | **empty stub** |
| `main.py` | Run both parsers end-to-end | done |

## What is missing entirely (to be created)

1. `src/inference.py` — live MediaPipe loop, sliding buffer, model
   forward, smoothing, event dispatch.
2. `src/postprocess.py` — temporal smoother, hysteresis state machine
   producing the three-tier risk level, contributing-feature
   attribution.
3. `src/calibration.py` — short room-zone calibration pass.
4. `src/events.py` — pre/post 5-second replay buffer + write to disk.
5. `src/models/classifier.py` — feature-only MLP.
6. `api/server.py` — REST + WebSocket endpoints.
7. `src/evaluate.py` — proper held-out test set, confusion matrix,
   F1, recall@95%-precision, latency benchmarks.
8. `tests/` — unit tests for `features.py`, `data_processor.py`,
   adjacency, and the parsers.

## Data shapes (canonical)

| Tensor | Shape | Dtype | Range after normalisation |
|---|---|---|---|
| One sequence | `(90, 14, 3)` | float32 | mostly within `[-3, 3]`, hip at origin |
| Batch of sequences | `(B, 90, 14, 3)` | float32 | same |
| ST-GCN embedding | `(B, 128)` | float32 | unbounded (post-batchnorm) |
| Hand-crafted features | `(B, 18)` | float32 | features standardised at training time |
| Fusion logits | `(B, 2)` | float32 | softmaxed downstream |
