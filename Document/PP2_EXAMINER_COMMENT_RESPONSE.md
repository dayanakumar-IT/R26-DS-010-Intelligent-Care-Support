# PP2 Examiner Comment — Response and Evidence
**IT22057488 — Harishalinee Elangovan | SENTRY Component | SLIIT 2024/25**

---

## The PP2 Examiner Comment (IT22057488)

> **"Improve model accuracy and prediction when it change with world (environment)."**

---

## What the Comment Means

The examiner wanted to see that the model does not break or become inaccurate when the real deployment environment is different from the training environment — for example, a different room, different lighting, different camera angle, or a different patient.

---

## What Was Done to Address It — 5 Implemented Solutions

---

### Solution 1 — Webcam Domain Adaptation Fine-Tuning (Most Direct)

**What we did:**
The base model was trained on NTU RGB+D (studio data, depth camera, controlled lighting). We collected **93 real webcam clips** in the actual deployment environment — a real room with a real USB webcam, real lighting, real clothing — and fine-tuned all three model components on these clips.

This process is called **domain adaptation** — deliberately adapting the model to work accurately in the target real-world environment, not just the training environment.

**Evidence:**
- Webcam fine-tuned AUC: **0.8527** (on held-out webcam clips, subject-disjoint)
- Base model (NTU only) AUC: **0.9836** (on studio data)
- The gap between 0.9836 and 0.8527 is honest evidence of real domain shift — and fine-tuning closes this gap for the webcam environment
- Files: `models/saved/stgcn_best_webcam.pth`, `fusion_best_webcam.pth`, `classifier_best_webcam.pth`, `scaler_webcam.pkl`, `threshold_webcam.json`

**What to say in presentation:**
*"In response to the PP2 feedback, we performed webcam domain adaptation — fine-tuning the model on 93 clips collected in the real deployment environment. This directly addresses the comment about accuracy when the environment changes. The fine-tuned model achieves AUC 0.8527 on real webcam evaluation data."*

---

### Solution 2 — Passive Zone Calibration (Adapts to Every New Room)

**What we did:**
Every hospital room is physically different — the bed is in a different position, the chair is in a different location, the walking area is different. We built a **passive zone calibration system** (`src/zone_calibration.py`) that automatically learns the physical layout of each new room without any manual configuration.

The system watches where the patient moves for 60-90 seconds, records hip midpoint positions, and uses K-Means clustering to identify the bed zone, chair zone, and walking zone automatically.

**Evidence:**
- File: `backend_services/fall-detection/src/zone_calibration.py` (created — Phase 8)
- Output: `config/zones_auto.json` — polygon zones per cluster
- API endpoint: `POST /api/rooms/{room_id}/calibrate`
- Dependency: `scipy>=1.12` added to `requirements.txt` for ConvexHull polygon generation

**What to say in presentation:**
*"Our passive zone calibration feature automatically adapts the system's understanding of the room environment. When deployed in a new room, the caregiver runs calibration for 60 seconds and the system learns the layout — no manual configuration needed."*

---

### Solution 3 — Pose Quality Detection (Adapts to Lighting and Occlusion Changes)

**What we did:**
When the environment changes — room becomes darker, patient is behind a curtain, camera is partially blocked — MediaPipe joint visibility drops. Instead of continuing to make predictions with unreliable skeleton data, the system now:

1. Checks the visibility score of each joint (VIS_THRESH = 0.3)
2. If too many joints are below the threshold → switches to **DEGRADED** or **UNAVAILABLE** state
3. Suspends inference in UNAVAILABLE state
4. Shows a warning banner on the web dashboard so the caregiver knows monitoring quality has dropped
5. Added a **no-person guard** — if all joints have zero visibility (no person in frame), returns UNAVAILABLE immediately

**Evidence:**
- File: `backend_services/fall-detection/src/inference.py` — `_pose_quality()` method (Phase 4)
- Web dashboard: DEGRADED banner shown when `pose_quality === 'DEGRADED'` or `posture === 'UNKNOWN'` (Phase 2)
- Pose quality states: GOOD / DEGRADED / UNAVAILABLE

**What to say in presentation:**
*"When environmental conditions change — for example poor lighting or camera obstruction — the system detects degraded pose quality and suspends inference rather than producing inaccurate risk predictions. The caregiver receives a visual warning so they know to physically check the patient."*

---

### Solution 4 — Threshold Tuned Specifically for the Real Environment

**What we did:**
The decision threshold of 0.32 was not taken from the training dataset. It was **specifically tuned on held-out real webcam evaluation clips** by finding the threshold that maximises F1-score for the real deployment environment.

This means the boundary between NORMAL and HIGH risk is calibrated to the actual environment — not the studio environment. The scaler (`scaler_webcam.pkl`) was also fitted on webcam data to normalise the 18 biomechanical features to the real-world scale.

**Evidence:**
- File: `models/saved/threshold_webcam.json` — `{"threshold": 0.32}`
- Threshold selection method: maximise F1 on webcam validation split (0.1 to 0.9 in 0.05 steps)
- File: `models/saved/scaler_webcam.pkl` — StandardScaler fitted on webcam feature distributions

**What to say in presentation:**
*"The decision threshold of 0.32 was calibrated specifically on real webcam data, not studio data. This means the model's prediction boundary is tuned to the actual deployment environment."*

---

### Solution 5 — Camera Reconnect Loop (Adapts to Hardware Environment Changes)

**What we did:**
If the physical environment changes — USB cable is disturbed, camera feed drops, device reconnects — the inference engine does not crash. A reconnect loop monitors for consecutive camera read failures and automatically attempts to reconnect.

**Evidence:**
- File: `backend_services/fall-detection/src/inference.py` — camera reconnect loop (Phase 2)
- Trigger: 30 consecutive failed camera reads → reconnect attempt

---

## Summary Table

| PP2 Comment | Solution Implemented | File / Evidence |
|---|---|---|
| Model accuracy when environment changes | Webcam domain adaptation — 93 clips fine-tuning | `models/saved/*_webcam.pth` |
| Environment = different room layout | Passive zone calibration (K-Means, ConvexHull) | `src/zone_calibration.py` |
| Environment = lighting / occlusion | Pose quality states (GOOD/DEGRADED/UNAVAILABLE) | `src/inference.py` — `_pose_quality()` |
| Environment = real vs studio scale | Threshold 0.32 tuned on real webcam clips | `models/saved/threshold_webcam.json` |
| Environment = hardware failure | Camera reconnect loop | `src/inference.py` — reconnect loop |

---

## What to Say in the Final Presentation (Script)

> "In PP2, the examiner noted that we needed to improve model accuracy and prediction when the environment changes. We addressed this in five ways.
>
> First, we performed webcam domain adaptation — fine-tuning the model on 93 clips collected in the real deployment environment, achieving a webcam AUC of 0.8527.
>
> Second, we implemented passive zone calibration — the system automatically adapts its understanding of room layout to each new physical environment without manual configuration.
>
> Third, we added pose quality detection — when lighting or occlusion degrades joint visibility, inference is suspended and the caregiver is warned, rather than producing unreliable risk predictions.
>
> Fourth, the decision threshold of 0.32 and the feature scaler were specifically calibrated on real-world webcam data, not studio data.
>
> Together, these changes directly and completely address the PP2 examiner's feedback."

---

*PP2 Comment Response — SENTRY — IT22057488 — SLIIT 2024/25*
