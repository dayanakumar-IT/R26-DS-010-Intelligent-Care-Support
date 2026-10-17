# Deployment (Edge Laptop)

## Hardware target

- HP Victus 15 (or similar) with at least:
  - Intel i5/i7 12th-gen or AMD Ryzen 5/7 5000-series.
  - 16 GB RAM.
  - USB-A 3.0 port for the camera.
- One USB camera (e.g. Hikvision DS-U02), mounted at 6–7 ft, angled
  down to cover the bed + walking area.

## OS

Tested on Windows 11. Linux works too; the only Windows-specific
detail is the camera index (`cv2.VideoCapture(0, cv2.CAP_DSHOW)`).

## Install

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -U pip
pip install -r requirements.txt
```

## One-time data ingestion (only needed for retraining)

```powershell
python main.py
```

Produces `data/processed/*.npy` from the source datasets.

## One-time training

```powershell
python -m src.train                     # ST-GCN + fusion
python -m src.train_classifier          # feature-only head
python -m src.evaluate                  # writes models/saved/eval_report.md
```

## Live run (the actual deployment command)

```powershell
uvicorn api.server:app --host 0.0.0.0 --port 8000
```

This launches:

- The MediaPipe loop on the USB camera.
- The model inference pipeline at 5 Hz.
- The FastAPI app at `http://<laptop-ip>:8000`.

The React dashboard connects to that IP from another machine on the
same LAN; the Flutter mobile app does the same.

## Calibration (first time in a new room)

From the dashboard, click **Calibrate** (or `POST /api/calibration/start`)
and let the patient move around the room for ~60 s. The system writes
`data/calibration.json` and starts using the zones immediately.

## Audio alert

When `risk_level == HIGH` for ≥ 0.5 s, the backend plays a short tone
through the laptop's default audio device (use `simpleaudio` or
`playsound`). This is the in-room alert.

## Mobile notifications

For the prototype, push notifications go via Firebase Cloud Messaging
**only if** the laptop has internet. Without internet, the mobile app
polls `/api/events` over LAN every 2 s — that is good enough for the
prototype.

## What persists on disk

```
backend/
├── data/
│   ├── processed/             # training arrays
│   ├── events/                # one JSON per fall event (skeleton only)
│   └── calibration.json
├── models/
│   └── saved/                 # *.pth, *.joblib, *.pt, eval_report.md
└── logs/
    └── server.log
```

Everything stays on the device. The only network traffic is between
the laptop ⇄ dashboard and laptop ⇄ phones, all on the local network.
