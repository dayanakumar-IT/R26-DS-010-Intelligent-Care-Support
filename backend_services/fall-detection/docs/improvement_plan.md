# Improvement Plan

Ordered list of work to get from "models exist but unsatisfying" to a
defensible final system. Each item has a concrete acceptance check.

Legend: **P0** = blocking (don't bother retraining without these),
**P1** = needed for a credible result, **P2** = polish / nice-to-have.

---

## P0 — Fix the foundations (do these first)

### P0-1 · Decide and enforce the canonical 14-joint layout
- Update `config/settings.py` → `MEDIAPIPE_JOINT_MAP` so the 14 slots
  are `[Head, Neck, LSh, RSh, LElb, RElb, LWri, RWri, LHip, RHip,
  LKnee, RKnee, LAnk, RAnk]` (no torso-centre slot).
- Update `src/parse_ntu.NTU_MAP` to match (it nearly already does).
- Update the `connections` edge list in `src/models/stgcn.py` to match.
- **Done when:** all three files reference the *same* 14 joint names
  in the *same* order, and `python -m src.models.stgcn` runs without
  error.

### P0-2 · Fix UR Fall ingestion
- Replace `parse_ur.py` so it produces real per-joint coordinates.
- Preferred path: run MediaPipe Pose offline on the UR RGB videos
  (download `fall-*-cam0-rgb.zip` and `adl-*-cam0-rgb.zip` from the
  UR project page; cache the resulting skeletons to
  `data/processed/ur_mediapipe/` and parse from there).
- **Done when:** `np.load('ur_data.npy')[0,0]` has non-zero variance
  across joints, and the 18 hand-crafted features computed on UR
  produce non-zero numbers (especially F8/F9 torso angle).

### P0-3 · Add class weighting and metrics to `train.py`
- Use `CrossEntropyLoss(weight=class_weights)` computed from the
  training labels.
- Report per epoch: train/val loss, train/val accuracy, **macro-F1**,
  **fall-recall**, **fall-precision**.
- Checkpoint on **best macro-F1**, not val loss.
- **Done when:** training prints F1 and recall, and the saved
  `*_best.pth` is the one with the highest macro-F1 across all epochs.

### P0-4 · Three-way split + held-out test set
- Replace the 80/20 split with **70 / 15 / 15**, stratified.
- Persist the test indices to `data/processed/test_idx.npy` so reruns
  use the same test set.
- Add `src/evaluate.py` that loads the best checkpoints and prints
  confusion matrix, classification report, ROC-AUC, PR-AUC on the
  test set.
- **Done when:** `python -m src.evaluate` runs and produces a
  one-page metrics summary.

### P0-5 · Standardise hand-crafted features
- Fit a `sklearn.preprocessing.StandardScaler` on the **training**
  18-feature matrix, save to `models/saved/feature_scaler.joblib`.
- Apply the scaler in `train.py` (fit on train, transform train/val/
  test) and in the inference loop.
- **Done when:** the scaler artefact exists and `train.py` no longer
  passes raw features to the fusion model.

---

## P1 — Make the model actually good

### P1-1 · Implement `classifier.py`
- The feature-only MLP described in `model_design.md`.
- Standalone training script `src/train_classifier.py` that uses the
  same 70/15/15 split.
- Save to `models/saved/classifier_best.pth`.
- This is also the model that runs at inference under degraded pose
  quality (heavy occlusion).
- **Done when:** the classifier alone gives ≥ 0.70 macro-F1 on the
  held-out test split.

### P1-2 · Data augmentation in `data_processor.py`
- Add a `training_augment(sequence)` function with:
  - random temporal re-sample (jitter ±10 %),
  - horizontal flip (swap L/R joints — list of pairs lives in
    `config/settings.py`),
  - additive Gaussian joint noise (σ=0.01),
  - small random rotation around vertical (±10°).
- Apply only inside the `Dataset.__getitem__` when `train=True`.
- **Done when:** test-set fall-recall improves by ≥ 2 points compared
  to the no-augmentation baseline.

### P1-3 · Replace last-frame padding with temporal interpolation
- In `enforce_temporal_uniformity`, when input has `< TARGET_FRAMES`,
  re-sample evenly with `np.linspace` index lookup.
- Same change at inference for the live buffer warm-up.

### P1-4 · Two robustness experiments
- **Cross-dataset:** train on NTU only, test on UR only. Report the
  drop (this is the credible "does the model generalise" number).
- **Subject-disjoint NTU split:** NTU encodes subject in the filename
  (`PXXX`). Hold out a subset of subjects entirely from training —
  this avoids the "same person, different action" leakage that
  flatters random splits.

### P1-5 · Implement `context_engine.py`
- `RoomZoneCalibrator` — collects 60 s of stationary clusters and
  walk paths, fits 2D Gaussians, labels the dominant cluster as bed
  and the second as chair. Persist to `data/calibration.json`.
- `PostureClassifier` — rule-based on torso angle + knee-hip drop:
  `lying / sitting / standing / walking`. Five-state finite state
  machine.
- `TransitionDetector` — emits events `sit_to_stand`, `stand_to_sit`,
  `sudden_drop` based on posture transitions and vertical velocity.

### P1-6 · Implement `postprocess.py` (risk-level state machine)
- See `risk_levels.md` for the exact thresholds and hysteresis.
- Inputs: fusion `P(fall)`, posture, transition events, pose-quality
  state.
- Outputs: `risk_level ∈ {NORMAL, MODERATE, HIGH, UNAVAILABLE}`,
  smoothed risk score (EMA), top-3 contributing features.

### P1-7 · Implement the live inference loop `src/inference.py`
- Open USB camera with OpenCV.
- Run MediaPipe Pose at 30 FPS.
- Maintain a 90-frame ring buffer of unified 14-joint skeletons.
- Every 6 frames: ST-GCN forward + features + fusion → smoothed
  risk score → risk level.
- Emit a `Snapshot` dataclass into an asyncio queue for the API.

### P1-8 · Implement `api/server.py`
- FastAPI app, two endpoints:
  - `GET  /api/status` — last snapshot + room calibration summary.
  - `WS   /ws/live` — server-pushed JSON snapshots at 5 Hz.
- One alert endpoint:
  - `POST /api/alerts/{event_id}/ack` — caregiver acknowledgement.
- Static replay endpoint:
  - `GET /api/replay/{event_id}` — returns skeleton-only JSON of the
    5 s window around the event.
- See `api_contract.md` for the exact payload shape.

### P1-9 · Event recording (`src/events.py`)
- Maintain a 5 s pre-event ring buffer of skeletons.
- When risk-level enters `HIGH`, freeze that buffer + capture 5 s of
  post-event skeleton; write to `data/events/<timestamp>.json`.
- No frames, no images — *skeleton-only* (this is the privacy story).

---

## P2 — Polish, evaluation, deployment

### P2-1 · Latency & energy benchmark
- Script `src/bench.py` that times 200 forward passes on the actual
  laptop CPU; report median + p95 latency.

### P2-2 · ONNX export + quantisation
- Export ST-GCN to ONNX, run with `onnxruntime` (CPU).
- Optional: post-training int8 quantisation with `torch.quantization`
  if CPU headroom is too tight.

### P2-3 · Unit tests
- `tests/test_features.py` — feed a synthetic standing skeleton +
  synthetic fall skeleton, assert F1/F8/F9 move in the expected
  direction.
- `tests/test_data_processor.py` — round-trip
  normalise → augment → verify shape/mean.
- `tests/test_parse_ntu.py` — parse one known `.skeleton` file
  shipped under `tests/fixtures/`.

### P2-4 · Reproducibility
- Pin seeds in `train.py`, `train_classifier.py`, `evaluate.py`.
- Pin requirements (see audit A10).

### P2-5 · Writeup
- Produce one figure per model (ST-GCN, classifier, fusion):
  confusion matrix, PR curve, calibration plot.
- One table comparing the three on macro-F1, fall-recall@95%-precision,
  latency.

---

## Suggested order of execution

1. **Day 1.** P0-1, P0-2 (joint layout + UR parsing). Verify with a
   sanity print that UR sequences have varied joint positions.
2. **Day 2.** P0-3, P0-4, P0-5 (training fixes + test split +
   scaler). Retrain ST-GCN + fusion. This is the moment the model
   starts being trustworthy.
3. **Day 3.** P1-1 (classifier), P1-2 (augmentation), P1-3
   (interpolation). Retrain everything. Run P1-4 cross-dataset
   experiment.
4. **Day 4.** P1-5 (context engine), P1-6 (postprocess + risk levels).
5. **Day 5.** P1-7 (live loop) + P1-8 (API) + P1-9 (events).
6. **Day 6.** P2 polish + figures + writeup.

If the goal is purely "have a working evaluation number for the
report", you can stop after Day 3. P1-5..P1-9 are needed for the live
demo and the mobile/dashboard integration.

---

## Acceptance targets to aim at (rough, not promises)

These are realistic targets given the dataset sizes:

| Metric | Target |
|---|---|
| Random-split macro-F1 (fusion) | ≥ 0.92 |
| Random-split fall recall  | ≥ 0.93 |
| Random-split fall precision | ≥ 0.88 |
| Cross-dataset NTU→UR fall recall | ≥ 0.80 |
| Subject-disjoint NTU macro-F1 | ≥ 0.85 |
| CPU inference latency (window) | ≤ 50 ms median |

If you hit ~0.80 macro-F1 today (best guess given the audit issues),
P0-1 through P0-5 alone should pull you well past 0.90 on a random
split.
