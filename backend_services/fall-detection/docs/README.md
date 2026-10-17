# Backend — Overview

The backend runs entirely on the edge laptop (one camera, one laptop per
room). It ingests live MediaPipe poses, scores fall risk continuously,
and serves the result over the local network to the React dashboard and
Flutter mobile app.

This `docs/` folder is the source of truth for what exists, what works,
what is broken, and what comes next. Read in this order:

1. [`architecture.md`](architecture.md) — modules, data flow, what each
   file is responsible for.
2. [`current_state.md`](current_state.md) — what is **already
   implemented** in this repo today, with file:line references.
3. [`audit_findings.md`](audit_findings.md) — concrete bugs / design
   mismatches found during the audit (read this before training again).
4. [`model_design.md`](model_design.md) — the hybrid ST-GCN + handcrafted
   + late-fusion design, why it is structured this way.
5. [`improvement_plan.md`](improvement_plan.md) — **how we get from the
   current half-trained models to a model you can defend in your
   evaluation.** Concrete, ordered, P0/P1/P2.
6. [`risk_levels.md`](risk_levels.md) — turning the binary classifier
   output into the three-tier Normal / Moderate / High-Risk score with
   hysteresis.
7. [`training_protocol.md`](training_protocol.md) — exact training recipe
   (splits, weighting, augmentation, metrics, early-stopping) that the
   final `train.py` must implement.
8. [`api_contract.md`](api_contract.md) — REST + WebSocket contract the
   dashboard and mobile app will consume.
9. [`deployment.md`](deployment.md) — running the backend on the HP
   Victus laptop, including the live MediaPipe + inference loop.
10. [`changelog.md`](changelog.md) — record of what changed in each
    refactor pass; **read this first** to see what is already done and
    what is still open.

## Tech stack

- Python 3.11, PyTorch (CPU-friendly), MediaPipe, FastAPI + Uvicorn,
  `websockets`, NumPy, scikit-learn, pandas.
- No cloud services. No internet at deploy time. All comms over LAN.

## Folder layout

```
backend/
├── api/
│   └── server.py            # FastAPI + WS app (empty today)
├── config/
│   └── settings.py          # paths, hyperparameters, joint map
├── data/
│   └── processed/           # .npy outputs from data ingestion
├── models/
│   └── saved/               # *.pth checkpoints
├── src/
│   ├── parse_ntu.py         # NTU zip → unified .npy
│   ├── parse_ur.py          # UR CSV → unified .npy  (currently broken — see audit)
│   ├── data_processor.py    # normalisation + temporal alignment
│   ├── features.py          # 18 hand-crafted physics features
│   ├── baseline_rf.py       # Random Forest baseline on features only
│   ├── context_engine.py    # posture / zone / transitions (empty today)
│   ├── models/
│   │   ├── stgcn.py         # Spatio-Temporal GCN
│   │   ├── classifier.py    # handcrafted-feature MLP (empty today)
│   │   └── fusion.py        # late-fusion head
│   └── train.py             # joint ST-GCN + fusion training loop
├── docs/                    # YOU ARE HERE
├── main.py                  # ingestion entrypoint
├── requirements.txt         # empty today — needs pinning
└── venv/
```

## Three-line summary of the current state

- **Data ingestion** runs; NTU parses well (3,777 sequences), UR is
  silently broken (joints collapsed to all-zero — see audit).
- **Models** are trained but on biased data (3:1 class imbalance with
  no class weighting), and the three 14-joint layouts in the code
  disagree with each other (see `audit_findings.md`).
- **API, classifier branch, and context engine** are still empty stubs.

## What "done" looks like for the backend

A single command (`python -m backend` or `uvicorn backend.api.server:app`)
should:

1. Open the USB camera.
2. Run MediaPipe Pose at ≥ 20 FPS on a 640×480 frame.
3. Maintain a 90-frame sliding buffer of unified 14-joint skeletons.
4. Every N frames (e.g. every 6, so 5 Hz), forward-pass the buffer
   through ST-GCN + handcrafted features + fusion, produce a risk score
   in `[0, 1]` and a categorical risk level
   (`NORMAL` / `MODERATE` / `HIGH`).
5. Emit the score, risk level, top-3 contributing features, and the
   skeleton itself over WebSocket.
6. When `HIGH` persists for ≥ 0.5 s, dispatch an alert (audio chirp via
   the laptop, push to mobile via FCM dev/local server).
7. Persist 5-second pre-event skeleton-only replays to `data/events/`.

See [`improvement_plan.md`](improvement_plan.md) for the ordered task
list to get there.
