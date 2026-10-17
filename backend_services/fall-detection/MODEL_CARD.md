# SENTRY Model Card
**Edge-Enabled Skeletal Movement Analysis System for Real-Time Patient-Observable Fall Risk Detection and Prediction**
Authors: IT22057488 (Harishalinee Elangovan) et al. — SLIIT Final Year Project, 2024/25

---

## Model Overview

| Property | Value |
|---|---|
| Task | Binary fall-risk classification (NORMAL / FALL) |
| Modality | 14-joint 2-D skeleton sequences extracted via MediaPipe Pose |
| Architecture | Late-Fusion: SkeletalSTGCN + hand-crafted biomechanical features |
| Inference device | CPU (edge) or CUDA when available |
| MediaPipe version | `>=0.10,<0.11` (landmark indices change across major versions) |

---

## Architecture

### SkeletalSTGCN
Three ST-GCN blocks with channel progression 4 → 32 → 64 → 128.  
Symmetrically normalised adjacency matrix over 14 joints.  
Temporal kernel size: 9.  
Output: 128-D graph embedding.

### Hand-crafted Features (F1–F18)
18 biomechanical signals computed from the same skeleton buffer.  
Notable: F17 is the skeleton bounding-box height ratio (field name `min_hip_height_ratio` is a legacy misnomer, retained for backwards-compat with saved scalers).

### LateFusionNetwork
`LayerNorm(128) ∥ 18 features → Linear(146→64) → BN → ReLU → Dropout(0.3) → Linear(64→2)`

### RiskPostProcessor
- Exponential Moving Average: α = 0.25  
- Thresholds: τ_low = 0.55, τ_high = 0.72  
- Alert cooldown: 20 s  
- SITTING cap: when posture = SITTING and level = HIGH, forced down to MODERATE (alert suppressed)

---

## Training Data

| Dataset | Sequences | Notes |
|---|---|---|
| NTU RGB+D (subset) | 3,777 | Standard fall / ADL benchmark |
| UR Fall Detection | 70 | Laboratory falls |
| Webcam (in-situ) | 93 | Collected with SENTRY USB webcam |
| **Total** | **3,847** | |

Subject-disjoint split: AUC **0.9836** (Fusion model).  
Webcam fine-tuned AUC: **0.8527**.

---

## Decision Threshold

`threshold_webcam.json` → **0.32** (webcam deployment).  
Lowered from 0.50 to improve recall on in-situ data; increases false-positive rate on non-fall activities.

---

## Known Failure Modes

| ID | Condition | Expected behaviour |
|---|---|---|
| V1 | Loose or bulky clothing obscuring joints | DEGRADED pose quality; inference suppressed |
| V2 | Partial occlusion (bed rails, chairs) | Underestimated fall probability |
| V3 | Camera angle > 45° from sagittal plane | Hip and ankle features unreliable |
| V4 | Multiple persons in frame | Joints from closest detected person only |
| V5 | Seated patient performing rapid upper-body movement | May briefly trigger MODERATE |
| V6 | No person in frame | UNAVAILABLE state; no inference run |

---

## Limitations

- Trained exclusively on skeleton data — no RGB appearance features.
- Prototype threshold (0.32) is dataset-specific; clinical deployment requires re-calibration.
- FastAPI backend is hardcoded to `localhost:8000` — not suitable for multi-node deployment without configuration changes.
- Alert cooldown (20 s) may suppress a second event in rapid-succession falls.
- SITTING cap is heuristic-based; does not use a dedicated posture classifier.

---

## Artifact Checksums
Checksums are logged to stdout at startup by `InferencePipeline.load_models()`.  
Compare against known-good hashes in your deployment record to detect silent corruption.

| Artifact | File |
|---|---|
| ST-GCN weights | `models/saved/stgcn_best_webcam.pth` |
| Fusion weights | `models/saved/fusion_best_webcam.pth` |
| Classifier weights | `models/saved/classifier_best_webcam.pth` |
| Feature scaler | `models/saved/scaler_webcam.pkl` |
| Decision threshold | `models/saved/threshold_webcam.json` |

---

## Intended Use
Assistive fall-risk monitoring for clinical and care-home settings.  
**Not** a substitute for clinical judgement or direct patient observation.  
Alerts should be treated as a prompt for caregiver assessment, not autonomous action.
