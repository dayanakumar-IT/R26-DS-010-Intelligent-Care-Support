# Risk-Level State Machine

The model produces a probability `p_fall ∈ [0,1]`. The product needs
three discrete levels and a stable alert behaviour. This document
specifies the smoother and the finite state machine.

## Smoothing (EMA + dwell)

```
p_smooth_t = α · p_fall_t + (1 - α) · p_smooth_{t-1}     # α = 0.4
```

Update at 5 Hz (every 6 frames at 30 FPS). This is just enough
smoothing to ignore single-frame spikes without blunting a real fall.

## Thresholds

```
NORMAL    if  p_smooth  <  τ_low                          = 0.35
MODERATE  if  τ_low ≤ p_smooth < τ_high                   τ_high = 0.65
HIGH      if  p_smooth ≥ τ_high
```

Tune `τ_low` / `τ_high` on the validation set so that:
- The `HIGH` decision recovers ≥ 95 % of real falls (precision target
  ≈ 0.85).
- The `MODERATE` band fires roughly 2× more often than `HIGH` so it
  actually has predictive value for caregivers as an *early warning*.

## Dwell (hysteresis) — prevents flicker

A level change only commits after the new level has been seen for the
dwell time:

| Transition | Dwell |
|---|---|
| `NORMAL    → MODERATE` | 1.5 s |
| `MODERATE  → HIGH`     | 0.5 s |
| `HIGH      → MODERATE` | 3.0 s |
| `MODERATE  → NORMAL`   | 3.0 s |
| any → `UNAVAILABLE` (pose quality) | immediate |

Rationale:
- Going **up** (toward more dangerous) is fast — we err on the side of
  alerting.
- Going **down** is slow — once an alert fires, caregivers see it stay
  for at least a few seconds even if the patient briefly looks stable.

## Pose-quality gate

`UNAVAILABLE` overrides the score whenever MediaPipe reports mean joint
visibility `< 0.4` for ≥ 1 s. In `MODERATE`/`UNAVAILABLE` we suppress
micro-instability features (F13–F15) — see the `pose_quality` field on
the snapshot in `api_contract.md`.

## Alert dispatch

- `risk_level == HIGH` and held for `≥ 0.5 s` → fire one alert.
- After firing, cool down for `≥ 30 s` (do not re-alert on the same
  event unless the level dropped to ≤ `MODERATE` and rose back to
  `HIGH`).
- Alert payload includes the snapshot at `t0` plus a link to the
  5 s skeleton-only replay (`/api/replay/{event_id}`).

## Contributing-feature attribution

For every snapshot, compute the top-3 features that contributed to the
risk score. We use a simple, faithful method that does **not** require
extra training:

1. Take the standardised 18-vector `z`.
2. Compute `contrib_i = |z_i| · |w_i|` where `w` is the first-layer
   weight matrix row of the **classifier** (feature-only branch) for
   the FALL class.
3. Pick the top 3 indices.
4. Map back to human-readable names (`F2_max_vy_hip` → "max vertical
   drop velocity"). Maintain that table in `config/settings.py`.

This attribution is grounded in features that the model *actually
uses*, so the explanation is faithful (not post-hoc). It is *not* a
SHAP value — we don't need that for a small linear-on-features head.

## Persisted fields

The snapshot pushed over WS contains:

```jsonc
{
  "ts": 1718711011.34,           // unix seconds
  "risk_score": 0.42,            // smoothed p_fall
  "risk_level": "MODERATE",      // {NORMAL, MODERATE, HIGH, UNAVAILABLE}
  "skeleton": [[x,y,z], ...],    // 14 joints
  "posture": "standing",         // lying/sitting/standing/walking
  "zone": "walking_area",        // from calibration
  "pose_quality": "high",        // high/degraded/unusable
  "contributing_features": [
    {"name": "max vertical drop velocity", "value": 1.83},
    {"name": "max torso lean angle",       "value": 1.04},
    {"name": "kinetic spike",              "value": 1.51}
  ]
}
```
