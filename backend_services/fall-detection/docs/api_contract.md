# API Contract

`api/server.py` (FastAPI + WebSockets). All endpoints live on the local
LAN. There is **no authentication** in the prototype, but every
endpoint binds to `0.0.0.0:8000` only when started with `--lan`
explicitly; default bind is `127.0.0.1`.

## REST endpoints

### `GET /api/health`
Liveness check.

```json
{ "status": "ok", "version": "0.1.0", "uptime_s": 1234 }
```

### `GET /api/status`
Most recent risk snapshot + calibration summary.

```json
{
  "snapshot": { ... see /ws/live payload ... },
  "calibration": {
    "calibrated": true,
    "zones": [
      { "name": "bed",          "centroid": [0.12, 0.04], "radius": 0.4 },
      { "name": "chair",        "centroid": [0.55, 0.10], "radius": 0.3 },
      { "name": "walking_area", "centroid": [0.30, 0.20], "radius": 0.7 }
    ]
  },
  "patient_id": "ROOM-1-P-001"
}
```

### `GET /api/events?since={ts}`
Returns the list of fall/moderate events since `ts` (unix seconds).

```json
[
  {
    "event_id": "evt_2026-06-30T11-04-12_001",
    "ts": 1719726252.81,
    "level_reached": "HIGH",
    "score_peak": 0.91,
    "acknowledged": false,
    "replay_url": "/api/replay/evt_2026-06-30T11-04-12_001"
  }
]
```

### `POST /api/alerts/{event_id}/ack`
Caregiver acknowledgement from the mobile app. Stops the audio
re-trigger and marks the event in storage.

```json
{ "acknowledged_by": "nurse_jane", "ts": 1719726270.0 }
```

### `GET /api/replay/{event_id}`
Skeleton-only replay for the 10 s window centred on the event.

```json
{
  "event_id": "evt_2026-06-30T11-04-12_001",
  "fps": 30,
  "frames": [
    { "ts": 1719726247.81, "skeleton": [[x,y,z], ...14] },
    ...
  ],
  "heatmap": [
    { "feature": "max vertical drop velocity", "weight": 0.41 },
    { "feature": "max torso lean angle",       "weight": 0.27 },
    { "feature": "kinetic spike",              "weight": 0.18 }
  ]
}
```

## WebSocket endpoint

### `WS /ws/live`
Server pushes one `Snapshot` ~5 Hz. Clients may also send a single
`{"command": "calibrate"}` message to trigger room calibration.

```jsonc
// Snapshot
{
  "ts": 1719726252.81,
  "risk_score": 0.42,
  "risk_level": "MODERATE",         // NORMAL | MODERATE | HIGH | UNAVAILABLE
  "posture":    "standing",         // lying | sitting | standing | walking
  "zone":       "walking_area",
  "pose_quality": "high",           // high | degraded | unusable
  "skeleton": [[x,y,z], ... 14],
  "contributing_features": [
    {"name": "max vertical drop velocity", "value": 1.83},
    {"name": "max torso lean angle",       "value": 1.04},
    {"name": "kinetic spike",              "value": 1.51}
  ]
}
```

## Storage

- Events persisted as one JSON file per event in `data/events/`.
- Calibration persisted to `data/calibration.json`.
- No video, no RGB frames, ever.

## Error model

- All 4xx/5xx responses return `{"error": "...", "code": "..."}`
  with a stable string code (`POSE_UNAVAILABLE`, `MODEL_NOT_LOADED`,
  `EVENT_NOT_FOUND`).

## Versioning

- Path-prefix `/api/...` is unversioned for the prototype.
- Add `/api/v1/...` only when the dashboard / mobile app starts being
  used by anyone outside the project.
