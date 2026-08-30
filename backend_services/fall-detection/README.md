# Edge-Enabled Fall Risk Detection — Backend

Real-time fall risk detection using ST-GCN + Late Fusion on USB webcam skeleton data.

## Quick Start

```bash
# 1. Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # Linux/Mac

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment (optional — Supabase sync)
cp .env.example .env
# Edit .env with your SUPABASE_URL and SUPABASE_KEY

# 4. Start the server
python main.py
```

API docs available at: http://localhost:8000/docs

---

## Project Structure

```
backend/
├── api/
│   └── server.py          # FastAPI + WebSocket server
├── config/
│   └── settings.py        # All configuration parameters
├── src/
│   ├── models/
│   │   ├── stgcn.py       # ST-GCN architecture
│   │   ├── fusion.py      # Late fusion network
│   │   └── classifier.py  # Feature-based classifier
│   ├── inference.py       # Live camera inference pipeline
│   ├── postprocess.py     # EMA smoothing + risk state machine
│   ├── context_engine.py  # Posture + room zone classification
│   ├── database.py        # SQLite database layer
│   ├── features.py        # 18 kinematic feature extraction
│   ├── data_processor.py  # Normalisation + temporal resampling
│   └── supabase_sync.py   # Cloud sync to shared Supabase
├── models/saved/          # Trained model weights (.pth files)
├── data/                  # Processed datasets and SQLite DB
├── scripts/               # Utility scripts (data prep, recording)
├── docs/                  # Architecture and API documentation
├── main.py                # Server entry point
├── live_test.py           # Live terminal test (camera → risk score)
├── record_clip.py         # Webcam recording for Model C fine-tuning
└── requirements.txt
```

---

## Models

| Model | File | Accuracy | Description |
|-------|------|----------|-------------|
| Model A | stgcn_best.pth + fusion_best.pth | 98.3% | Trained on NTU RGB+D + UR Fall |
| Model C | stgcn_best_webcam.pth + fusion_best_webcam.pth | 91.4% | Fine-tuned on in-house webcam data |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Server health check |
| GET | /api/patients | List all patients |
| GET | /api/patients/{id}/history | Patient risk history |
| GET | /api/alerts | Get alerts (filter by unacknowledged) |
| PATCH | /api/alerts/{id}/acknowledge | Acknowledge alert |
| GET | /api/events/{alert_id}/replay | Get 5-second skeleton replay |
| GET | /api/dashboard/summary | Dashboard overview metrics |
| WS | /ws/live/{room_id} | Real-time skeleton + risk score stream |

---

## Live Test

Stand in front of the camera and see real-time risk scores in the terminal:

```bash
python live_test.py --suffix _webcam --camera 0
```

---

## Record New Training Clips (Model C fine-tuning)

```bash
python record_clip.py --subject 3 --label fall --camera 0
python record_clip.py --subject 3 --label normal --camera 0
```

Then retrain:

```bash
python -m src.extract_webcam_mediapipe
python -m src.parse_webcam
python -m src.finetune_webcam --random_split
```
