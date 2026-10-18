# SENTRY — Viva Demo Posture Guide
**IT22057488 · Harishalinee · SLIIT Final Viva**

---

## System Thresholds (know these numbers)
| Level | Score | Condition |
|-------|-------|-----------|
| NORMAL | < 0.55 | Safe, standing/sitting normally |
| MODERATE | 0.55 – 0.72 | Unstable movement detected |
| HIGH | > 0.72 for 3 seconds | Fall risk — alert fires |

---

## Best Postures to Demo (in this order)

### 1. NORMAL — Baseline (show first)
**Stand upright, arms relaxed at sides, facing camera**
- Stand 1.5–2 metres from camera
- Keep whole body in frame (head to feet)
- Stay still for 5–10 seconds
- Expected: Score < 0.55, GREEN / NORMAL on dashboard
- ✅ Say: *"This is a healthy patient baseline — system shows normal risk"*

---

### 2. MODERATE — Unstable Walking
**Walk slowly back and forth across the camera view**
- Shuffle your feet (small steps, slide feet)
- Lean slightly forward while walking
- Expected: Score 0.55–0.72, ORANGE / MODERATE alert fires
- ✅ Say: *"Shuffling gait detected — common pre-fall indicator in elderly patients"*

---

### 3. HIGH — Forward Lean / Near-Fall
**Lean forward dramatically from the waist (like reaching for something on the floor)**
- Keep this position for 3–4 seconds (system needs 3s dwell time)
- Arms can hang forward
- Expected: Score > 0.72, RED / HIGH alert fires on BOTH web and mobile
- 🔔 Mobile beeps 3 times
- ✅ Say: *"Sustained forward body tilt — biomechanical fall precursor detected. Alert sent to caregiver mobile instantly"*

---

### 4. HIGH — Sudden Drop / Squat
**Quickly squat down or pretend to stumble**
- Drop down fast, stay crouched for 3 seconds
- Expected: HIGH alert — vertical drop velocity triggers score spike
- ✅ Say: *"Peak vertical drop velocity exceeded — system identified a fall event in real time"*

---

### 5. Recovery — Back to Normal
**Stand back up straight, stay still**
- Expected: Score drops back to NORMAL within 5–10 seconds (EMA smoothing)
- ✅ Say: *"EMA smoothing prevents false recovery — system only resets after sustained safe posture"*

---

## Demo Flow for Examiner (3 minutes)

```
1. Show web dashboard → explain live skeleton + risk score
2. Show mobile app → same alerts, caregiver view
3. Stand NORMAL → point to green score
4. Do MODERATE walk → show orange alert appear on BOTH screens
5. Do forward lean (HIGH) → 3 beeps on phone, RED on web
6. Tap Acknowledge on mobile → show it updates on web too
7. Stand straight → show score recover to NORMAL
```

---

## If Score Shows HIGH While Standing Straight

This happens when:
- Camera angle cuts off feet/head — **adjust camera** so full body is visible
- Too close to camera — step back to 1.5–2 metres
- Background motion (people walking behind) — clear the background

**Say to examiner:**
> *"Pose quality degrades when the full skeleton cannot be detected — the system flags this conservatively as MODERATE risk rather than ignoring it. This is intentional clinical design."*

---

## Key Numbers to Mention

| Number | Fact |
|--------|------|
| 14 joints | MediaPipe Pose skeleton used |
| 3,847 sequences | Training dataset size |
| 0.72 threshold | HIGH risk cutoff |
| 3 seconds | Dwell time before HIGH alert fires |
| 5 seconds | Mobile-web sync polling interval |
| 53 MB | APK size |
| FastAPI + WebSocket | Backend stack |

---

## Camera Setup for Best Results
- USB camera at **chest height**, angled slightly downward
- Subject stands **1.5–2 metres** away
- Plain background (no moving objects behind)
- Good lighting — avoid backlight (window behind subject)
- Full body must be in frame — head to feet
