# SENTRY Backend Reference
> Verified directly from source code. No assumptions. Use this when building the mobile app or integrating with other components.

---

## 1. Server

- **Framework:** FastAPI
- **Port:** 8000
- **Start command:** `python main.py` (from `Component2_v2/backend/`)
- **Auto API docs:** `http://localhost:8000/docs`
- **CORS:** Open to all origins (`allow_origins=["*"]`)

---

## 2. REST Endpoints

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/api/health` | `{ status, timestamp }` |
| GET | `/api/dashboard/summary` | `{ total_patients, total_alerts, unacknowledged_alerts, high_alerts_today, patients_by_level }` |
| GET | `/api/rooms` | List of rooms |
| GET | `/api/patients` | List of patients |
| GET | `/api/patients/{patient_id}` | Single patient |
| GET | `/api/patients/{patient_id}/history` | Risk event history (default limit 100) |
| GET | `/api/alerts?unacked_only=false&limit=100` | All alerts |
| PATCH | `/api/alerts/{alert_id}/acknowledge` | Body: `{ "ack_by": "caregiver" }` |
| GET | `/api/rooms/{room_id}/zones` | Zone polygon config for a room |
| PUT | `/api/rooms/{room_id}/zones` | Body: `{ "zones": { "BED": [[x,y],...], "CHAIR": [...], "WALKING": [...] } }` |
| POST | `/api/rooms/{room_id}/camera` | Body: `{ "source": "0", "suffix": "", "patient_id": "P001" }` |
| GET | `/api/caregivers` | List of caregivers |
| POST | `/api/caregivers` | Body: `{ "id", "name", "role", "phone", "email" }` |
| PATCH | `/api/rooms/{room_id}/caregiver` | Query param: `caregiver_id` |
| POST | `/api/patients` | Body: `{ "id", "name", "age", "gender", "room_id", "bed", "notes" }` |
| GET | `/api/events/{alert_id}/replay` | 5-second skeleton replay for an alert |
| POST | `/api/analyse` | Upload video file for offline analysis |

---

## 3. WebSocket Endpoints

### `/ws/live/{room_id}` — Live risk stream per room (dashboard)
Connect once per room. Backend pushes messages continuously.

**Message schema (pushed from server):**
```json
{
  "patient_id":    "P001",
  "room_id":       "ROOM_01",
  "timestamp":     "2026-08-05T10:30:45.123Z",
  "skeleton":      [[x,y,z,v], ...],
  "risk_score":    82,
  "risk_level":    "HIGH",
  "posture":       "STANDING",
  "zone":          "BED",
  "zone_modifier": 0.10,
  "pose_quality":  "GOOD",
  "confidence":    0.92,
  "key_factors":   ["body sway", "forward body tilt"],
  "stgcn_score":   0.79,
  "feat_score":    0.61,
  "alert":         true,
  "alert_id":      42
}
```

- `risk_score` is **0–100** (scaled for UI)
- `risk_level` is one of: `"NORMAL"`, `"MODERATE"`, `"HIGH"`
- `skeleton` is 14 joints, each `[x, y, z, visibility]`
- `key_factors` is a list of human-readable strings (top contributing biomechanical features)

### `/ws/alerts` — Alert-only stream (mobile app)
Connect once. Receives alerts from ALL rooms when MODERATE or HIGH fires.

**Message schema:**
```json
{
  "type":         "ALERT",
  "risk_level":   "HIGH",
  "risk_score":   85,
  "patient_id":   "P001",
  "patient_name": "Patient 01",
  "room_id":      "ROOM_01",
  "posture":      "LYING",
  "key_factors":  ["body sway", "low hip height"],
  "alert_id":     42,
  "timestamp":    "2026-08-05T10:30:45.123Z"
}
```

---

## 4. Database

### Local (SQLite)
- **File path:** `Component2_v2/backend/data/fallrisk.db`
- **Auto-created** on first server start — no setup needed
- **Tables:** `patients`, `rooms`, `caregivers`, `events`, `alerts`, `skeleton_replay`

### Cloud (Supabase) — Optional
- Syncs automatically if env vars are set
- Fails silently if not configured (local SQLite keeps working)
- **Required env vars** in `Component2_v2/backend/.env`:
  ```
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_KEY=your-service-role-key
  ```
- **SQL to run once** in Supabase SQL Editor: `Component2_v2/backend/scripts/create_supabase_tables.sql`
- **Supabase tables created:** `patients`, `fall_alerts`, `fall_events`
- Each record tagged: `component = "fall_risk_detection"`

---

## 5. Demo Seed Data (auto-inserted on first run)

**Rooms:**
| ID | Name | Ward |
|----|------|------|
| ROOM_01 | Ward A - Room 1 | Ward A |
| ROOM_02 | Ward A - Room 2 | Ward A |
| ROOM_03 | Ward B - Room 1 | Ward B |

**Patients:**
| ID | Name | Age | Gender | Room |
|----|------|-----|--------|------|
| P001 | Patient 01 | 72 | M | ROOM_01 |
| P002 | Patient 02 | 68 | F | ROOM_02 |
| P003 | Patient 03 | 80 | M | ROOM_03 |

**Caregivers:**
| ID | Name | Role |
|----|------|------|
| C001 | Nurse Sarah | Nurse |
| C002 | Nurse James | Nurse |
| C003 | Dr. Perera | Doctor |

> Camera sources are NOT seeded. Supervisor must configure via `POST /api/rooms/{room_id}/camera`.

---

## 6. Risk Levels & Thresholds

| Level | Meaning |
|-------|---------|
| NORMAL | No concern |
| MODERATE | Elevated — monitor |
| HIGH | Alert fired |

- **General model threshold:** θ = 0.94
- **Webcam fine-tuned threshold:** θ = 0.32
- **EMA smoothing alpha:** 0.4
- **Dwell to MODERATE:** 1.5 seconds sustained
- **Dwell to HIGH:** 0.5 seconds sustained
- **Alert cooldown:** 30 seconds

---

## 7. Model Details (for integration awareness)

- **Input:** 90-frame sliding window, 14 joints, 4 channels (x, y, z, visibility)
- **ST-GCN:** 3 blocks, channel progression 32→64→128, 128-dim output embedding
- **Biomechanical features:** 18 handcrafted features per window
- **Fusion:** 128-dim ST-GCN embedding + 18 raw features = 146-dim → 2-layer MLP
- **Inference rate:** Every 3 frames (≈10 inferences/sec at 30 FPS)
- **Latency:** 6.22ms per window (CPU-only)
- **Privacy:** Raw video frames are NEVER stored — only skeletal coordinates

---

## 8. File Structure (backend)

```
Component2_v2/backend/
├── main.py                        # Entry point — starts FastAPI server
├── api/
│   └── server.py                  # All REST + WebSocket endpoints
├── src/
│   ├── inference.py               # InferenceEngine (loads models, runs pipeline)
│   ├── postprocess.py             # RiskPostProcessor (EMA, dwell, cooldown)
│   ├── context_engine.py          # Zone-aware context + posture classification
│   ├── database.py                # SQLite CRUD (no connection string needed)
│   ├── supabase_sync.py           # Optional Supabase push
│   ├── features.py                # 18 biomechanical feature extraction
│   ├── data_processor.py          # MediaPipe preprocessing pipeline
│   └── models/
│       ├── stgcn.py               # ST-GCN model definition
│       ├── fusion.py              # Late fusion network
│       └── classifier.py         # Biomechanical feature MLP classifier
├── config/
│   └── settings.py                # All constants (thresholds, paths, hyperparams)
├── models/saved/
│   ├── stgcn_best.pt              # Trained ST-GCN weights
│   ├── fusion_best.pt             # Trained fusion network weights
│   ├── feature_scaler.pkl         # sklearn scaler for 18 features
│   ├── threshold.json             # { "fusion_threshold": 0.94 }
│   └── threshold_webcam.json      # { "fusion_threshold": 0.32 }
├── data/
│   └── fallrisk.db                # SQLite DB (auto-created on first run)
└── scripts/
    └── create_supabase_tables.sql # Run once in Supabase SQL editor
```

---

## 9. What the Mobile App Needs to Do

1. Connect to `ws://[server-ip]:8000/ws/alerts` for push alerts from all rooms
2. Call `GET /api/alerts?unacked_only=true` to load unacknowledged alerts on open
3. Call `PATCH /api/alerts/{alert_id}/acknowledge` when caregiver dismisses alert
4. Call `GET /api/dashboard/summary` for overview counts
5. Call `GET /api/patients` and `GET /api/rooms` for listing
6. Server IP = the IP of the machine running SENTRY backend on the same WiFi network

---

*All values in this document verified from source code. Last checked: August 2026.*
