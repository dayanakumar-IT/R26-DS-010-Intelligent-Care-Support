# THESIS FACT VERIFICATION — FINAL PASS
**Generated:** 2026-10-05 (updated with targeted second verification pass)
**Auditor:** Claude Code — all claims sourced directly from code, JSON results, .npy array shapes, and git log
**Status:** VERIFICATION COMPLETE — see §THESIS GENERATION CLEARANCE at end

---

# 1. Executive Verification Summary

## Most Important Confirmed Facts

| Area | Confirmed Value | Source |
|---|---|---|
| NTU processed sequences | 3,777 total (947 FALL, 2,830 NORMAL) | `ntu_data.npy` shape (3777, 90, 14, 4) |
| UR processed sequences | 70 total (30 FALL, 40 NORMAL) | `ur_data.npy` shape (70, 90, 14, 4) |
| Combined NTU+UR total | **3,847** (977 FALL, 2,870 NORMAL) | `split_idx.npz` sum=2692+577+578=3,847 |
| Random split: train/val/test | 2,692 / 577 / 578 | `split_idx.npz` |
| Subject-disjoint: train/val/test | 2,555 / 980 / 312 | `split_idx_subject.npz` |
| ST-GCN blocks | 3, channels 4→32→64→128 | `src/models/stgcn.py` |
| Fusion input dim | 128 + 18 = 146 | `src/models/fusion.py` |
| EMA alpha | 0.25 | `config/settings.py` |
| Alert cooldown (HIGH) | 20 s | `config/settings.py` |
| Tau_low / Tau_high | 0.55 / 0.72 | `config/settings.py` |
| Optimiser (main training) | AdamW, lr=3e-4, wd=1e-4 + CosineAnnealingLR | `src/train.py` |
| Optimiser (fine-tuning) | Adam (not AdamW), lr=1e-5 | `src/finetune_webcam.py` |
| Full pipeline latency | 5.55 ms, 180.1 w/s, 18.0× headroom | `models/saved/latency_benchmark.json` |

## Critical Corrections from Second Verification Pass

1. **Zone modifier NOT applied to alert pipeline** — `server.py` lines 288–294 explicitly bypass the zone modifier. Modifier is COMPUTED and DISPLAYED in the UI (`zone_modifier` field in WebSocket), but NOT added to the fusion score before threshold/alert decisions. Code comment: "Zone modifier was causing false HIGHs." Previous pass incorrectly stated zone modifiers were "active" in the scoring pipeline — this is now corrected.

2. **SITTING posture caps HIGH → MODERATE — CONFIRMED** in `server.py` lines 296–305. When `ctx_result.posture == "SITTING"` and `state.level == "HIGH"`, state is forced to MODERATE and the alert flag is suppressed. Previously listed as STUDENT CONFIRMATION REQUIRED — now CONFIRMED.

3. **Dataset total = 3,847** — Previously estimated ~3,853 from 578/0.15. Actual from `split_idx.npz`: **3,847**.

4. **Subject-disjoint val set = 980** — Much larger than random-split val (577). 6 NTU subjects happen to have many clips; subject-level splitting does not guarantee 15% of clips goes to val.

5. **NTU per-class breakdown**: A043=947 FALL; A008=948, A009=948, A027=934 NORMAL (source zip archives contain 948 of each; 15 filtered for min-frame requirement).

6. **Face blur CONFIRMED active** — `inference.py` lines 285–295. Dynamic Gaussian blur centred on nose landmark, applied per captured frame before JPEG encoding. NOT persisted.

7. **Replay buffer**: 150-frame rolling (5 s), 90 frames (3 s) saved to `_replay_mem` on alert.

8. **Zone Config UI = preset-selector**, NOT free-form polygon drawing. `ZoneConfigPanel` in Overview.tsx uses hardcoded `ZONE_PRESETS` layouts; no click-to-draw capability.

9. **Frontend fall-detection entirely by Harishalinee Elangovan** — confirmed by git log (all 4 substantive commits by harishalinee@agrithmics.lk).

10. **Authentication: completely open** — no middleware, no JWT, no dependency-injected auth anywhere in server.py.

11. **Multi-seed results: none** — script exists (`train_multi_seed.py`) but no saved JSON. Cannot claim variance figures.

12. **FAR 0.70% = static classification rate, NOT operational rate** — 3 FP out of 431 NORMAL test samples. Post-processing benefits not empirically quantified.

---

# 2. Dataset Verification — FINAL

## 2.1 Exact Processed Sequence Counts

**Source of truth**: `.npy` array shapes in `backend_services/fall-detection/data/processed/processed/`

| File | Shape | Meaning |
|---|---|---|
| `ntu_data.npy` | (3777, 90, 14, 4) | NTU processed sequences |
| `ntu_labels.npy` | (3777,) dtype=int64 | 0=NORMAL, 1=FALL |
| `ur_data.npy` | (70, 90, 14, 4) | UR processed sequences |
| `ur_labels.npy` | (70,) | 0=NORMAL, 1=FALL |
| `webcam_data.npy` | (93, 90, 14, 4) | Webcam — ALL clips both subjects |
| `webcam_labels.npy` | (93,) | 0=NORMAL, 1=FALL |
| `split_idx.npz` | train(2692)+val(577)+test(578)=**3,847** | Random split indices |
| `split_idx_subject.npz` | train(2555)+val(980)+test(312)=**3,847** | Subject-disjoint indices |

**NTU class breakdown** (from zip archive and label array):
- A043 (falling down) → FALL: **947** (948 in zip archive − 1 filtered)
- A008 (sitting down) → NORMAL: **948**
- A009 (standing up) → NORMAL: **948**
- A027 (jump up) → NORMAL: **934** (948 in zip − 14 filtered)
- NTU total: **3,777** (3,792 in archives − 15 filtered for minimum frame count)

**UR breakdown** (from label array):
- FALL: **30** | NORMAL: **40** | Total: **70**

**Combined NTU+UR**:
- Total: **3,847** sequences
- FALL: **977** (947+30) | NORMAL: **2,870** (2,830+40)
- Class ratio: NORMAL:FALL ≈ 2.94:1

**The "578 clips" figure** cited in earlier thesis drafts is the random-split **test set size**, NOT the full dataset.

**The subject-disjoint val set (980)** is notably large because it contains all clips from 6 NTU subjects. Subject-level splits do not produce equal proportions of clips.

### Final Thesis Wording
"The combined training corpus contains 3,847 labelled 90-frame skeleton sequences: 3,777 from the NTU RGB+D dataset (947 falling-down [A043], 948 sitting-down [A008], 948 standing-up [A009], 934 jump-up [A027]) and 70 from the UR Fall Detection Dataset (30 FALL, 40 ADL-NORMAL)."

### Confidence: HIGH

---

## 2.2 Webcam Dataset

- Total recorded: **93 clips** (30 FALL + 63 NORMAL) — confirmed from `webcam_data.npy` shape (93, 90, 14, 4)
- Subjects: 2 (subject1, subject2)
- Subject 2 held out (evaluation): **58 clips** (43 NORMAL + 15 FALL) — `eval_report_webcam.json`
- Subject 1 used for fine-tuning: **35 clips** (93 − 58) — **STUDENT CONFIRMATION REQUIRED** for exact per-class breakdown

### Confidence: HIGH (total and holdout confirmed); MEDIUM (subject 1 breakdown needs student confirmation)

---

# 3. Preprocessing Verification

## 3.1 Training Augmentations — COMPLETE LIST

**Source**: `src/data_processor.py` lines 208–218, `DataProcessor.training_augment()`.

Applied in this exact order to every training sample at each epoch:

| Step | Method | Parameters | Applied |
|---|---|---|---|
| 1 | Temporal jitter | Speed ±10% (uniform ∈ [0.9, 1.1]) | Always |
| 2 | Random subwindow crop | 60-frame sub-window → re-interpolated to 90 | Always |
| 3 | L-R horizontal flip | Swap joint pairs + negate x-axis | p=0.5 |
| 4 | Yaw rotation | ±10° around y-axis | Always |
| 5 | Weak perspective + image-plane roll | Focal jitter ±15%, roll ±10° | Always |
| 6 | Z-axis drop | Zero z-channel + XY noise σ=0.02 | p=0.5 |
| 7 | Gaussian joint noise | σ=0.01 on xyz (visibility unchanged) | Always |

**All augmentations operate on xyz only; visibility channel passes through unchanged.**
Features are recomputed from the augmented skeleton each epoch.

Step 6 (Z-drop) specifically simulates the NTU 3D Kinect → MediaPipe 2D domain gap (NTU provides z; MediaPipe provides near-zero z for a standard webcam).

### Confidence: HIGH (complete code read of training_augment())

---

## 3.2 Spatial Normalisation (Clip-Level)

- Origin: **median** hip-midpoint over first 5 frames
- Scale: **median** torso length (neck-to-hip midpoint) over first 5 frames
- Only xyz normalised; visibility preserved
- Epsilon guard: `if torso_scale > 1e-3`

### Confidence: HIGH

---

## 3.3 Temporal Windowing

- Target: **90 frames** (3 s at 30 FPS)
- Inference every **INFER_EVERY_N=3** frames ≈ 10 windows/sec
- Buffer must be **100% full** (MIN_BUFFER_FILL=1.0) before inference fires
- Comment: partial buffers cause spurious HIGH scores during warmup

### Confidence: HIGH

---

# 4. Model Architecture Verification

## 4.1 SkeletalSTGCN

Input: **(N, T=90, V=14, C=4)** — [x, y, z, visibility]

```
data_bn: BatchNorm1d(56)
block1:  STGCNBlock(4→32,  stride=1)
block2:  STGCNBlock(32→64, stride=2)
block3:  STGCNBlock(64→128,stride=2)
pool:    AdaptiveAvgPool2d(1)
fc:      Linear(128→2)    ← auxiliary head
embedding: 128-D (after pool, before fc)
```

Each STGCNBlock: A_norm (symmetric D^{-½}(A+I)D^{-½}, registered buffer) × Conv2d(1×1) → BN→ReLU→Conv2d(9×1,stride)→BN→Dropout(0.3) → residual → ReLU.

### Confidence: HIGH

---

## 4.2 LateFusionNetwork

```
LayerNorm(128) on embedding → concat 18-D features → 146-D
→ Linear(64) → BN1d(64) → ReLU → Dropout(0.3) → Linear(2)
```
No softmax inside model.

### Confidence: HIGH

---

## 4.3 FeatureClassifier

```
Linear(18→64) → BN1d(64) → ReLU → Dropout(0.3) → Linear(64→32) → ReLU → Linear(32→2)
```

### Confidence: HIGH

---

# 5. Feature Engineering Verification

## 5.1 Complete F1–F18 (verified from features.py)

| ID | Formula | Category |
|---|---|---|
| F1 | mean(−v_hip_y) | Velocity |
| F2 | max(−v_hip_y) | Velocity |
| F3 | mean(|v_hip_x|) | Velocity |
| F4 | mean(−v_head_y) | Velocity |
| F5 | max(|a_hip_y|) | Acceleration |
| F6 | mean(||Δskeleton||²_F/dt) | Energy |
| F7 | max(above) | Energy |
| F8 | mean(torso_angle) | Posture |
| F9 | max(torso_angle) | Posture |
| F10 | mean(|dθ/dt|) | Posture |
| F11 | mean(width/height bounding box) | Posture |
| F12 | max(above) | Posture |
| F13 | **0.6×std(torso_angle) + 0.4×zero_crossing_rate(torso_angle)** | Micro-instability |
| F14 | std(hip_centre_x) | Micro-instability |
| F15 | std(hip_centre_y) | Micro-instability |
| F16 | Σ||Δhip_centre|| | Micro-instability |
| F17 | min(skeleton_bbox_height) / max(skeleton_bbox_height) — where bbox_height[t] = max_joint_y[t] − min_joint_y[t] over all 14 joints. Variable named `min_hip_height_ratio` in settings.py — this name is a misnomer; it uses the full skeleton extent, not hip-only. | Micro-instability |
| F18 | mean joint dispersion from centroid | Micro-instability |

**F1 sign convention**: downward velocity is negated (−v_y), so a falling person produces positive F1/F2/F4.

## 5.2 F13 — HARD-CODED WEIGHTS, NO GRID SEARCH

Formula: `0.6 × std(torso_angle) + 0.4 × zero_crossing_rate(torso_angle)`. Weights are **hard-coded in features.py**. No grid-search script or result file exists. **DO NOT claim grid-search selection.**

### Confidence: HIGH

---

# 6. Training Verification

## 6.1 Main Training

- **Optimiser**: AdamW, lr=3×10⁻⁴, wd=1×10⁻⁴
- **Scheduler**: CosineAnnealingLR, T_max=60
- **Epochs**: max 60; **Early stopping**: patience=10 on val macro-F1
- **Batch**: 32; **Gradient clip**: max_norm=1.0; **Seed**: 42
- **Loss**: `CE(fusion_logits, y) + 0.2×CE(stgcn_logits, y)` — joint training
- **Sampler**: WeightedRandomSampler (UR clips 10× weight)

### Confidence: HIGH

---

## 6.2 Webcam Fine-Tuning

- **Optimiser**: Adam (NOT AdamW), lr=1×10⁻⁵, wd=1×10⁻⁴
- **Epochs**: max 20; **Patience**: 7; **Batch**: 8
- **Freeze phase** (epochs 1–3): only `stgcn.fc` + `fusion.head` trainable
- **Unfreeze phase** (epochs 4+): all parameters trainable
- Load from `stgcn_best.pth` + `fusion_best.pth`
- Best checkpoint saved by val macro-F1

### Confidence: HIGH

---

## 6.3 Multi-Seed Results — NONE

`src/train_multi_seed.py` script exists. No saved result JSON. No multi-seed variance figures can be cited.

### Confidence: HIGH

---

# 7. Evaluation Protocols

## 7.1 Random Split
- 70/15/15 clip-level stratified, seed=42
- 2,692 / 577 / 578 — total 3,847

## 7.2 Subject-Disjoint
- NTU: 28 train / 6 val / 6 test subjects (out of 40)
- UR: always in training set
- 2,555 / 980 / 312 — total 3,847 (val=980 is large due to high-clip subjects)

## 7.3 Webcam Evaluation — METHODOLOGY CLARIFICATION

Subject 2 clips (58) serve as BOTH the fine-tuning validation set (for early stopping + threshold selection) AND the reported final test set.

**Bias implications**:
- Model-selection bias: saved checkpoint is optimised for Subject 2 distribution
- Threshold-selection bias: threshold 0.32 was selected on the evaluation set
- **ROC-AUC (0.8527) is threshold-independent → primary metric**; threshold-dependent metrics (accuracy, FAR, sensitivity) carry upward bias

### Recommended Chapter 3 wording
"The webcam evaluation uses a subject-disjoint protocol: fine-tuning trains exclusively on Subject 1 clips; Subject 2's 58 clips serve as the held-out evaluation set and also as the validation set for early stopping and threshold selection. Because the decision threshold is optimised on the same clips used for final evaluation, threshold-dependent metrics carry threshold-selection bias. ROC-AUC is therefore the primary generalisability indicator."

### Recommended Chapter 6 wording
"At the val-selected threshold of 0.32, accuracy = 91.38%, fall sensitivity = 80.00%, FAR = 4.65%. These threshold-based metrics should be interpreted cautiously as the threshold was selected on the evaluation set. ROC-AUC = 0.8527 is the bias-free primary metric."

### Recommended Chapter 7 wording
"The webcam evaluation is limited by its scale (two subjects, 93 clips) and the dual role of Subject 2 clips as both validation and test set. Threshold-based metrics are upper-bounded estimates; the AUC of 0.8527 represents the strongest evidence of generalisation."

### Confidence: HIGH

---

# 8. Results — FINAL VERIFIED VALUES

## 8.1 Three Experiments — Do NOT Conflate

| | Experiment | AUC | Train | Test |
|---|---|---|---|---|
| **A** | Subject-disjoint combined | **0.9836** | NTU+UR, 28 subjects | NTU 6 held-out subjects (312 clips) |
| **B** | Cross-dataset NTU→UR | **0.410** | NTU only (85/15 internal) | UR Fall Detection Dataset (70 clips) |
| **C** | Webcam fine-tuned holdout | **0.8527** | Subject 1 webcam clips | Subject 2 webcam clips (58 clips) |

These are three separate experiments. **B (0.410) is about NTU→UR domain shift, not NTU→Webcam**. Do not present A, B, C as a single before-after timeline.

### Safe Chapter 6 wording
"Three evaluation protocols address different aspects of generalisation. Under the subject-disjoint combined benchmark (A), the late-fusion model achieves ROC-AUC = 0.9836, demonstrating generalisation across unseen NTU subjects. The cross-dataset experiment (B) — training exclusively on NTU data and evaluating on the separate UR Fall Detection Dataset — achieves ROC-AUC = 0.410, confirming substantial domain shift from laboratory Kinect data to real-world camera footage. Following two-phase fine-tuning on 35 Subject 1 webcam clips (C), ROC-AUC recovers to 0.8527 on the Subject 2 held-out evaluation set."

---

## 8.2 Random-Split Results (eval_report.json)

Test set: 578 total (431 NORMAL + 147 FALL)

| Model | CM | Accuracy | Sensitivity | FAR | ROC-AUC | PR-AUC | Threshold |
|---|---|---|---|---|---|---|---|
| ST-GCN | [[412,19],[4,143]] | 96.02% | 97.28% | 4.41% | 0.9886 | 0.9674 | 0.50 |
| Feature-only | [[413,18],[11,136]] | 94.98% | 92.52% | 4.18% | 0.9865 | 0.9688 | 0.50 |
| Fusion | [[428,3],[7,140]] | **98.27%** | **95.24%** | **0.70%** | **0.9926** | **0.9922** | 0.94 |

Fusion accuracy: (428+140)/578 = 568/578 = **98.2699...% → 98.27%** (use 98.27% consistently).
FAR: 3/(3+428) = 3/431 = **0.696...% ≈ 0.70%**.

### Confidence: HIGH

---

## 8.3 Subject-Disjoint Results (eval_report_subj.json)

Test set: 312 total (234 NORMAL + 78 FALL)

| Model | CM | Accuracy | Sensitivity | FAR | ROC-AUC | PR-AUC | Threshold |
|---|---|---|---|---|---|---|---|
| ST-GCN | [[226,8],[6,72]] | 95.51% | 92.31% | 3.42% | 0.9780 | 0.9540 | 0.50 |
| Feature-only | [[227,7],[4,74]] | 96.47% | 94.87% | 2.99% | 0.9905 | 0.9778 | 0.50 |
| Fusion | [[231,3],[6,72]] | **97.12%** | **92.31%** | **1.28%** | **0.9836** | **0.9793** | 0.76 |

Fusion macro-F1: NORMAL F1=(231/237, 231/234)=0.9809; FALL F1=(72/75, 72/78)=0.9412 → **macro-F1=0.9610**

### Confidence: HIGH

---

## 8.4 RF Baseline (rf_baseline_results*.json)

| Split | Accuracy | Macro-F1 | Sensitivity | FAR | ROC-AUC | CM |
|---|---|---|---|---|---|---|
| Random (val set, 577) | 97.92% | 0.9725 | 95.24% | 1.16% | 0.9970 | [[426,5],[7,140]] |
| Subject-disjoint (test, 312) | **96.47%** | **0.9519** | **89.74%** | **1.28%** | **0.9882** | [[231,3],[8,70]] |

RF uses val_idx for random-split evaluation (code: `baseline_rf.py` uses `val_idx`, not `test_idx`).

### Confidence: HIGH

---

## 8.5 Webcam Fine-Tuned (eval_report_webcam.json)

58 clips (43 NORMAL + 15 FALL), threshold=0.32

| Model | Accuracy | Sensitivity | FAR | Macro-F1 | ROC-AUC |
|---|---|---|---|---|---|
| ST-GCN (no fine-tune) | 46.55% | 73.33% | 62.79% | 0.4615 | 0.6016 |
| Feature-only (no fine-tune) | 44.83% | 60.00% | 60.47% | 0.4376 | 0.4605 |
| Fusion **(fine-tuned)** | **91.38%** | **80.00%** | **4.65%** | **0.8851** | **0.8527** |

CM (fine-tuned Fusion): [[41,2],[3,12]]

### Confidence: HIGH

---

## 8.6 Cross-Dataset (eval_report_cross_dataset.json)

Train: NTU only. Test: UR Fall Detection Dataset (70 clips).

| Model | CM | ROC-AUC |
|---|---|---|
| ST-GCN | [[0,40],[0,30]] | 0.500 (all-FALL prediction) |
| Feature-only | [[30,10],[29,1]] | 0.185 |
| Fusion | [[19,21],[19,11]] | **0.410** |

**This 0.410 value concerns NTU→UR domain shift only.** It does NOT relate to the webcam dataset.

### Confidence: HIGH

---

# 9. Runtime Post-Processing — FINAL

## 9.1 Zone Modifier — CRITICAL: NOT APPLIED TO ALERT PIPELINE

**`context_engine.py`**: Computes modifier values (BED/CHAIR up to +0.20).

**`server.py` lines 288–294** (broadcast_loop):
```
# Feed raw model score directly to postprocessor — no zone modifier.
# Zone modifier was causing false HIGHs...
state = proc.update(result.risk_score, result.timestamp)
```

**The zone modifier is computed, sent in the WebSocket as `zone_modifier`, but deliberately NOT added to the fusion score before alert threshold comparisons.**

### Correct thesis wording
"The context engine computes zone-specific risk modifiers (up to +0.20 in bed or chair zones with instability indicators). Following integration testing, these modifiers are not applied to the post-processing pipeline — trials showed that TRANSITION posture jitter within configured zones produced spurious HIGH alerts during normal standing. Zone context is transmitted to the caregiver interface as auxiliary information only."

**Do NOT claim**: zone modifiers improve sensitivity or FAR, or that zone-aware scoring is active in any quantitative result.

### Confidence: HIGH

---

## 9.2 SITTING → HIGH Capped to MODERATE — CONFIRMED

**`server.py` lines 296–305:**
```python
if ctx_result.posture == "SITTING" and state.level == "HIGH":
    state = _dc_replace(state, level="MODERATE", alert=False)
```

Applied only to **stable SITTING** (not TRANSITION). Suppresses HIGH risk level AND alert flag.

### Final Thesis Value
"A posture-aware override in the broadcast loop suppresses HIGH alerts when stable SITTING posture is confirmed, downgrading risk to MODERATE. The rule does not apply during TRANSITION posture."

### Confidence: HIGH

---

## 9.3 EMA and State Machine

- EMA: `ema_t = 0.25×score_t + 0.75×ema_{t-1}`, alpha=0.25
- tau_low=0.55, tau_high=0.72
- MODERATE→HIGH: 25 consecutive dual-gate windows (both EMA ≥ 0.72 AND raw ≥ 0.72) ≈ 2.5 s
- HIGH alert cooldown: 20 s; MODERATE alert cooldown: 120 s
- Dwell times: to_moderate=0.5 s, to_moderate_from_high=0.8 s, to_normal=1.0 s, high_to_normal=1.5 s

### Confidence: HIGH

---

## 9.4 FAR 0.70% — Classification Rate, NOT Operational Rate

- **0.70%** = 3 FP / 431 NORMAL samples in the static random-split test set
- This is a per-inference-window model output metric
- Temporal post-processing (EMA, dual-gate, dwell) suppresses isolated spikes from triggering alerts; no experiment quantifies the resulting operational false-alert reduction

**Statements to remove**: "Post-processing reduced FAR to 0.70%"; any "2,640/420 false alerts per hour" figures (not empirically measured).

**Correct framing**: "The late-fusion model achieves a static classification false-alarm rate of 0.70% per inference window (3 of 431 NORMAL test windows misclassified). Temporal post-processing is designed to suppress isolated false-positive windows from triggering alerts; the operational alert rate was not independently benchmarked."

### Confidence: HIGH

---

# 10. Face Blur and Privacy — CONFIRMED

**`inference.py` lines 285–295:**
```python
# ── Face blur (privacy) ──────────────────────────────────────────
if joints is not None:
    nose = joints[0]; neck = joints[1]
    radius = max(35, int(abs(ny - nny) * 1.5))
    display[y1:y2, x1:x2] = cv2.GaussianBlur(roi, (51,51), 20)
```

- Applied to a copy of each captured frame before JPEG encoding
- Dynamic radius: `max(35px, 1.5 × |nose_y − neck_y|)` — scales with distance
- MJPEG stream serves blurred frames; NOT persisted
- Database stores skeleton coordinates only
- Replay buffer: skeleton tuples only, NOT video frames
- `/api/analyse` offline endpoint: uploaded video temporarily saved to tempfile, deleted after extraction (`os.remove(tmp.name)`)

### Confidence: HIGH

---

# 11. Replay Buffer

- Rolling buffer: **150 frames** (≈5 s at 30 fps)
- On HIGH or MODERATE alert: last **90 frames** (3 s) saved to `_replay_mem[alert_id]`
- Content: `(frame_index, timestamp, skeleton)` tuples — skeleton only, no video
- Optional R2 upload (Cloudflare R2): non-fatal if not configured

### Confidence: HIGH

---

# 12. Context Engine — Posture States

Six states: STANDING, SITTING, LYING, WALKING, TRANSITION, UNKNOWN

### Confidence: HIGH

---

# 13. Backend/API — FINAL

## 13.1 Authentication: COMPLETELY OPEN
No middleware, no JWT validation, no `Depends()` auth on any endpoint. Entire API (REST + WebSocket) is unauthenticated. Security relies on network isolation (localhost/LAN).

### Confidence: HIGH

## 13.2 CORS: allow_origins=["*"]

### Confidence: HIGH

## 13.3 Windows-Specific
PowerShell + DirectShow (cv2.CAP_DSHOW) for Hikvision auto-detection. Live webcam mode is Windows-specific.

### Confidence: HIGH

---

# 14. Frontend — FINAL

## 14.1 Zone Configuration UI
`ZoneConfigPanel` component exists (`Overview.tsx` lines 2126–2583):
- Preset polygon layout selection (hardcoded ZONE_PRESETS in frontend)
- Interactive zone diagram with clickable BED/CHAIR/WALKING zone boxes
- Risk modifier simulation (click zone to preview δ change)
- Save button → `PUT /api/rooms/{room_id}/zones` → Supabase
- **NOT free-form polygon drawing** — polygon coordinates are preset, not drawn by user

### Final Thesis Value
"The supervisor interface includes a zone configuration panel with preset room layout templates (bed, chair, and walking zones represented as normalised polygon coordinates). Supervisors select the layout that best matches the room geometry and save it to the database. Free-form polygon editing is not supported."

### Confidence: HIGH

---

## 14.2 Frontend Authorship — CONFIRMED by git log

All substantive commits to `frontend/src/modules/fall-detection/` by **Harishalinee Elangovan** (harishalinee@agrithmics.lk):
- `f0e5dacf` — build full fall-detection frontend — 11 tabs, backend-connected, all panels
- `f3737e48` — fall-detection frontend/backend improvements + scribe voice-ADL schema
- `c3a31918` — refine risk assessment logic and enhance alert system
- `8c14abbc` — enhance WebSocket message handling and update HistoryPanel

Initial PP2 scaffold commit (`4a677e6c`) by Dayana Kumar — does NOT contain fall-detection-specific files.

All `backend_services/fall-detection/` commits also by Harishalinee Elangovan.

### Confidence: HIGH

---

# 15. Database Schema

All tables verified from supabase migrations 0008–0012:

| Table | Key Columns | RLS |
|---|---|---|
| `rooms` | id, room_code, ward, camera_src, caregiver_id, zone_config(JSONB) | Enabled |
| `fall_events` | id, patient_id, room_id, timestamp, risk_score[0-100], risk_level(NORMAL/MODERATE/HIGH), posture, zone, pose_quality, confidence, key_factors(JSONB), alert_id | Enabled |
| `fall_alerts` | id, patient_id, room_id, timestamp, risk_level(MODERATE/HIGH only), acknowledged, ack_by, ack_at, r2_replay_key | Enabled |
| `patients` | id, patient_code, gender(M/F/Other), room_id | Enabled |

- `confidence` = model softmax probability (NOT a statistical confidence interval)
- `r2_replay_key` set only for HIGH alerts
- Raw video NOT stored (migration comment)
- patient_code only — no real patient names

### Confidence: HIGH

---

# 16. Testing

49 pytest tests, 4 files. All passing. Covers features, postprocessor, model shapes, REST API endpoints. Does NOT cover: database integration, WebSocket, frontend, mobile, end-to-end, security.

### Confidence: HIGH

---

# 17. Latency

## 17.1 Full Pipeline (latency_benchmark.json, 100 CPU runs)

| Stage | Mean | Std |
|---|---|---|
| Preprocessing | 1.133 ms | 0.230 ms |
| ST-GCN | 4.198 ms | 1.139 ms |
| Fusion | 0.186 ms | 0.045 ms |
| **Total** | **5.551 ms** | 1.255 ms |
| **Windows/sec** | **180.1** | — |

**Headroom**: 180.1 / 10.0 = **18.0×** above 10 windows/sec requirement.

**Not included**: MediaPipe, camera capture, WebSocket/DB.

## 17.2 Hardware for Benchmark
CPU model NOT recorded in latency_benchmark.json. **STUDENT CONFIRMATION REQUIRED** for CPU model, RAM, OS.

## 17.3 ST-GCN Only (latency_benchmark_webcam.json)
4.515 ms — MediaPipe excluded.

### Confidence: HIGH (values); LOW (hardware)

---

# 18. Operational Claims Verification

| Claim | Status | Note |
|---|---|---|
| 24-hour continuous operation | NOT VERIFIED | No evidence in repository |
| Multi-camera operation | NOT VERIFIED | Single camera per room only |
| Multi-room simultaneous inference | ARCHITECTURE SUPPORTS; NOT EMPIRICALLY BENCHMARKED | Per-room engine dict in server.py |
| Real hospital deployment | NOT VERIFIED | Simulated ward only |
| Clinician/stakeholder validation | NOT VERIFIED | No feedback records |

All five items should be stated as future work or design objectives.

---

# 19. Unsupported / Overstated Claims — COMPLETE LIST

| # | Claim | Status | Thesis Action |
|---|---|---|---|
| 1 | F13 weights selected by grid search | UNSUPPORTED | Remove; say "empirically chosen" |
| 2 | Latency 6.22 ms | ERROR — already corrected in v6 | Use 5.55 ms |
| 3 | 30-second alert cooldown | ERROR — already corrected | Use 20 s |
| 4 | EMA alpha = 0.40 | ERROR — already corrected | Use 0.25 |
| 5 | Zone modifier applied to alert pipeline | WRONG | Zone computed, displayed, NOT applied; see §9.1 |
| 6 | "2,640 / 420 false alerts per hour" | UNVERIFIED | Remove entirely |
| 7 | "24-hour monitoring demonstrated" | NOT VERIFIED | Change to design goal |
| 8 | "Clinical environments" | OVERSTATED | Change to "simulated clinical environments" |
| 9 | "Only final two layers fine-tuned" | PARTIALLY WRONG | Head-only for 3 epochs, then all layers |
| 10 | "578 clips" = full dataset | MISLEADING | 578 = test set; 3,847 = full dataset |
| 11 | AUC 0.984→0.410 as one experiment | WRONG | Two different experiments (A and B); do not conflate |
| 12 | Post-processing reduced FAR to 0.70% | WRONG | 0.70% is pre-postprocessing classification rate |
| 13 | Multi-seed variance results | UNSUPPORTED | No saved results; remove |
| 14 | Free-form polygon zone drawing | WRONG | Preset-based only |
| 15 | "Novel" contributions | REQUIRES literature | Add citations or weaken to "proposed" |
| 16 | Multi-camera, multi-room empirically verified | NOT VERIFIED | State as architecture capability |
| 17 | RF baseline 94.56% / 0.9349 (old thesis) | ERROR — already corrected | Use RF subj-disjoint 96.47% / 0.9519 |

---

# 20. Thesis Title Evaluation

| Term | Verdict |
|---|---|
| Edge-Enabled | DEFENSIBLE WITH CAVEAT — laptop CPU, not embedded. Use "edge-style local deployment." |
| Skeletal Movement Analysis | ACCURATE |
| Real-Time | PARTIALLY DEFENSIBLE — model inference 5.55 ms; full pipeline unbenchmarked |
| Fall Risk Detection | ACCURATE |
| Prediction | **OVERCLAIM** — classifies current risk, no future prediction horizon |
| Clinical Environments | **OVERSTATED** — simulated ward only |

**Recommended title**: "Edge-Enabled Skeletal Fall Risk Detection via Late-Fusion of Graph Convolutional Networks and Biomechanical Features"

---

# 21. Master Verification Table

| ID | Claim | Verdict | Source |
|---|---|---|---|
| V01 | NTU: 3,777 sequences (947F+2830N) | CONFIRMED | ntu_data.npy shape |
| V02 | UR: 70 sequences (30F+40N) | CONFIRMED | ur_data.npy shape |
| V03 | Combined total: 3,847 | CONFIRMED | split_idx.npz sums |
| V04 | NTU class breakdown: A043=947, A008=948, A009=948, A027=934 | CONFIRMED | zip archive counts + ntu_labels.npy |
| V05 | Random split: 2692/577/578 | CONFIRMED | split_idx.npz |
| V06 | Subject-disjoint: 2555/980/312 | CONFIRMED | split_idx_subject.npz |
| V07 | 7 training augmentations (complete list §3.1) | CONFIRMED | data_processor.py training_augment() |
| V08 | Z-drop p=0.5 simulates 3D→2D domain gap | CONFIRMED | data_processor.py comment |
| V09 | Face blur active, dynamic radius, GaussianBlur(51,51,20) | CONFIRMED | inference.py lines 285-295 |
| V10 | Replay: 150-frame rolling, 90-frame saved on alert | CONFIRMED | server.py lines 307-333 |
| V11 | Replay stores skeleton coords only (no video) | CONFIRMED | server.py replay tuple structure |
| V12 | SITTING→HIGH capped to MODERATE (alert suppressed) | CONFIRMED | server.py lines 296-305 |
| V13 | Zone modifier computed but NOT applied to alert pipeline | CONFIRMED (bypass) | server.py lines 288-294 with comment |
| V14 | All REST + WebSocket endpoints unauthenticated | CONFIRMED | server.py full audit |
| V15 | CORS: allow_origins=["*"] | CONFIRMED | server.py line 76 |
| V16 | Zone Config UI: preset-selector, NOT free-form drawing | CONFIRMED | Overview.tsx ZoneConfigPanel |
| V17 | Fall-detection frontend: all commits by Harishalinee | CONFIRMED | git log |
| V18 | Backend fall-detection: all commits by Harishalinee | CONFIRMED | git log |
| V19 | Multi-seed results: none saved | CONFIRMED absent | models/saved/ listing |
| V20 | 0.70% FAR = static classification, not operational | CONFIRMED | CM math: 3/431=0.697% |
| V21 | 24-hour operation | NOT VERIFIED | No evidence |
| V22 | Multi-camera | NOT VERIFIED | No implementation |
| V23 | Multi-room: architecture supports, not benchmarked | ARCHITECTURE CONFIRMED | server.py per-room dict |
| V24 | Hospital deployment | NOT VERIFIED | Simulated ward only |
| V25 | Clinician validation | NOT VERIFIED | No records in repo |
| V26 | ST-GCN: 3 blocks, 4→32→64→128, kernel=9 | CONFIRMED | stgcn.py |
| V27 | Fusion: LayerNorm(128)+18=146→64→BN→ReLU→Dropout→2 | CONFIRMED | fusion.py |
| V28 | Fine-tune: Adam, lr=1e-5, 3-epoch head-only then unfreeze | CONFIRMED | finetune_webcam.py |
| V29 | Webcam eval: threshold-selection bias; AUC primary metric | CONFIRMED | finetune_webcam.py val logic |
| V30 | Three experiments A(0.9836), B(0.410), C(0.8527) are separate | CONFIRMED | three distinct eval JSON files |
| V31 | 0.410 = NTU→UR cross-dataset; NOT related to webcam | CONFIRMED | eval_report_cross_dataset.json |
| V32 | Total inference latency: 5.55 ms, 180.1 w/s, 18.0× headroom | CONFIRMED | latency_benchmark.json |
| V33 | MediaPipe NOT in any latency benchmark | CONFIRMED | both latency JSON files |
| V34 | NTU_TARGET_CLASSES: A043, A008, A009, A027 | CONFIRMED | settings.py |
| V35 | Main optimiser: AdamW (not Adam) | CONFIRMED | train.py |
| V36 | F13 weights 0.6/0.4 hard-coded, no grid search | CONFIRMED | features.py |
| V37 | EMA alpha=0.25; tau_low=0.55; tau_high=0.72 | CONFIRMED | settings.py |
| V38 | HIGH cooldown: 20 s; MODERATE cooldown: 120 s | CONFIRMED | settings.py |
| V39 | Dual-gate: EMA≥tau_high AND raw≥tau_high simultaneously | CONFIRMED | postprocess.py |
| V40 | Sustained HIGH counter: 25 windows ≈ 2.5 s | CONFIRMED | postprocess.py |
| V41 | 6 posture states: STANDING/SITTING/LYING/WALKING/TRANSITION/UNKNOWN | CONFIRMED | context_engine.py |
| V42 | webcam_data.npy shape (93,90,14,4) — 93 total clips | CONFIRMED | npy array shape |
| V43 | Subject-disjoint val set = 980 (large due to subject clip counts) | CONFIRMED | split_idx_subject.npz |
| V44 | 49 pytest tests, 4 files, all passing | CONFIRMED | tests/ directory |
| V45 | RLS enabled on all SENTRY tables | CONFIRMED | migrations 0008-0012 |
| V46 | patients table: patient_code only, no real names | CONFIRMED | migration 0012 |
| V47 | fall_alerts: MODERATE or HIGH only | CONFIRMED | migration 0010 constraint |
| V48 | r2_replay_key: only for HIGH alerts | CONFIRMED | migration 0010 comment |
| V49 | RF random-split evaluates on val_idx (577), not test_idx | CONFIRMED | baseline_rf.py |
| V50 | Title "Prediction" is overclaim | CONFIRMED (no future horizon) | No prediction horizon in labels or training |

---

# 22. STUDENT CONFIRMATION REQUIRED Items

| # | Question | Needed For |
|---|---|---|
| SC01 | CPU model, RAM, OS used for latency_benchmark.json | §17 Latency hardware |
| SC02 | GPU or CPU used for training? Which GPU/CPU? | Training hardware description |
| SC03 | Approximate training wall-clock time | Training description |
| SC04 | Exact Subject 1 clip count and per-class breakdown (fall/normal) | §2.2 Webcam dataset |
| SC05 | Exact preset names in ZoneConfigPanel ZONE_PRESETS | §14.1 Zone UI |
| SC06 | Was formal ethics approval obtained for webcam recordings? | §2.2 Ethics |
| SC07 | Was written/verbal consent obtained from both subjects? | §2.2 Ethics |
| SC08 | Was Hikvision DS-U02 used for all webcam recordings? | §2.2 Dataset hardware |
| SC09 | Which caresense_mobile Flutter screens did you personally implement? | §14 Mobile authorship |
| SC10 | Confirmed camera resolution and FPS for webcam recordings | §2.4 Dataset |

---

# THESIS GENERATION CLEARANCE

## READY FOR THESIS GENERATION

All 50 items in the master verification table are resolved with HIGH-confidence status. The 10 STUDENT CONFIRMATION REQUIRED items (SC01–SC10) are factual details (hardware specs, ethics paperwork, exact subject counts, mobile screen ownership) that the student adds at write-time — they do not change the thesis structure or any analytical claims.

### Critical corrections that MUST be applied when writing

1. **Dataset total**: Use **3,847** (not ~3,853 or "578")
2. **Zone modifier**: Computed, displayed, NOT applied to alert pipeline — write as disabled post-integration-testing
3. **SITTING cap**: Confirmed active — write accurately
4. **F13**: Hard-coded weights — remove all grid-search language
5. **Webcam bias**: State AUC=0.8527 as primary metric; note threshold-selection bias on accuracy/FAR/sensitivity
6. **Three experiments**: A (0.9836), B (0.410), C (0.8527) — separate paragraphs, separate tables, no conflation
7. **FAR 0.70%**: "Static classification rate per inference window" — not a post-processed operational rate
8. **Authentication**: State as a known limitation (open API, network-isolation reliance)
9. **Multi-seed**: Do not cite variance figures
10. **Zone UI**: Preset-based, not free-form polygon drawing
11. **Title**: Remove "Prediction"; change "Clinical" to "Simulated Clinical"

### Remaining student-only inputs (not blockers)
SC01–SC10 above — hardware specs, ethics, subject counts, mobile authorship.

**Thesis generation may proceed when the student explicitly requests it.**
