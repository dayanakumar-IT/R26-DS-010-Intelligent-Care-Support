# SENTRY — Full Technical Source Document
**Edge-Enabled Skeletal Movement Analysis System for Real-Time Patient-Observable Fall Risk Detection and Prediction**

IT22057488 — Harishalinee Elangovan | SLIIT Final Year Project 2024/25
Component: SENTRY (Fall Risk Detection) within the CareSense Multi-Component System

---

## 1. RESEARCH PROBLEM AND MOTIVATION

### 1.1 The Clinical Problem
Hospital-acquired falls are one of the leading causes of preventable patient harm in healthcare settings. Falls in elderly, post-surgical, and neurologically impaired patients can result in fractures, head injuries, extended hospital stays, and increased mortality. Despite standard of care protocols, caregivers cannot maintain continuous visual observation of every patient simultaneously.

Existing solutions fall into two categories:
1. **Wearable sensors** (accelerometers, gyroscopes) — require patient compliance, device charging, and cause discomfort for vulnerable populations
2. **Passive environmental sensors** (PIR motion detectors, pressure mats) — binary outputs with no semantic understanding of posture or movement quality

Neither approach provides real-time understanding of fall *risk* (pre-fall detection) — they detect falls only after impact.

### 1.2 The Research Gap
No existing clinical prototype simultaneously achieves:
- **Privacy-preserving edge inference** (no raw video transmitted over network)
- **Skeleton-based spatiotemporal fall risk assessment** (not just motion detection)
- **Posture-aware false alarm reduction** (contextual suppression without sacrificing sensitivity)
- **Zone-context awareness** (room-geometry-informed risk)
- **Real-time caregiver notification** (web + mobile alert delivery)

SENTRY addresses this gap.

### 1.3 Research Questions
1. Can a Late Fusion of ST-GCN graph embeddings and handcrafted biomechanical features outperform either component alone for fall risk detection?
2. Can posture-aware post-processing reduce false HIGH alerts without suppressing genuine fall events?
3. Is edge-only inference feasible on commodity hardware at clinically relevant latency?

---

## 2. LITERATURE REVIEW

### 2.1 Fall Detection Approaches

| Approach | Examples | Limitation |
|---|---|---|
| Wearable accelerometer | FallWatch, Apple Watch Fall | Requires patient compliance |
| Floor pressure mat | Tekscan, XSENSOR | No pre-fall risk signal |
| PIR + radar | Tunstall, Fall Call | Binary — no posture context |
| Depth camera (RGB-D) | Microsoft Kinect systems | Discontinued hardware, expensive |
| Optical flow CNN | VGG-based action recognition | High false alarm rate |
| Pose estimation only | OpenPose threshold systems | No temporal modelling |
| LSTM on skeleton | Action recognition literature | Joints treated independently |
| ST-GCN (Yan et al. 2018) | NTU RGB+D benchmarks | Cloud-based, no clinical integration |

### 2.2 Key Prior Works

**Yan et al. (2018) — Spatial Temporal Graph Convolutional Networks for Skeleton-Based Action Recognition**
- Introduced ST-GCN: treat skeleton as a graph where nodes = joints, edges = bones
- Applied to NTU RGB+D action recognition, not specifically fall detection
- SENTRY adapts ST-GCN for fall risk, with a 14-joint webcam-adapted subset and Late Fusion

**Li et al. (2019) — Actional-Structural Graph Convolutional Networks**
- Extended ST-GCN with learned edge weights
- SENTRY uses fixed anatomical edges — simpler, more interpretable for clinical context

**Núñez et al. (2021) — Vision-based fall detection on edge devices**
- Demonstrated MediaPipe Pose on Raspberry Pi for fall detection
- Single-threshold approach, no temporal modelling, no alert system
- SENTRY extends this with ST-GCN, Late Fusion, and a full clinical alert pipeline

**Zhang et al. (2020) — Fall detection using pose estimation and LSTM**
- Joint-by-joint LSTM — treats each joint independently
- SENTRY's graph convolution captures inter-joint dependencies, which LSTM cannot

### 2.3 Research Novelty (What SENTRY Adds)
1. **Late Fusion architecture**: ST-GCN graph embedding + 18 handcrafted biomechanical features — no prior work combines these two streams for clinical fall risk
2. **Posture-aware post-processor**: SITTING cap + zone modifiers — not present in any prior fall detection system
3. **Zone calibration via passive K-Means observation**: automatic room geometry learning without manual annotation
4. **Full edge-to-caregiver pipeline**: inference → WebSocket → web dashboard + Flutter mobile app in one integrated system

---

## 3. DATASETS

### 3.1 Training Data Summary

| Dataset | Sequences Used | Type | Source |
|---|---|---|---|
| NTU RGB+D 60 | 3,777 | Skeleton-based action recognition (includes falls) | Academic public |
| UR Fall Detection | 70 | Fall simulation, RGB + accelerometer | Academic public |
| Webcam-collected | 93 | USB RGB webcam, SENTRY lab setup | Self-collected |
| **Total** | **3,847** | | |

### 3.2 NTU RGB+D 60
- 60 action classes, 56,880 clips total
- SENTRY uses classes relevant to fall risk: fall forward, fall backward, fall sideways, sitting down, standing up, walking, lying down
- 3,777 sequences extracted for SENTRY after class filtering
- 25 body joints in original; SENTRY maps to 14 joints (webcam-compatible subset)

### 3.3 UR Fall Detection Dataset
- 70 sequences: 30 falls + 40 activities of daily living
- Collected using Microsoft Kinect — depth skeleton available
- Provides additional real fall event diversity beyond NTU studio falls

### 3.4 Self-Collected Webcam Data
- 93 clips collected with USB RGB webcam at 30fps
- Scenarios: normal walking, sitting/standing transitions, simulated near-falls, lying down
- Collected from N subjects in a controlled lab environment
- Used exclusively for domain adaptation fine-tuning (not added to base training set)

### 3.5 Data Split Strategy
- Base training (NTU + UR): subject-disjoint 80/20 train/test split
  - No subject appears in both train and test sets
  - AUC = 0.9836 reported on the held-out test set
- Webcam fine-tuning: separate 80/20 split of 93 clips
  - AUC = 0.8527 reported on webcam held-out clips
  - Threshold 0.32 selected by maximising F1 on webcam validation split

### 3.6 Class Imbalance
NTU RGB+D contains more ADL (activities of daily living) sequences than fall sequences. Mitigation: weighted cross-entropy loss during training, with fall class weighted proportionally higher than ADL classes.

---

## 4. METHODOLOGY

### 4.1 System Pipeline Overview

```
Step 1: Video capture
  USB RGB Webcam (30fps, CAMERA_SRC_OVERRIDE in .env)

Step 2: Pose estimation
  MediaPipe Pose (>=0.10,<0.11 pinned)
  → 33 landmarks detected
  → 14 joints selected (SENTRY_JOINTS mapping)
  → Output: (14, 4) array — [x, y, z, visibility] per joint per frame

Step 3: Buffer management
  Rolling buffer of 30 frames (1 second at 30fps)
  Inference runs every INFER_EVERY_N=3 frames (~10 times/second)

Step 4: Pose quality check
  VIS_THRESH = 0.3 — visibility threshold per joint
  GOOD_JOINT_FRAC, DEGRADED_JOINT_FRAC thresholds
  States: GOOD / DEGRADED / UNAVAILABLE
  If UNAVAILABLE → skip inference, emit warning

Step 5: Feature extraction (parallel)
  Path A: ST-GCN on buffer → 128-D embedding
  Path B: 18 handcrafted biomechanical features → 18-D vector

Step 6: Late Fusion
  LayerNorm(128) applied to ST-GCN embedding
  Concatenate: 128 + 18 = 146-D vector
  Linear(146→64) → BatchNorm → ReLU → Dropout(0.3) → Linear(64→2)
  Softmax → P(FALL) score [0.0, 1.0]

Step 7: Post-processing
  EMA smoothing (α=0.25)
  Dual-gate thresholds (τ_low=0.55, τ_high=0.72)
  Sustained counter (25 readings)
  SITTING cap
  Alert cooldown (20s)

Step 8: Context engine
  Posture classification: STANDING/SITTING/LYING/WALKING/TRANSITION/UNKNOWN
  Zone detection: which room zone is the patient in?
  Zone modifiers computed (display only, not applied to score)

Step 9: Output
  WebSocket push to web dashboard and mobile app
  Supabase write (alert + event records)
  Cloudflare R2 write (skeleton replay frames)
  Audio beep (winsound) on HIGH alert
```

### 4.2 Joint Selection (14 Joints from MediaPipe 33)

| SENTRY Index | MediaPipe Landmark | Body Part |
|---|---|---|
| 0 | 11 | Left Shoulder |
| 1 | 12 | Right Shoulder |
| 2 | 13 | Left Elbow |
| 3 | 14 | Right Elbow |
| 4 | 15 | Left Wrist |
| 5 | 16 | Right Wrist |
| 6 | 23 | Left Hip |
| 7 | 24 | Right Hip |
| 8 | 25 | Left Knee |
| 9 | 26 | Right Knee |
| 10 | 27 | Left Ankle |
| 11 | 28 | Right Ankle |
| 12 | 0 | Nose |
| 13 | 7/8 | Ear (left, used as head proxy) |

Rationale: These 14 joints encode upper body posture (shoulders, elbows, wrists), lower body stability (hips, knees, ankles), and head position — sufficient for fall biomechanics while reducing input dimensionality.

---

## 5. ML MODEL ARCHITECTURE

### 5.1 SkeletalSTGCN

**Architecture:**
```
Input: (batch, 4, T, 14)  — 4 channels (x,y,z,vis), T frames, 14 joints
  ↓
STGCNBlock 1: in_channels=4,  out_channels=32, temporal_kernel=9
STGCNBlock 2: in_channels=32, out_channels=64, temporal_kernel=9
STGCNBlock 3: in_channels=64, out_channels=128, temporal_kernel=9
  ↓
Global Average Pooling over time and joints
  ↓
Output: (batch, 128)  — graph embedding
```

**Each STGCNBlock contains:**
- Graph convolution: A_norm × X × W (spatial)
- 1D temporal convolution: kernel_size=9 (temporal)
- BatchNorm + ReLU
- Residual connection (1×1 conv if channels change)

**Adjacency matrix:**
- Fixed anatomical skeleton connectivity
- Symmetric normalisation: A_norm = D^(-1/2) A D^(-1/2)
- Prevents high-degree nodes (hips) from dominating

### 5.2 18 Handcrafted Biomechanical Features (F1-F18)

| ID | Feature | Description | Fall Relevance |
|---|---|---|---|
| F1 | COM horizontal velocity | Speed of body centre of mass horizontally | Sudden forward/backward surge |
| F2 | COM vertical velocity | Speed of body centre of mass downward | Dropping toward floor |
| F3 | Torso lean angle | Angle of shoulder-hip line from vertical | Exceeding safe lean range |
| F4 | Hip height (normalised) | Hip midpoint height / frame height | Absolute downward displacement |
| F5 | Knee bend angle | Left and right knee flexion | Sudden knee collapse |
| F6 | Knee-hip height ratio | Knee height relative to hip height | Knees rising above hips (collapse) |
| F7 | Shoulder-hip alignment | Horizontal offset of shoulders from hips | Lateral topple |
| F8 | Ankle dorsiflexion proxy | Ankle height relative to knee height | Trip/stumble |
| F9 | Head height (normalised) | Nose landmark height / frame height | Head approaching floor |
| F10 | Wrist height (left) | Left wrist height / frame height | Protective arm extension |
| F11 | Wrist acceleration | Rate of change of wrist height | Fast arm extension reflex |
| F12 | Body aspect ratio | Height span / width span of skeleton | Person elongating or compressing |
| F13 | Left-right symmetry | Difference in left/right joint positions | Asymmetric collapse |
| F14 | Spine curvature proxy | Shoulder-hip-knee angle | Forward hunch or backward lean |
| F15 | Step width | Ankle lateral separation | Stance instability |
| F16 | Movement jitter | Joint position variance across frames | Tremor or unsteady gait |
| F17 | Skeleton bounding-box height ratio | (top_joint_y - bottom_joint_y) / frame_height | Person shrinking = falling (note: field named min_hip_height_ratio in code — legacy misnomer) |
| F18 | Velocity direction change | Dot product of consecutive velocity vectors | Abrupt direction reversal |

All 18 features are normalised by StandardScaler (scaler_webcam.pkl) before fusion.

### 5.3 LateFusionNetwork

```
Input: ST-GCN embedding (128-D) + F1-F18 (18-D)

LayerNorm(128) applied to embedding
Concatenate → 146-D vector
Linear(146 → 64)
BatchNorm(64)
ReLU
Dropout(0.3)
Linear(64 → 2)
Softmax → [P(NORMAL), P(FALL)]
```

Output: P(FALL) is the raw fall risk score, range [0.0, 1.0].

### 5.4 Saved Model Artifacts

| Artifact | File | Format |
|---|---|---|
| ST-GCN weights | models/saved/stgcn_best_webcam.pth | PyTorch state_dict |
| Fusion weights | models/saved/fusion_best_webcam.pth | PyTorch state_dict |
| Classifier weights | models/saved/classifier_best_webcam.pth | PyTorch state_dict |
| Feature scaler | models/saved/scaler_webcam.pkl | scikit-learn StandardScaler |
| Decision threshold | models/saved/threshold_webcam.json | JSON: {"threshold": 0.32} |

MD5 checksums logged to terminal on every backend startup (added Phase 4).

### 5.5 Training Configuration

| Parameter | Value |
|---|---|
| Optimiser | Adam |
| Learning rate | 1e-3 (with scheduler) |
| Batch size | 32 |
| Epochs | 50 (early stopping on val AUC) |
| Loss | Weighted cross-entropy |
| Framework | PyTorch |
| MediaPipe version | >=0.10,<0.11 (pinned) |

### 5.6 Performance Results

| Metric | Value | Condition |
|---|---|---|
| AUC | 0.9836 | Subject-disjoint test (NTU + UR) |
| AUC | 0.8527 | Webcam fine-tuned, webcam test clips |
| Decision threshold | 0.32 | Maximises F1 on webcam validation split |
| CLASS_NAMES | ["NORMAL", "FALL"] | Index 0 = NORMAL, Index 1 = FALL |

---

## 6. POST-PROCESSOR (RiskPostProcessor)

### 6.1 EMA Smoothing
```python
score_ema = α × raw_score + (1-α) × score_ema_prev
```
- α = 0.25
- Prevents single-frame spikes from triggering alerts
- Decays quickly after high-score burst (~8 frames to return to near-zero)

### 6.2 Risk Level State Machine

```
NORMAL    ←→    MODERATE    ←→    HIGH
        score       score
        > τ_low     > τ_high
        (0.55)      (0.72)
```

Dual-gate condition for HIGH: both EMA score AND raw score must exceed τ_high simultaneously.

### 6.3 Sustained Counter
- HIGH level requires 25 consecutive readings without dropping below τ_high
- At 10 inferences/second: ~2.5 seconds of sustained HIGH before alert fires
- Counter resets if score drops below τ_high at any point

### 6.4 SITTING Cap
```python
if posture == "SITTING" and state.level == "HIGH":
    state.level = "MODERATE"
    state.alert = False
```
- Only fires on exact string match "SITTING"
- During TRANSITION, LYING, STANDING, WALKING — cap never applies
- Prevents false HIGHs from rapid upper-body movements while seated
- Proven by TestSittingTransitionSafety (3 automated tests)

### 6.5 Alert Cooldown
- ALERT_COOLDOWN_S = 20.0 seconds
- After one HIGH alert fires, no new alert within 20 seconds
- Prevents alert flooding on sustained HIGH

### 6.6 Full State Object (RiskState)
```python
@dataclass
class RiskState:
    level: str          # "NORMAL" / "MODERATE" / "HIGH"
    score: float        # EMA-smoothed score
    raw_score: float    # Raw model output
    alert: bool         # True = fire alert now
    moderate_alert: bool
    timestamp: float    # time.time()
```

---

## 7. CONTEXT ENGINE

### 7.1 Posture Classification
The context engine classifies posture from joint positions each frame:

| Posture | Detection Logic |
|---|---|
| LYING | Hip height < 20% of frame height AND torso nearly horizontal |
| SITTING | Hip height 20-45% AND knee angle > threshold (knees elevated) |
| STANDING | Hip height > 45% AND body aspect ratio > 1.5 |
| WALKING | STANDING + significant COM horizontal velocity |
| TRANSITION | Hip height changing rapidly between SITTING and STANDING thresholds |
| UNKNOWN | Pose quality DEGRADED or conditions ambiguous |

### 7.2 Zone Classification
Room zones: BED / CHAIR / WALKING_SPACE

Zone detection uses ConvexHull polygons stored in `config/zones_auto.json` (after calibration) or manually configured in Supabase.

Zone modifiers (computed but NOT applied to score — display only):
- BED zone + LYING: +0.05 modifier
- CHAIR zone + TRANSITION: +0.15 modifier
- BED zone + TRANSITION: +0.12 modifier
- WALKING zone: 0.00 modifier

### 7.3 Why Zone Modifiers Are Not Applied to Score
Zone modifiers were found to introduce false HIGHs when patients stand normally near calibrated zones (e.g., standing next to a bed triggers the BED zone modifier even when not at risk). Decision: display zone context for caregiver situational awareness only. Documented in MODEL_CARD.md.

---

## 8. BACKEND IMPLEMENTATION

### 8.1 Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Python 3.11 |
| Web framework | FastAPI |
| ASGI server | Uvicorn |
| ML framework | PyTorch |
| Pose estimation | MediaPipe Pose >=0.10,<0.11 |
| Database client | Supabase Python SDK |
| Object storage | Cloudflare R2 (via boto3) |
| Real-time | FastAPI WebSocket |
| Video streaming | MJPEG (StreamingResponse) |
| Zone calibration | scikit-learn KMeans + scipy ConvexHull |
| Audio alert | winsound (Windows) |

### 8.2 API Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| GET | / | No | Root, shows system info |
| GET | /api/health | No | Health check, returns status + version |
| GET | /docs | No | FastAPI Swagger UI |
| GET | /api/system/status | Yes | Live inference state |
| GET | /api/rooms | Yes | All rooms |
| GET | /api/rooms/{room_id} | Yes | Single room |
| PATCH | /api/rooms/{room_id}/caregiver | Yes | Assign caregiver to room |
| POST | /api/rooms/{room_id}/start | Yes | Start inference for room |
| POST | /api/rooms/{room_id}/stop | Yes | Stop inference |
| POST | /api/rooms/{room_id}/calibrate | Yes | Trigger zone calibration |
| GET | /api/patients | Yes | All patients |
| GET | /api/patients/{id} | Yes | Single patient |
| GET | /api/patients/{id}/history | Yes | Patient event history |
| GET | /api/alerts | Yes | Alert history (filterable) |
| POST | /api/alerts/{id}/acknowledge | Yes | Acknowledge alert |
| DELETE | /api/alerts/clear-demo | Yes | Wipe all alerts (requires ?confirm=yes) |
| GET | /api/events/{id}/replay | Yes | Skeleton replay frames |
| GET | /api/dashboard/summary | Yes | Dashboard summary stats |
| GET | /api/caregivers | Yes | Caregiver list (read from PULSE) |
| GET | /video/{room_id} | Key via ?token= | MJPEG video stream |
| WS | /ws/alerts | No | WebSocket alert push |

### 8.3 Authentication
- All endpoints (except /api/health, /, /docs, /video via query param) require `X-API-Key` header
- Key set via `SENTRY_API_KEY` in `.env`
- If `SENTRY_API_KEY` is blank, all endpoints are open (safe for closed local network demo)
- Video stream uses `?token=<key>` query param (browsers cannot send headers in `<img>` tags)

### 8.4 InferenceEngine Class (src/inference.py)

Key methods:
```python
class InferenceEngine:
    def load_models(self)       # Loads .pth files, logs MD5 checksums
    def _md5(path)              # Static helper: compute MD5 of model file
    def _pose_quality(buffer)   # GOOD / DEGRADED / UNAVAILABLE
    def _extract_features(buffer) # Returns (skeleton_tensor, feature_vector_18)
    def run(room_id)            # Main inference loop — camera → model → postprocessor
    def _reconnect_camera()     # Camera reconnect loop (30 consecutive failures)
```

### 8.5 Database Schema (Supabase)

Key tables:

| Table | Key Columns | Used By |
|---|---|---|
| rooms | id, room_code, ward, camera_src, caregiver_id | SENTRY reads + writes |
| patients | id, patient_code, gender, room_id, age | SENTRY reads |
| alerts | id, patient_id, room_id, risk_level, risk_score, acknowledged, timestamp, key_factors, r2_replay_key | SENTRY writes |
| events | id, alert_id, skeleton_frames (JSONB), timestamp | SENTRY writes |
| caregiver_profiles | id, name, email, assigned_room | PULSE writes, SENTRY reads |
| room_zones | room_id, zone_type, polygon_points | SENTRY reads/writes |

### 8.6 Cloudflare R2 Object Storage
- Bucket: caresense-fall-models
- On HIGH alert: skeleton frames for preceding 5 seconds stored as JSON blob
- R2 key stored in alerts.r2_replay_key column
- Replay endpoint fetches the blob and returns frame list to mobile app

### 8.7 Environment Variables (.env)

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key-here
SENTRY_API_KEY=                    # blank = no auth required
CAMERA_SRC_OVERRIDE=               # 0 or 1 to override camera index
TELEGRAM_BOT_TOKEN=                # optional
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=caresense-fall-models
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
```

### 8.8 Running the Backend

```bash
cd backend_services/fall-detection
# Activate venv
venv/Scripts/activate          # Windows
# Start server
uvicorn api.server:app --host 0.0.0.0 --port 8000 --reload
```

Live at: http://localhost:8000
API docs: http://localhost:8000/docs

---

## 9. ZONE CALIBRATION (Innovative Feature)

### 9.1 How It Works
File: `backend_services/fall-detection/src/zone_calibration.py`

1. Watch camera for 60-90 seconds (configurable via `--duration`)
2. Every frame: record hip midpoint (x, y) from MediaPipe
3. After observation window: run K-Means (k=3) on recorded positions
4. Sort clusters by Y-position (height in frame):
   - Lowest Y (highest in room) → WALKING_SPACE
   - Middle Y → CHAIR
   - Highest Y (lowest in room) → BED
5. Compute ConvexHull polygon per cluster (scipy)
6. Save normalised polygons to `config/zones_auto.json`

### 9.2 Running Zone Calibration
```bash
python -m src.zone_calibration --duration 75 --camera 0
```
Output: `config/zones_auto.json`

### 9.3 Fallback
If scipy not installed: bounding box (min/max of cluster points) used instead of ConvexHull. scipy added to requirements.txt as `scipy>=1.12`.

### 9.4 API Trigger
```
POST /api/rooms/{room_id}/calibrate
```
Runs `run_calibration_background()` as FastAPI background task.

---

## 10. FRONTEND IMPLEMENTATION

### 10.1 Web Dashboard

| Technology | Version |
|---|---|
| React | 18 |
| TypeScript | 5 |
| Tailwind CSS | 3 |
| Recharts | 2 (risk score charts) |
| WebSocket | Native browser API |
| HTTP client | Axios / fetch |

**Key Files:**
- `frontend/src/modules/fall-detection/pages/Overview.tsx` — main monitoring page
- Components: LiveFrame, AlertHistory, ZoneConfig, ConfigPanel

**Overview.tsx Features:**
- Live skeleton canvas: 14-joint skeleton rendered on 2D canvas
- Instability heatmap: joints coloured amber based on FEATURE_JOINTS table (hotJoints())
- DEGRADED banner: shown when pose_quality === 'DEGRADED' or posture === 'UNKNOWN'
- Risk score trend chart: last N seconds of EMA score
- Top Contributing Risk Factors: renamed from "Analytics"
- Alert history with CSV export (filtered list, shows count)
- Zone risk modifiers panel (display only)
- Backend health ping: polls /api/health every 15 seconds, shows status indicator

**Role Access on Web:**
- **Supervisor**: full access — assign caregivers to rooms, view all rooms
- **Caregiver**: sees their assigned room only, alerts, patient history

### 10.2 Flutter Mobile App (CareSense Mobile)

| Technology | Version |
|---|---|
| Flutter | 3 |
| Dart | 3 |
| State management | Riverpod (ConsumerStatefulWidget) |
| HTTP | Dio |
| WebSocket | dart:io WebSocket |

**Key Screens:**
- `sentry_home_screen.dart` — home with live alert summary, pull-to-refresh
- `rooms_screen.dart` — shows assigned rooms ("ASSIGNED" label)
- `event_replay_screen.dart` — skeleton animation replay of saved fall events
- `profile_screen.dart` — caregiver profile, sound toggle

**Key Services:**
- `sound_service_web.dart` — plays audio alert (HIGH/MODERATE), respects soundEnabled toggle
- `sound_service_stub.dart` — stub for non-web platforms
- WebSocket listener: receives {level, score, posture, zone, alert} frames from backend

**Navigation:**
- `SentryNav.tabNotifier` — static ValueNotifier for programmatic tab switching
- "View All" on home screen navigates to alerts tab

**Mobile Role:**
- Caregiver sees: assigned room, live alerts, patient list, event replay
- Supervisor can also use mobile but primary management is via web

---

## 11. TESTING

### 11.1 Test Suite Summary

| File | Tests | Focus |
|---|---|---|
| tests/test_postprocessor.py | 14 | RiskPostProcessor logic |
| tests/test_api.py | 17 | All REST API endpoints |
| tests/test_edge_cases.py | 15 | Edge cases and QA scenarios |
| **Total** | **46** | **All passing** |

Run all:
```bash
cd backend_services/fall-detection
venv/Scripts/python.exe -m pytest tests/ -v
```

### 11.2 test_postprocessor.py — 14 Tests

Key test classes:

**TestEMASmoothing**: Verifies EMA formula, α=0.25 behaviour, initialisation to 0.0

**TestRiskLevels**: Verifies state machine — NORMAL→MODERATE→HIGH transitions at correct thresholds

**TestAlertCooldown**: Verifies 20-second cooldown prevents duplicate alerts

**TestSittingCap**: Verifies HIGH is capped to MODERATE when posture == "SITTING"

**TestSittingTransitionSafety** (Phase 8 — Innovative Feature):
1. `test_transition_posture_does_not_suppress_alert` — TRANSITION posture does NOT trigger cap
2. `test_sitting_posture_caps_at_moderate` — SITTING posture DOES cap HIGH → MODERATE
3. `test_full_sequence_sitting_then_transition_then_high` — Full sequence: SITTING (capped) → TRANSITION (alert allowed) → HIGH fires

### 11.3 test_api.py — 17 Tests

Covers: /api/health, /api/rooms, /api/patients, /api/alerts, /api/alerts/acknowledge, /api/alerts/clear-demo, /api/dashboard/summary, /api/system/status, /api/caregivers, PATCH caregiver assignment, 405 on wrong method

All DB calls are mocked — tests run without a real Supabase connection.

### 11.4 test_edge_cases.py — 15 Tests

| Class | Tests | Scenario |
|---|---|---|
| TestT04_MultiplePeopleInFrame | 2 | Single-person skeleton extraction, no multi_person field exposed |
| TestT06_ModelFileMissing | 2 | FileNotFoundError raised (not silenced), MODELS_DIR configurable |
| TestT07_DatabaseUnavailable | 3 | Alerts/dashboard/history return 200 with empty data on DB down |
| TestT11_ClearDemoEndpoint | 2 | GET → 405, DELETE → 200 |
| TestT13_BackendRestartEMAState | 2 | Fresh processor → NORMAL, single 1.0 score → not HIGH |
| TestT15_ReplayNonExistentAlert | 2 | 200 or 404, never 500; frames key present |
| TestS3_SecurityChecks | 2 | Traceback not leaked, system status reachable |

---

## 12. SECURITY AUDIT (Phase 9)

### 12.1 Gap 1 — Video Stream Unauthenticated
**Problem**: `/video/{room_id}` transmitted patient room video without auth. Browsers cannot send `X-API-Key` headers in `<img>` tags.

**Fix**: Added `?token=<key>` query parameter check. Backend validates token against SENTRY_API_KEY before streaming.

**Note**: The web dashboard does NOT use the video stream — it renders a skeleton overlay via WebSocket. Video stream is for optional external display only.

### 12.2 Gap 2 — Alert Records
No gap. Alert records exist in Supabase with all required fields.

### 12.3 Gap 3 — Real Supabase URL in .env.example
**Problem**: `.env.example` (the template file checked into git) contained the real Supabase project URL.

**Fix**: Replaced with `https://your-project.supabase.co` placeholder.

**Note**: The real `.env` file with credentials is in `.gitignore` — NOT changed.

### 12.4 Gap 4 — Hardcoded IP
**Not a gap for this prototype**. Backend runs on the same machine as the web browser. localhost:8000 is correct for this topology.

### 12.5 Gap 5 — clear-demo endpoint unguarded
**Problem**: `DELETE /api/alerts/clear-demo` could wipe all alerts with no confirmation.

**Fix**: Now requires `?confirm=yes` query parameter. Without it, returns 400 with error message.

---

## 13. INNOVATIVE FEATURES (Phase 8)

### 13.1 Passive Zone Calibration
- No manual room annotation required
- Caregiver points camera at the room and runs calibration for 60-90 seconds
- System observes where the patient naturally moves and clusters into BED/CHAIR/WALKING zones
- Outputs polygon zones as JSON — used by context engine for zone classification
- Technical: K-Means (k=3) on hip midpoint positions, ConvexHull per cluster via scipy

### 13.2 Sitting-Transition Safety Tests (Automated Proof)
- 3 automated tests in TestSittingTransitionSafety
- Prove mathematically that the SITTING cap cannot wrongly suppress fall alerts during sit-to-stand
- During TRANSITION: posture = "TRANSITION" → cap condition never true
- During SITTING→LYING collapse: posture changes before HIGH sustained counter finishes
- This is a research safety guarantee, not just a code comment

---

## 14. DEPLOYMENT GUIDE

### 14.1 Requirements
```
Python 3.11+
Node.js 18+ (for web frontend)
Flutter 3+ (for mobile)
USB webcam
Windows (winsound used for audio alerts)
```

### 14.2 Backend Setup
```bash
cd backend_services/fall-detection
python -m venv venv
venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with real Supabase + R2 credentials
uvicorn api.server:app --host 0.0.0.0 --port 8000
```

### 14.3 Web Frontend Setup
```bash
cd frontend
npm install
npm run dev          # development
npm run build        # production
```

### 14.4 Mobile Setup
```bash
cd caresense_mobile/frontend
flutter pub get
# Update lib/core/config/api_config.dart with backend IP
flutter run          # or flutter build apk
```

### 14.5 Git Branch Rules
- Web changes (backend, frontend): commit to `SENTRY-03` branch
- Mobile changes (`caresense_mobile/`): commit to `sentry-mobile` branch — NEVER to SENTRY-03

---

## 15. FUTURE WORK

| Priority | Item |
|---|---|
| High | HTTPS (TLS certificate for production deployment) |
| High | Clinical validation — real patients, real caregivers, ethics approval |
| High | Multi-room support — one backend, multiple camera streams |
| High | Regulatory review — medical device classification assessment |
| Medium | Offline queue — local write buffer when Supabase unavailable |
| Medium | RBAC — role-based access beyond single API key |
| Medium | Zone modifier activation — apply zone modifiers to score after threshold tuning |
| Medium | Webcam dataset expansion — 93 clips → 500+ for improved webcam AUC |
| Low | Mobile supervisor dashboard — room assignment from mobile |
| Low | Telegram/WhatsApp alert push — alternative to mobile WebSocket |
| Low | Cross-platform audio — replace winsound with cross-platform solution |

---

## 16. KEY NUMBERS QUICK REFERENCE

| Item | Value |
|---|---|
| Total training sequences | 3,847 |
| NTU RGB+D sequences | 3,777 |
| UR Fall sequences | 70 |
| Webcam sequences | 93 |
| Subject-disjoint AUC | 0.9836 |
| Webcam fine-tuned AUC | 0.8527 |
| Decision threshold | 0.32 |
| EMA alpha | 0.25 |
| τ_low | 0.55 |
| τ_high | 0.72 |
| Alert cooldown | 20 seconds |
| Sustained HIGH counter | 25 readings (~2.5 seconds) |
| Inference rate | ~10/second (INFER_EVERY_N=3 at 30fps) |
| Joints tracked | 14 |
| Biomechanical features | 18 (F1-F18) |
| ST-GCN output embedding | 128-D |
| Fusion input | 146-D (128 + 18) |
| Total automated tests | 46 (all passing) |
| VIS_THRESH | 0.3 |
| Temporal kernel | 9 frames |
| MediaPipe version | >=0.10,<0.11 |
| Backend port | 8000 |
| Backend framework | FastAPI + Uvicorn |
| Database | Supabase (PostgreSQL) |
| Object storage | Cloudflare R2 |
| Mobile framework | Flutter 3 / Dart 3 |
| Web framework | React 18 / TypeScript 5 |

---

*SENTRY Source Document — Complete Technical Reference | IT22057488 | SLIIT 2024/25*
