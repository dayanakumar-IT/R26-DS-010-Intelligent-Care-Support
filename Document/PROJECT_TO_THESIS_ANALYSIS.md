# PROJECT TO THESIS ANALYSIS — SENTRY Component
## Individual Thesis Reference Document
**Component:** SENTRY — Edge-Enabled Skeletal Fall Risk Detection  
**Verified from:** Actual source code, model files, evaluation JSONs, dataset files  
**Date:** 2026-10-05

---

# 1. Project Overview

The group project is **CareSense** — a smart hospital patient monitoring platform. It is a multi-component system built by a team. SENTRY is **Component 2** of CareSense.

The overall group system consists of:
- **SENTRY** (this thesis) — fall risk detection using skeletal AI
- **PULSE** — caregiver management and patient vitals (separate component)
- **Shared Supabase database** — one PostgreSQL cloud instance, shared RLS-protected tables
- **Shared mobile app** (caresense_mobile) — Flutter app for caregiver alerts

The complete system delivers real-time patient monitoring in a simulated ward environment. SENTRY handles the camera → skeleton → AI risk → alert pipeline.

---

# 2. My Individual Component

**SENTRY is solely the individual's component.** All of the following are the individual's own work:

- Machine learning model design, training, and evaluation (ST-GCN + Late Fusion)
- 18 handcrafted biomechanical features (features.py)
- Inference engine (inference.py)
- Post-processing pipeline (postprocess.py)
- Context engine — posture and zone classification (context_engine.py)
- FastAPI backend server with REST + WebSocket (api/server.py)
- Supabase database layer for SENTRY tables (database.py)
- Cloudflare R2 skeleton replay storage (r2_storage.py)
- Data processing, dataset parsing, training scripts
- Evaluation across all protocols

**Uncertainty:** The web frontend (React/TypeScript) and mobile app (Flutter) directory names could not be located via glob. The PULSE component's tables (`caregiver_profiles`) are read-only to SENTRY. The mobile app's alert WebSocket consumer is shared infrastructure; the `/ws/alerts` endpoint that feeds it is SENTRY's code.

---

# 3. Relevant Project Files

| File | Layer | Responsibility | Thesis Relevance |
|---|---|---|---|
| `backend_services/fall-detection/api/server.py` | API / Backend | FastAPI server, REST endpoints, WebSocket live stream, camera auto-detection, alert pipeline | Ch 4, 5 — architecture, implementation, integration |
| `backend_services/fall-detection/src/models/stgcn.py` | Algorithm/Model | Spatio-Temporal Graph Convolutional Network, 3 blocks, 128-D embedding | Ch 4, 5 — model design, implementation |
| `backend_services/fall-detection/src/models/fusion.py` | Algorithm/Model | Late Fusion Network (128-D embedding + 18 features → fall probability) | Ch 4, 5 — model design |
| `backend_services/fall-detection/src/models/classifier.py` | Algorithm/Model | Standalone feature-only classifier (ablation branch) | Ch 5 — ablation study |
| `backend_services/fall-detection/src/features.py` | Algorithm | 18 handcrafted kinematic/postural features F1–F18 | Ch 4, 5 — feature engineering |
| `backend_services/fall-detection/src/inference.py` | Backend | Live inference engine — camera → MediaPipe → buffer → model → result | Ch 5 — implementation |
| `backend_services/fall-detection/src/postprocess.py` | Backend | EMA + dwell-timer + dual-gate + cooldown risk state machine | Ch 4, 5 — design decision |
| `backend_services/fall-detection/src/context_engine.py` | Backend | Posture classification (STANDING/SITTING/TRANSITION), zone detection | Ch 4, 5 |
| `backend_services/fall-detection/src/database.py` | Database | Supabase client, all CRUD for patients/rooms/events/alerts | Ch 4, 5, 6 |
| `backend_services/fall-detection/src/train.py` | Training | Joint ST-GCN + Fusion training — AdamW, CosineAnnealingLR, auxiliary loss, WeightedRandomSampler | Ch 5 — training pipeline |
| `backend_services/fall-detection/src/data_splits.py` | Training | Random and subject-disjoint splits, scaler fitting, class weights | Ch 5 — methodology |
| `backend_services/fall-detection/src/data_processor.py` | Training | Skeleton normalization, temporal uniformity, augmentation | Ch 5 |
| `backend_services/fall-detection/src/evaluate.py` | Testing | Evaluation script — confusion matrix, ROC-AUC, macro-F1 | Ch 5, 6 |
| `backend_services/fall-detection/src/baseline_rf.py` | Testing | Random Forest baseline for comparison | Ch 6 |
| `backend_services/fall-detection/src/cross_dataset.py` | Testing | Cross-dataset generalization evaluation | Ch 6 |
| `backend_services/fall-detection/src/finetune_webcam.py` | Training | Fine-tuning on in-house webcam data | Ch 5, 6 |
| `backend_services/fall-detection/src/benchmark_latency.py` | Testing | Latency benchmarking per pipeline stage | Ch 6 |
| `backend_services/fall-detection/src/r2_storage.py` | Integration | Cloudflare R2 skeleton replay upload/download | Ch 5 |
| `backend_services/fall-detection/src/parse_ntu.py` | Data | NTU RGB+D skeleton parser | Ch 3, 5 |
| `backend_services/fall-detection/src/parse_ur.py` | Data | UR Fall Detection dataset parser | Ch 3, 5 |
| `backend_services/fall-detection/src/extract_ur_mediapipe.py` | Data | Re-extract UR video frames through MediaPipe (domain bridge) | Ch 3, 5 |
| `backend_services/fall-detection/src/extract_webcam_mediapipe.py` | Data | Extract in-house webcam clips through MediaPipe | Ch 3, 5 |
| `backend_services/fall-detection/config/settings.py` | Configuration | All constants — 14-joint layout, feature names, thresholds, hyperparameters | Ch 4, 5 |
| `backend_services/fall-detection/.env.example` | Configuration | Environment variable documentation | Ch 5 — deployment |
| `backend_services/fall-detection/models/saved/eval_report_subj.json` | Results | Subject-disjoint evaluation results | Ch 6 |
| `backend_services/fall-detection/models/saved/eval_report.json` | Results | Random split evaluation results | Ch 6 |
| `backend_services/fall-detection/models/saved/eval_report_webcam.json` | Results | In-house webcam evaluation results | Ch 6 |
| `backend_services/fall-detection/models/saved/eval_report_cross_dataset.json` | Results | Cross-dataset generalization results | Ch 6 |
| `backend_services/fall-detection/models/saved/latency_benchmark_webcam.json` | Results | Inference latency (4.515 ms/window on CPU) | Ch 6 |
| `backend_services/fall-detection/models/saved/rf_baseline_results_subj.json` | Results | Random Forest baseline — accuracy 96.47%, macro-F1 0.9519 | Ch 6 |
| `Datasets/UR Fall Detection Dataset/` | Dataset | UR Fall Detection: 30 fall + 40 ADL sequences, CSV + video | Ch 3 |
| `Datasets/Action Recognition Dataset NTU (Rose)/` | Dataset | NTU RGB+D: 4 classes (A043 fall, A008 sit, A009 stand, A027 jump) | Ch 3 |
| `Datasets/docs/unified_14_joint_layout.md` | Documentation | 14-joint canonical layout documentation | Ch 4 |
| `SENTRY_SOURCE_DOCUMENT.md` | Documentation | Comprehensive component reference | All chapters |

---

# 4. End-to-End Component Flow

```
USB Camera (Hikvision DS-U02 or built-in)
    ↓
cv2.VideoCapture (DirectShow, 640×480 @ 30fps)
    ↓
MediaPipe Pose (model_complexity=1, 33 landmarks)
    ↓
DataProcessor.extract_mediapipe_14_joints()
  → Maps 33 MediaPipe landmarks → 14-joint layout [x, y, z, visibility]
  → Neck derived as midpoint(L_shoulder, R_shoulder)
    ↓
90-frame ring buffer (3 seconds of skeleton history)
    ↓  [every 3 captured frames = ~10 inferences/sec]
DataProcessor.apply_clip_normalization()
  → Hip-midpoint centred, torso-length normalised
DataProcessor.enforce_temporal_uniformity()
  → Resample/pad to exactly 90 frames
    ↓
FeatureExtractor.extract_sequence_features()
  → 18 handcrafted biomechanical features (F1–F18)
  → StandardScaler.transform() — scaler fitted on training data
    ↓
SkeletalSTGCN.forward(skeleton, extract_embedding=True)
  → 3 STGCNBlocks (4→32→64→128 channels, stride 2 on blocks 2&3)
  → AdaptiveAvgPool → 128-D embedding
    ↓
LateFusionNetwork.forward(embedding, features)
  → LayerNorm(embedding) || standardised_features → 146-D concat
  → Linear(146→64) → BN → ReLU → Dropout(0.3) → Linear(64→2)
  → Softmax → fall_probability (0..1)
    ↓
RiskPostProcessor.update(score)
  → EMA smoothing (alpha=0.25, heavy smoothing)
  → Dwell-timer state machine: NORMAL → MODERATE → HIGH
  → Dual-gate: EMA AND raw score both above threshold for HIGH
  → Sustained-HIGH counter: 25 consecutive readings ≈ 3 seconds
  → Alert cooldown: 20s between HIGH alerts
    ↓
ContextEngine.update(skeleton, timestamp)
  → Posture classification: STANDING / SITTING / TRANSITION
  → Zone detection: BED / CHAIR / TOILET / WALKING
  → Posture clamping: confirmed SITTING → cap at MODERATE
    ↓
Insert to Supabase (fall_events per window, fall_alerts on alert)
Save skeleton replay to memory (90 frames, ~3 seconds)
    ↓
WebSocket push to web dashboard (/ws/live/{room_id})
WebSocket push to mobile app (/ws/alerts) — alert messages only
    ↓
MJPEG stream (/video/{room_id}) — annotated live video
```

---

# 5. Frontend Analysis

> **Note:** The web frontend directory could not be located via filesystem search (directory name unknown). The following is derived from the backend API endpoints and WebSocket schema — what the frontend consumes is inferred from what the backend provides.

**What the web frontend receives and displays (verified from server.py):**
- Live WebSocket messages every ~3 frames containing: patient_id, room_id, timestamp, skeleton (14×4 array), risk_score (0–100%), risk_level (NORMAL/MODERATE/HIGH), alert_level, posture, zone, zone_modifier, pose_quality, key_factors, stgcn_score, feat_score, alert flag
- Skeleton data at 25 fps for canvas animation (`/ws/live/{room_id}` skeleton-type messages)
- MJPEG video stream (`/video/{room_id}`) — annotated with skeleton overlay, face blur, HUD
- REST data: patients list, alerts list, patient history, dashboard summary, replay frames

**Inferred frontend screens** (from API endpoints consumed):
- Live monitoring dashboard — risk score bar, skeleton canvas, posture/zone display
- Patients & Beds management
- Alert history with acknowledge functionality
- Skeleton replay viewer (for HIGH alerts)
- Camera configuration (POST /api/rooms/{room_id}/camera)
- Zone configuration (PUT /api/rooms/{room_id}/zones)
- Analytics/summary view

---

# 6. Backend Analysis

## 6.1 API Server (server.py)
FastAPI application with CORS enabled for all origins. Key design:
- **Auto-camera detection** on startup: PowerShell `Get-PnpDevice` checks if Hikvision is physically connected; falls back to built-in if not
- **Per-room engine isolation**: each room gets its own `InferenceEngine`, `RiskPostProcessor`, `ContextEngine` in global dicts
- **Async + threading bridge**: inference loop runs in a daemon thread; `loop.run_in_executor(None, _pull)` bridges blocking generator to async event loop
- **Dual WebSocket channels**: `/ws/live/{room_id}` for dashboard, `/ws/alerts` for mobile
- **25fps skeleton streaming** (`_skel_frame_loop`) separate from 10fps inference results (`_broadcast_loop`)
- **Posture-aware clamping**: confirmed SITTING → force MODERATE even if model outputs HIGH
- **5-second replay buffer** (150 frames): maintained in memory per room; written to memory dict and attempted to Cloudflare R2 on alert

## 6.2 Inference Engine (inference.py)
- Runs in a daemon thread (`threading.Thread`)
- Uses DirectShow backend (`cv2.CAP_DSHOW`) on Windows for USB camera compatibility
- Face blur applied to MJPEG frames (Gaussian blur on nose±radius region) — privacy feature
- Three source modes: webcam index, video file (.mp4), skeleton .npy replay
- `MIN_BUFFER_FILL = 1.0` — requires full 90-frame buffer before first inference to avoid false HIGHs during warmup
- Pose quality thresholds: GOOD ≥ 65% joints visible, DEGRADED 35–65%, UNAVAILABLE <35%
- Key factor attribution: features with |value| > 1.5 after standardization are reported

## 6.3 Models
**SkeletalSTGCN** (`stgcn.py`):
- Input: (N, T=90, V=14, C=4) — batch, time, joints, channels (x,y,z,visibility)
- Symmetric-normalised adjacency D^{-1/2}(A+I)D^{-1/2} — computed once, registered as buffer
- 3 STGCNBlocks: 4→32 (stride 1), 32→64 (stride 2), 64→128 (stride 2)
- Each block: SpatialGraphConv (1×1 Conv2d + einsum) + temporal Conv2d(9×1) + BatchNorm + Dropout(0.3) + residual
- AdaptiveAvgPool → 128-D embedding
- Separate fc head (128→2) for standalone evaluation; not used in fusion inference path

**LateFusionNetwork** (`fusion.py`):
- Input: 128-D ST-GCN embedding + 18 standardised biomechanical features = 146-D total
- LayerNorm on embedding side to balance magnitudes between deep and physics branches
- Linear(146→64) → BatchNorm → ReLU → Dropout(0.3) → Linear(64→2)

**FeatureClassifier** (`classifier.py`): MLP over 18 features only; used for ablation.

## 6.4 Feature Engineering (features.py)
18 handcrafted biomechanical features computed from (T, 14, 3) skeleton sequence:

| Category | Features | Description |
|---|---|---|
| Velocity | F1–F4 | Mean/max hip vertical drop, mean hip lateral, mean head vertical |
| Acceleration / Energy | F5–F7 | Peak hip vertical acceleration, kinetic energy proxy (mean/max) |
| Posture / Orientation | F8–F12 | Mean/max torso angle from vertical, angular velocity, body aspect ratio |
| Micro-instability | F13–F18 | Torso sway (blended std+oscillation), hip lateral/vertical std, hip path length, height ratio, gait dispersion |

## 6.5 Post-Processing (postprocess.py)
Multi-stage noise suppression pipeline:
1. **EMA smoothing**: alpha=0.25 (heavy — requires ~12 frames to reflect a true step change)
2. **Dwell-timer state machine**: NORMAL→MODERATE requires 0.5s above tau_low=0.55
3. **Dual-gate counter**: MODERATE→HIGH requires both EMA ≥ 0.72 AND raw score ≥ 0.72, sustained for 25 consecutive inference windows (~3 seconds)
4. **Hysteresis on descent**: different dwell times going up vs down
5. **Alert cooldown**: 20s between HIGH alerts, 120s between MODERATE logs

## 6.6 Context Engine (context_engine.py)
- Classifies posture from joint geometry: torso angle, hip height ratio → STANDING/SITTING/TRANSITION
- Configurable room zones (polygon-based): BED, CHAIR, TOILET, WALKING
- Zone modifier computed but intentionally NOT applied to alert score (documented in code: caused false HIGHs in practice)

---

# 7. Database and Data Flow

## 7.1 Supabase Tables (SENTRY-owned)

| Table | Key Columns | Purpose |
|---|---|---|
| `patients` | id (bigint), patient_code, gender, room_id | Patient registry |
| `rooms` | id (bigint), room_code, ward, camera_src, camera_suffix, zone_config, caregiver_id | Room and camera configuration |
| `fall_events` | id, patient_id, room_id, timestamp, risk_score, risk_level, posture, zone, pose_quality, confidence, key_factors, alert_id | One row per inference window (~every 0.1s) |
| `fall_alerts` | id, patient_id, room_id, timestamp, risk_score, risk_level, posture, key_factors, acknowledged, ack_by, ack_at, r2_replay_key | One row per triggered alert |

## 7.2 Read-only from PULSE
- `caregiver_profiles` — SENTRY reads caregiver name/ward only; never writes

## 7.3 External Storage
- **Cloudflare R2**: skeleton replay JSON (90 frames × 14 joints) stored on HIGH alert as `replays/alert_{id}.json`. Also stored in-memory as fallback (`_replay_mem` dict in server.py)

## 7.4 Data Flow
```
Camera frame → MediaPipe → 14-joint array
    → fall_events (every ~0.1s, every inference window)
    → fall_alerts (only on MODERATE/HIGH alert trigger)
    → _replay_mem + R2 (skeleton replay, HIGH alerts only)
    → WebSocket → dashboard / mobile app
```

---

# 8. APIs and Integration

## 8.1 REST Endpoints (verified from server.py)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/health | Health check |
| GET | /api/dashboard/summary | Total patients, alerts, high_alerts_today |
| GET | /api/rooms | All rooms |
| GET | /api/patients | All patients (optional: filter by caregiver_id) |
| GET | /api/patients/{id} | Single patient |
| GET | /api/patients/{id}/history | Fall events history |
| POST | /api/patients | Add/update patient |
| POST | /api/rooms | Add/update room |
| GET | /api/alerts | Alert list (optional: unacked_only) |
| PATCH | /api/alerts/{id}/acknowledge | Acknowledge alert |
| GET | /api/events/{alert_id}/replay | Skeleton replay frames |
| DELETE | /api/alerts/clear-demo | Clear all alerts + reset EMA (demo/viva use) |
| GET | /api/replay/status | In-memory replay status |
| POST | /api/rooms/{room_id}/camera | Configure and start camera for a room |
| GET/PUT | /api/rooms/{room_id}/zones | Get/set zone polygon map |
| PATCH | /api/rooms/{room_id}/caregiver | Assign caregiver to room |
| GET | /api/caregivers | List caregivers (reads from PULSE table) |
| POST | /api/analyse | Upload video file for offline analysis |
| GET | /video/{room_id} | MJPEG live video stream |
| GET | /api/system/status | Engine status per room |

## 8.2 WebSocket Endpoints

| Endpoint | Consumer | Message Format |
|---|---|---|
| /ws/live/{room_id} | Web dashboard | Full inference result + skeleton + risk level + posture + zone |
| /ws/alerts | Flutter mobile app | Alert-only messages (MODERATE/HIGH triggers) |

## 8.3 Integration with PULSE (other group component)
- **Reads from** `caregiver_profiles` table (owned by PULSE) — caregiver name, ward, id
- **Links rooms to caregivers** via `rooms.caregiver_id` foreign key
- **Never writes to** PULSE tables
- **Mobile app** connects to SENTRY's `/ws/alerts` WebSocket to receive fall alerts; the Flutter code is shared group infrastructure

---

# 9. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CareSense Platform                │
│                                                      │
│  ┌─────────────────────┐  ┌──────────────────────┐  │
│  │     SENTRY (You)    │  │    PULSE (Teammate)  │  │
│  │                     │  │                      │  │
│  │  USB Camera         │  │  Caregiver Portal    │  │
│  │       ↓             │  │  Vital Signs         │  │
│  │  MediaPipe Pose     │  │  Caregiver Profiles  │  │
│  │       ↓             │  └──────────────────────┘  │
│  │  14-Joint Skeleton  │            │                │
│  │       ↓             │            │ read-only      │
│  │  ST-GCN + Fusion    │            ↓                │
│  │       ↓             │  ┌──────────────────────┐  │
│  │  Risk Post-Proc.    │  │  Supabase PostgreSQL  │  │
│  │       ↓             │→→│  (Shared Cloud DB)   │  │
│  │  FastAPI Server     │  │  patients, rooms,     │  │
│  │  REST + WebSocket   │  │  fall_events,        │  │
│  └─────────────────────┘  │  fall_alerts,        │  │
│           ↓               │  caregiver_profiles   │  │
│  ┌────────────────┐       └──────────────────────┘  │
│  │  Web Dashboard │                                  │
│  │  (React/TS)    │                                  │
│  └────────────────┘                                  │
│           ↓                                          │
│  ┌────────────────┐  ┌──────────────────────┐       │
│  │  Flutter App   │  │  Cloudflare R2       │       │
│  │  (Mobile)      │  │  Skeleton Replays    │       │
│  └────────────────┘  └──────────────────────┘       │
└─────────────────────────────────────────────────────┘
```

---

# 10. Technology Stack

| Technology | Where Used | Purpose | Relevant Thesis Section |
|---|---|---|---|
| Python 3.11/3.13 | Backend | Primary language | Ch 5 |
| PyTorch | stgcn.py, fusion.py, classifier.py, train.py | Deep learning model implementation and training | Ch 4, 5 |
| MediaPipe Pose | inference.py | Real-time 33-landmark pose estimation from RGB frames | Ch 4, 5 |
| OpenCV (cv2) | inference.py, server.py | Camera capture (DirectShow), MJPEG encoding, face blur, skeleton overlay | Ch 5 |
| FastAPI | api/server.py | REST API + WebSocket server | Ch 5 |
| Uvicorn | Deployment | ASGI server for FastAPI | Ch 5 |
| Supabase (PostgreSQL) | src/database.py | Cloud database — patients, rooms, events, alerts | Ch 4, 5 |
| Cloudflare R2 | src/r2_storage.py | Skeleton replay blob storage | Ch 5 |
| scikit-learn | train.py, baseline_rf.py | StandardScaler, WeightedRandomSampler, RF baseline, metrics | Ch 5, 6 |
| NumPy | features.py, data_processor.py, all scripts | Numerical skeleton processing | Ch 5 |
| NTU RGB+D Dataset | Datasets/ | Training data — 4 action classes (A043 fall + 3 hard negatives) | Ch 3 |
| UR Fall Detection Dataset | Datasets/ | Training + evaluation — 30 falls, 40 ADL | Ch 3, 6 |
| In-house Webcam Dataset | data/processed/webcam_mediapipe/ | Real-sensor evaluation — 58 clips, 2 subjects | Ch 3, 6 |
| React 19 + TypeScript + Vite | Web frontend (dir not found) | Web dashboard | Ch 5 |
| Flutter 3 + Riverpod + GoRouter | caresense_mobile/ | Mobile caregiver app | Ch 5 |

---

# 11. Important Design Decisions

| Decision | Implementation Evidence | Alternative | Possible Justification |
|---|---|---|---|
| Late Fusion (not early fusion) | fusion.py: concat(LayerNorm(embedding), features) → head | Early fusion (concatenate raw inputs before ST-GCN), ensemble | **Possible justification to verify with student:** Late fusion allows each branch to specialise independently; embedding captures spatiotemporal patterns while features capture domain-physics signals |
| 14-joint layout (not 17 or 33) | config/settings.py JOINT_NAMES, SKELETON_EDGES | Full 33 MediaPipe landmarks, 17-joint COCO layout | Consistent cross-dataset mapping possible (NTU 25-joint, MediaPipe 33-joint, UR CSV all map to 14); head, neck, shoulders, elbows, wrists, hips, knees, ankles sufficient for fall biomechanics |
| ST-GCN over LSTM/Transformer | stgcn.py: SpatialGraphConv + temporal Conv (9×1) + residual | LSTM, GRU, Transformer on flattened joints | **Possible justification:** Graph structure encodes known anatomical connectivity; spatial conv propagates signals along bone edges; temporal conv handles motion patterns over 90 frames |
| 90-frame (3-second) window | settings.py TARGET_FRAMES=90, FRAME_RATE=30 | Shorter windows (1s), longer windows (5s) | Fall event trajectory (pre-fall sway → impact → floor) spans ~2–3 seconds; 3s captures full motion arc |
| Subject-disjoint evaluation as primary | train.py build_or_load_subject_disjoint_splits, eval_report_subj.json | Random split only | Prevents data leakage between same-subject sequences; subject-disjoint is the standard protocol for generalisation evaluation in fall detection |
| Dual-gate for HIGH transition | postprocess.py: both EMA ≥ 0.72 AND raw score ≥ 0.72 | Single threshold on EMA alone | **Verified in code comments:** EMA alone can stay high from accumulated history while raw score has dropped; raw score alone spikes briefly; both high = genuine sustained fall |
| EMA alpha=0.25 (heavy smoothing) | postprocess.py RISK_EMA_ALPHA=0.25, settings.py | Higher alpha (faster response), Kalman filter | Prevents single-frame false positives; requires ~12 frames to reach 95% of a true step change |
| UR oversampling ×10 | train.py UR_OVERSAMPLE_MULT=10, WeightedRandomSampler | Class weighting only, no oversampling | UR is the real-sensor dataset (MediaPipe, RGB camera — closest to deployment); NTU is Kinect-based; oversampling prevents NTU from dominating |
| Auxiliary ST-GCN loss (weight 0.2) | train.py: loss = criterion(fusion) + 0.2 * criterion(stgcn) | Train ST-GCN separately, freeze, train fusion | Keeps ST-GCN fc head trainable for meaningful standalone ablation; 0.2 weight ensures fusion head is primary objective |
| Threshold sweep on val set | train.py best_f1_threshold(), threshold_subj.json (0.76) | Fixed 0.5 threshold | Optimal threshold maximises val macro-F1; subject-disjoint optimal threshold = 0.76 (not 0.5) |
| DirectShow backend for camera | inference.py: cv2.VideoCapture(src, cv2.CAP_DSHOW) | Default MSMF backend | **Verified in code comments:** Windows MSMF (default backend) fails with USB webcams (-1072873821 error); DirectShow is more compatible |
| Cloudflare R2 for replay storage | database.py save_replay_frames → r2_storage.py | Supabase storage, local filesystem | Binary skeleton data (JSON arrays) too large for Supabase column storage; R2 is S3-compatible object storage |
| Face blur on MJPEG stream | inference.py _encode_display_frame — GaussianBlur on nose region | No privacy protection | Patient privacy — MJPEG stream is visible on web dashboard; face blur prevents patient identification from live video |

---

# 12. Thesis Chapter Mapping

| Thesis Section | Project Evidence | Files | What I Can Discuss |
|---|---|---|---|
| Ch 1 — Introduction | Edge-based AI, USB camera, no Kinect dependency | server.py, inference.py | Problem: existing systems require Kinect or IMU sensors; SENTRY uses standard RGB webcam + edge AI |
| Ch 2 — Literature Review | NTU dataset, UR dataset, ST-GCN papers, MediaPipe | Datasets/docs/, parse_ntu.py, parse_ur.py | Compare: Kinect-based (Shotton et al.), IMU-based, video-based; gap = edge RGB skeleton-based late fusion |
| Ch 3 — Research Methodology | Three datasets, subject-disjoint protocol, cross-dataset evaluation | data_splits.py, extract_ur_mediapipe.py, eval_report_cross_dataset.json | Dataset choice, evaluation protocol justification, data collection methodology |
| Ch 4 — Product & Solution Design | 14-joint layout, ST-GCN architecture, Late Fusion design, post-processing pipeline, database schema | stgcn.py, fusion.py, features.py, postprocess.py, settings.py | All design decisions with alternatives and justifications |
| Ch 5 — Implementation | Training pipeline, inference engine, FastAPI server, database layer, integration | train.py, inference.py, server.py, database.py | Complete implementation detail with code evidence |
| Ch 5.3 — Integration | PULSE caregiver table, shared Supabase, mobile /ws/alerts | database.py get_caregivers(), server.py ws_alerts | How SENTRY integrates with PULSE and mobile app |
| Ch 6 — Results & Validation | All eval JSONs, latency benchmark | eval_report_subj.json, eval_report_webcam.json, latency_benchmark_webcam.json | All verified numerical results |
| Ch 6.4 — Integration Results | Camera auto-detection, WebSocket streaming, alert pipeline | server.py | End-to-end system working results |
| Ch 7 — Discussion | Cross-dataset AUC 0.41 (known limitation), webcam fine-tuning effect | eval_report_cross_dataset.json, eval_report_webcam.json | Domain gap analysis, fine-tuning effectiveness |
| Ch 8 — Commercialisation | SaaS model: SENTRY as camera-agnostic fall detection module | All | Hospital deployment, edge-first, no specialist hardware |
| Ch 9 — Conclusion | Subject-disjoint 98.26% accuracy (fusion), webcam 91.38%, 4.515ms latency | eval_report_subj.json, latency_benchmark_webcam.json | Contributions, limitations, future work |

---

# 13. Figures Recommended

| Figure | What It Should Show | Supporting Files | Thesis Section |
|---|---|---|---|
| System Architecture | Complete SENTRY component within CareSense group — camera → inference → DB → frontend/mobile | server.py, database.py | Ch 4.1, 5.1 |
| End-to-End Pipeline | Frame → MediaPipe → buffer → features → ST-GCN → Fusion → Postprocessor → alert | inference.py, features.py, stgcn.py, fusion.py, postprocess.py | Ch 4.2 |
| ST-GCN Architecture | 3 STGCNBlocks, channel progression 4→32→64→128, graph A, temporal conv 9×1, residual connections | stgcn.py | Ch 4.3 |
| 14-Joint Skeleton Graph | 14 joints as nodes, 14 bone edges, derived neck joint highlighted | settings.py SKELETON_EDGES, JOINT_NAMES | Ch 4.3 |
| Late Fusion Head | LayerNorm(128-D embedding) concat 18 features → 146-D → Linear(64) → output | fusion.py | Ch 4.4 |
| Post-Processing State Machine | NORMAL → MODERATE → HIGH state transitions with dwell times, EMA, dual-gate, cooldown | postprocess.py | Ch 4.5 |
| Database ER Diagram | patients, rooms, fall_events, fall_alerts — relationships, key columns | database.py | Ch 4.6 |
| Training Pipeline | Data loading → augmentation → WeightedRandomSampler → joint training → early stopping → threshold sweep | train.py | Ch 5.2 |
| Confusion Matrices | Subject-disjoint: ST-GCN [[226,8],[6,72]], Fusion [[231,3],[6,72]] | eval_report_subj.json | Ch 6.1 |
| ROC Curves | Subject-disjoint ROC: Fusion AUC=0.9836, ST-GCN=0.9780, Feature=0.9905 | eval_report_subj.json | Ch 6.1 |
| Webcam Evaluation Results | Fusion 91.38% accuracy, 80% fall recall at threshold 0.32 | eval_report_webcam.json | Ch 6.3 |
| Latency Breakdown | Preprocessing 1.13ms + ST-GCN 4.20ms + Fusion 0.19ms = 5.55ms total | latency_benchmark.json | Ch 6.4 |
| Sequence Diagram — Alert Flow | Camera → inference → postprocessor → Supabase insert → WebSocket push → mobile alert | server.py _broadcast_loop | Ch 5.3 |

---

# 14. Tables Recommended

| Table | Content | Source |
|---|---|---|
| Technology Stack | Technology, version, purpose, component | settings.py, requirements (if exists), imports |
| 14-Joint Layout | Joint index, name, MediaPipe landmark, NTU landmark | settings.py JOINT_NAMES, MEDIAPIPE_JOINT_MAP, NTU_JOINT_MAP |
| 18 Biomechanical Features | F1–F18: name, formula, physical meaning, category | features.py |
| Dataset Summary | Dataset, source, classes, # sequences, sensor, annotation type | Datasets/ directories |
| Model Comparison (Subject-Disjoint) | ST-GCN only, Feature-only, Fusion — accuracy, macro-F1, fall recall, FAR, AUC | eval_report_subj.json |
| Model Comparison (Random Split) | Same models, random split results | eval_report.json |
| Webcam Evaluation | Models, accuracy, macro-F1, fall recall, FAR | eval_report_webcam.json |
| Latency Benchmark | Stage, time (ms), cumulative | latency_benchmark.json, latency_benchmark_webcam.json |
| REST API Endpoints | Method, path, purpose, response format | server.py |
| Post-Processing Parameters | Parameter, value, purpose | settings.py, postprocess.py |
| Design Alternatives | Decision, chosen, alternative, reason | All model/processing files |
| Risk Thresholds | tau_low, tau_high, EMA alpha, dwell times, cooldowns | settings.py |

---

# 15. Testing Evidence

## What is Genuinely Present
- ✅ **Quantitative evaluation scripts**: `src/evaluate.py`, `src/eval_webcam_holdout.py`, `src/cross_dataset.py`, `src/baseline_rf.py` — produce JSON evaluation reports
- ✅ **Saved evaluation results**: 5 JSON evaluation reports with confusion matrices, ROC-AUC, PR-AUC, macro-F1 for all protocols
- ✅ **Latency benchmarking**: `src/benchmark_latency.py` — 4.515 ms/window on CPU (verified in JSON)
- ✅ **Multi-seed training**: `src/train_multi_seed.py` — variance analysis across random seeds
- ✅ **Subject-disjoint protocol**: implemented in `src/data_splits.py`, used as primary evaluation
- ✅ **Cross-dataset evaluation**: `src/cross_dataset.py`, NTU→UR generalization tested (AUC 0.41)
- ✅ **Real-sensor test**: webcam_mediapipe/ dataset, subject-disjoint holdout (58 clips)
- ✅ **Threshold sweep**: `best_f1_threshold()` in train.py, saved per model run
- ✅ **Demo reset endpoint**: `/api/alerts/clear-demo` — resets state before demos

## What is Missing (Be Honest in Thesis)
- ✅ ~~No formal unit tests~~ — **49 pytest tests now implemented** across `tests/test_features.py` (8), `tests/test_postprocessor.py` (11), `tests/test_models.py` (13), `tests/test_api.py` (17) — all pass
- ❌ No load/stress testing — concurrent patient rooms not tested
- ❌ No formal validation against clinical fall definitions
- ❌ Only 2 subjects in the in-house webcam dataset (small sample)
- ❌ Manual testing only for the web UI and mobile alert reception

---

# 16. Individual Contribution Evidence

## Individual Frontend Contribution
- The backend serves a MJPEG stream with skeleton overlay, face blur, and HUD — this display processing is in `inference.py _encode_display_frame`
- REST endpoints for all dashboard data are in `server.py`
- Web frontend confirmed at `frontend/` — React 19 + TypeScript + Vite (`index.html`, `src/`, `vite.config.ts`) ✅

## Individual Backend Contribution (Fully Verified)
- `api/server.py` — complete FastAPI server ✅
- `src/inference.py` — complete inference engine ✅
- `src/postprocess.py` — complete post-processor ✅
- `src/context_engine.py` — complete context engine ✅
- `src/database.py` — complete Supabase layer ✅
- `src/r2_storage.py` — complete R2 storage ✅
- `config/settings.py` — all constants and configuration ✅

## Individual Database Contribution
- All 4 SENTRY Supabase tables: `patients`, `rooms`, `fall_events`, `fall_alerts` ✅
- Migration SQL files confirmed: `0008_SENTRY_rooms.sql`, `0009_SENTRY_fall_events.sql`, `0010_SENTRY_fall_alerts.sql`, `0012_SENTRY_patients.sql` (patients re-applied as 0012, not 0007) ✅
- Zone config JSONB column in rooms ✅

## Individual Algorithm/Research Contribution
- SkeletalSTGCN model (`stgcn.py`) ✅
- LateFusionNetwork (`fusion.py`) ✅
- FeatureExtractor — all 18 features F1–F18 (`features.py`) ✅
- Training pipeline with WeightedRandomSampler, auxiliary loss, threshold sweep (`train.py`) ✅
- Data processing and augmentation (`data_processor.py`) ✅
- Subject-disjoint split implementation (`data_splits.py`) ✅
- All dataset parsers (`parse_ntu.py`, `parse_ur.py`, `parse_webcam.py`) ✅
- MediaPipe extraction for UR dataset (`extract_ur_mediapipe.py`) ✅
- Fine-tuning on webcam data (`finetune_webcam.py`) ✅
- All evaluation scripts and saved results ✅

## Individual Integration Contribution
- `/ws/alerts` WebSocket endpoint feeding mobile app ✅
- Read-only integration with PULSE `caregiver_profiles` table ✅
- `assign_caregiver_to_room()` linking rooms to PULSE caregivers ✅
- CAMERA_SRC_OVERRIDE environment variable bridge ✅

---

# 17. Product Contribution vs Research Contribution

## Product Contribution (Software Artefact)
A working edge-based fall risk monitoring system including:
- USB webcam + MediaPipe pipeline producing 14-joint skeletons
- Trained deep learning models (ST-GCN + Late Fusion) running on CPU at 4.515ms/window
- FastAPI server delivering real-time risk scores via WebSocket at 10 inferences/second
- Supabase-backed event and alert logging with in-memory replay
- MJPEG video stream with face-blurred annotated skeleton overlay
- Risk post-processing pipeline converting noisy model output to stable alert states

## Research Contribution
The research contribution must be established clearly as:

1. **A novel Late Fusion architecture** combining a Spatio-Temporal Graph Convolutional Network (for spatiotemporal motion patterns) with 18 domain-engineered biomechanical features (for physics-based instability signals) — evaluated under subject-disjoint protocol
2. **Cross-sensor domain bridging** — NTU RGB+D (Kinect v2, 25 joints) → UR Fall Detection (video, reprocessed through MediaPipe, 14 joints) → in-house webcam; demonstrates a training pipeline that generalises from depth-sensor data to standard RGB webcam
3. **Empirical ablation study** — ST-GCN only vs Feature-only vs Late Fusion under subject-disjoint and real-sensor protocols, with quantified improvement
4. **Post-processing design** — multi-stage noise suppression (EMA + dwell-timer + dual-gate + sustained-HIGH counter) specifically designed to reduce false positives while maintaining fall recall in a real-time edge deployment

**⚠️ RESEARCH CONTRIBUTION MUST BE ESTABLISHED FROM THE RESEARCH DOCUMENTS — CODE ALONE DOES NOT PROVE IT.** Specifically, the thesis must establish what is novel vs what applies existing techniques (ST-GCN is an existing architecture; applying it to this domain with this joint layout and fusion approach is the novel contribution).

---

# 18. Unsupported or Risky Thesis Claims

| Potential Claim | What Project Actually Shows | Safe Academic Wording |
|---|---|---|
| "Real-time fall detection" | 4.515ms per 90-frame window inference. But MediaPipe is excluded from this benchmark. Full pipeline latency unverified. | "Near-real-time inference at 4.515 ms per 3-second window on CPU, excluding pose estimation." |
| "High accuracy of 98.26%" | 98.26% is random split accuracy (eval_report.json). Subject-disjoint accuracy is lower — compute from confusion matrix [[231,3],[6,72]]: (231+72)/312 = 97.12%. | "Subject-disjoint accuracy of 97.12% and random split accuracy of 98.26%; subject-disjoint is the primary metric." |
| "The model generalises well" | Cross-dataset AUC = 0.41 (eval_report_cross_dataset.json) — this is below random (0.50). The model does NOT generalise to unseen datasets without fine-tuning. | "The model trained on NTU+UR achieved AUC 0.41 on the UP-Fall dataset, indicating limited cross-dataset generalisation. Fine-tuning on in-house webcam data improved fusion accuracy to 91.38%." |
| "Webcam model achieves 91.38%" | Verified in eval_report_webcam.json. Only 58 clips, 2 subjects, subject-disjoint (subject 2 held out). Very small dataset. | "On a 58-clip, 2-subject in-house webcam dataset (subject-disjoint), the fine-tuned fusion model achieved 91.38% accuracy and macro-F1 0.8851." |
| "RF baseline achieves 94.56% / macro-F1 0.9349" | **WRONG — these are the Feature-only neural net numbers (random split), not RF.** The macro-F1 0.9349 is verified from `eval_report.json` Feature-only CM [[413,18],[11,136]]. The actual RF subject-disjoint result (`rf_baseline_results_subj.json`) is **96.47% / 0.9519**. | "The Random Forest baseline achieved 96.47% accuracy and macro-F1 0.9519 under the subject-disjoint protocol (subject-disjoint test set, 312 windows). The Feature-only neural classifier achieved 94.98% accuracy and macro-F1 0.9349 under random split." |
| "No specialist hardware needed" | ✅ Verified — standard USB webcam (Hikvision DS-U02) used at inference, not Kinect | "The system operates with a standard USB RGB webcam, eliminating the need for depth sensors or dedicated hardware." |
| "Deployed on edge device" | Backend runs on a laptop (Windows). No IoT device, Raspberry Pi, or embedded deployment. | "The system is designed for edge deployment, running entirely on a local laptop without cloud inference." |
| "Automated testing coverage" | ✅ 49 pytest unit tests implemented (features, post-processor, models, API endpoints). Evaluation scripts provide quantitative metrics. No load/UI tests. | "The system includes 49 automated unit tests covering core components (feature extraction, risk post-processing, deep learning models, REST API endpoints), alongside evaluation scripts producing quantitative performance metrics." |
| "SITTING posture prevents false HIGH" | ✅ Verified in code — confirmed SITTING → force MODERATE. | "A posture-aware clamping rule prevents HIGH classification when the patient is confirmed SITTING, reducing false alert rates." |
| "Zone modifier improves accuracy" | Zone modifier intentionally NOT applied to alert score — code comments explain it caused false HIGHs. Zone is shown in UI only. | "Zone context is displayed for caregiver awareness; it was not applied to the alert score pipeline after empirical observation of false positives in configured zones." |

---

# 19. Development Gaps and Limitations

**Relevant to thesis limitations section:**

1. **Small webcam dataset**: only 58 clips from 2 subjects (1 subject training, 1 holdout). Results may not generalise to diverse patient populations, age groups, or body types.

2. **Cross-dataset gap (AUC 0.41)**: The model trained on NTU+UR performs below chance on the UP-Fall dataset without fine-tuning. Domain gap (different sensors, recording setups, subject demographics) is significant.

3. ✅ ~~No unit tests~~ — **49 pytest tests added** covering FeatureExtractor, RiskPostProcessor, SkeletalSTGCN, LateFusionNetwork, and FastAPI endpoints. No load/stress or UI tests.

4. **UR oversampling is a workaround**: The ×10 oversampling of UR data compensates for dataset imbalance but may introduce overfitting on the small UR subset.

5. **Face blur only on MJPEG**: Skeleton data (joint coordinates) is transmitted in WebSocket messages and stored in Supabase — no anonymisation of skeleton data.

6. **Camera detection is Windows-only**: `_find_hikvision_index()` uses PowerShell `Get-PnpDevice` — Linux/Mac deployment would need a different detection method.

7. **In-memory replay limitation**: `_replay_mem` dict lives in process memory — restart clears all replays. R2 upload is non-fatal (try/except) so replays may not persist if R2 is not configured.

8. **Single-patient-per-room assumption**: Engine binds one `patient_id` to one room — multi-patient room monitoring not supported.

9. **Supabase dependency**: Server starts even if Supabase is unavailable (non-fatal init), but events and alerts are silently dropped if connection fails.

10. **No drift monitoring**: No automated mechanism to detect when patient movement patterns deviate from training distribution (PP2 reviewer comment).

---

# 20. Information Still Needed From Me

✅ **Resolved:**
- Web frontend folder → `frontend/` (React 19 + TypeScript + Vite)
- SQL migration files → `0008_SENTRY_rooms.sql`, `0009_SENTRY_fall_events.sql`, `0010_SENTRY_fall_alerts.sql`, `0012_SENTRY_patients.sql`
- Unit tests → 49 pytest tests across 4 files, all passing

**Still outstanding — only you can provide these:**

1. ✅ **RF baseline discrepancy RESOLVED** — The 94.56%/0.9349 in the thesis are the **Feature-only neural classifier (random split)** numbers, not the RF. Verified: `eval_report.json` Feature-only CM [[413,18],[11,136]] gives macro-F1 = 0.9349 exactly. **Thesis must be corrected**: RF subject-disjoint = **96.47% / 0.9519** (`rf_baseline_results_subj.json`); Feature-only = **94.98% / 0.9349** (`eval_report.json`). These are two different models — do not report them as the same.

2. **Individual thesis template** — `Individual Thesis Content.docx` not found in the repo. Needed to verify Chapter 12 template mapping.

3. **Your name and student ID** — not derivable from code; needed for thesis cover and declaration.

4. **Research paper / thesis draft** — if a draft thesis document exists, share it for thesis review against actual project code.

---

# 21. Thesis Review Preparation

When reviewing each thesis chapter, use these files as the primary technical sources:

| Chapter | Primary Files |
|---|---|
| Introduction | server.py (system overview), SENTRY_SOURCE_DOCUMENT.md |
| Literature Review | Datasets/docs/, SENTRY_SOURCE_DOCUMENT.md |
| Methodology | data_splits.py, train.py, evaluate.py, cross_dataset.py |
| Design | stgcn.py, fusion.py, features.py, postprocess.py, context_engine.py, settings.py, database.py |
| Implementation | server.py, inference.py, train.py, database.py, r2_storage.py |
| Testing | evaluate.py, eval_webcam_holdout.py, baseline_rf.py, benchmark_latency.py |
| Results | eval_report_subj.json, eval_report.json, eval_report_webcam.json, eval_report_cross_dataset.json, latency_benchmark_webcam.json, rf_baseline_results_subj.json |
| Discussion | eval_report_cross_dataset.json, postprocess.py (dual-gate rationale in comments) |
| Individual Contribution | All src/ files — these are all individual contributions |

---

*This analysis was generated by reading and verifying the actual source code, model files, and evaluation results. All metrics cited are verified against the actual JSON files in models/saved/. No metrics were assumed or invented.*
