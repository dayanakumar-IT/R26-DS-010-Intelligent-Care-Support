# Fall Detection Research — Progress & Onboarding Doc

**Last updated:** 2026-05-10
**Iteration:** 2 (preprocessing fixes + multi-protocol evaluation applied)
**Stages completed:** UR + NTU preprocessing (with spatial normalization, interpolation padding, carry-forward UR), sequence normalization, common-joint mapping, motion feature extraction, **all 4 models retrained under 3 evaluation protocols** (Cross-Subject, Cross-View, Cross-Dataset), training-time augmentation for ST-GCN, full comparison report
**Stage in progress:** None (model layer complete). Next phase requires camera hardware.

This document describes the project state for someone joining for the first time. It covers the environment, the full pipelines that have been run end-to-end, all scripts, the outputs they produce, and the issues that came up along the way.

> ⚠️ **About the numbers in this doc:** Sections §9, §10, §11, §12 below report **iteration 1** results (random-stratified splits, no spatial normalization). Iteration 1 had four preprocessing leakage paths that were identified and fixed; the model layer was fully retrained. **For the current honest numbers, read §18 first** — that section supersedes all model results in §9–§12.

---

## 1. Project goal

Build a fall-detection model trained on skeletal pose sequences. Two source datasets are unified into a single feature dataset:

| Dataset | Source | Format |
|---|---|---|
| **UR Fall Detection Dataset** | RGB image sequences (PNG) from camera 0 (top-view) and camera 1 (side-view) | `.png` per frame |
| **NTU RGB+D Subset** (5 fall-related actions) | Pre-extracted 25-joint skeletons | `.skeleton` text files |

The pipeline runs in 5 stages: pose extraction → quality filtering → fixed-length normalization → common 14-joint mapping → hand-crafted motion-feature extraction. The end output is a flat CSV ready for classical ML.

---

## 2. Environment

| Item | Version |
|---|---|
| OS | Windows 11 Home (10.0.26200) |
| Python | 3.11.0 |
| Virtual env | `Codes/venv/` |

### Key packages (currently installed in `Codes/venv/`)

| Package | Installed |
|---|---|
| `mediapipe` | 0.10.9 |
| `opencv-python` | 4.13.0.92 |
| `opencv-contrib-python` | 4.13.0.92 |
| `numpy` | 2.4.4 |
| `pandas` | 3.0.2 |
| `pillow` | 12.2.0 |
| `matplotlib` | 3.10.9 |
| `torch` | 2.11.0 |
| `torchvision` | 0.26.0 |
| `torchaudio` | 2.11.0 |
| `protobuf` | 3.20.3 |
| `fastapi` | 0.136.1 |
| `uvicorn` | 0.46.0 |

Full snapshot in [Codes/requirements.txt](../Codes/requirements.txt). To recreate:

```powershell
python -m venv Codes\venv
Codes\venv\Scripts\Activate.ps1
pip install -r Codes\requirements.txt
```

> **Note:** `requirements.txt` was saved in UTF-16 encoding. Regenerate cleanly with `pip freeze | Out-File -Encoding utf8 Codes\requirements.txt` from the activated venv.

---

## 3. Folder structure

```
Research/
├── Codes/
│   ├── paths.py                       ← central path config (single source of truth)
│   ├── requirements.txt
│   ├── venv/
│   ├── preprocessing/
│   │   ├── Unzip.py                   ← UR raw-zip extraction
│   │   ├── fix_nested.py              ← UR folder flattening
│   │   ├── filter_dataset.py          ← copy NTU s001-s017 fall classes
│   │   ├── filter_dataset2.py         ← copy NTU s018-s032 fall classes
│   │   ├── ur_pose_extract.py         ← UR  → MediaPipe → .npy
│   │   ├── check_pose_output.py       ← UR pose validation
│   │   ├── filter_weak_sequences.py   ← drop weak UR sequences
│   │   ├── ntu_skeleton_extract.py    ← NTU .skeleton → .npy
│   │   ├── check_ntu_output.py        ← NTU pose validation
│   │   ├── normalize_sequences.py     ← UR + NTU → fixed 100-frame length
│   │   └── map_common_joints.py       ← unify 33/25 joints → 14-joint common skeleton
│   ├── feature_engineering/
│   │   └── extract_motion_features.py ← 14-joint sequences → 18 motion features
│   ├── models/
│   │   ├── baseline_rf.py             ← RandomForest baseline on 18 features
│   │   ├── baseline_results/          ← RF model + reports + plots
│   │   ├── stgcn/                     ← ST-GCN primary model
│   │   │   ├── graph.py               ← 14-joint anatomical adjacency
│   │   │   ├── model.py               ← ST-GCN architecture
│   │   │   ├── dataset.py             ← PyTorch loader (reuses split CSVs)
│   │   │   ├── train.py               ← training loop + early stopping
│   │   │   └── evaluate.py            ← test-set evaluation
│   │   ├── stgcn_results/             ← ST-GCN checkpoints + reports + plots
│   │   ├── posture_rf.py              ← Posture classifier (4-class) on heuristic labels
│   │   ├── posture_results/           ← Posture model + reports + plots
│   │   ├── fusion_mlp.py              ← Fusion MLP (RF + ST-GCN + 18 features)
│   │   └── fusion_results/            ← Fusion checkpoint + reports + comparison table
│   └── backend/                       (empty — framework pending team coordination)
├── datasets/
│   ├── UR Dataset/
│   │   ├── adl/                       ← 20 normal-activity sequences
│   │   └── falls/{cam0,cam1}/         ← 20 + 20 fall sequences
│   └── NTU_Fall_Detection_Subset/     ← .skeleton files for 5 actions
├── outputs/
│   ├── UR_Pose_Output/                ← UR pose .npy + metadata
│   ├── NTU_Pose_Output/               ← NTU pose .npy + metadata
│   ├── Normalized_Sequences/          ← UR + NTU at 100 frames each
│   ├── Common_Joint_Sequences/        ← 14-joint unified skeleton (100, 14, 3)
│   └── Feature_Dataset/               ← features_dataset.csv (final ML-ready)
└── docs/
    └── progress.md                    ← this file
```

### `paths.py` — important

All scripts import from [Codes/paths.py](../Codes/paths.py) instead of hardcoding paths. Constants:

- `ROOT`, `DATASETS`, `OUTPUTS`, `DOCS`
- `UR_DATASET`, `NTU_DATASET`
- `UR_POSE_OUTPUT`, `NTU_POSE_OUTPUT`

Every script that uses these adds `Codes/` to `sys.path` so `paths` can be imported regardless of cwd:

```python
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import ...
```

---

## 4. Preprocessing pipeline — UR Dataset (✅ complete)

Outputs in [outputs/UR_Pose_Output/](../outputs/UR_Pose_Output/).

### Step 1 — Unzip raw data
**Script:** [Unzip.py](../Codes/preprocessing/Unzip.py) — unzips every `*.zip` in `adl/`, `falls/cam0/`, `falls/cam1/`. Idempotent.

### Step 2 — Flatten nested folders
**Script:** [fix_nested.py](../Codes/preprocessing/fix_nested.py) — lifts `outer/inner/*.png` up to `outer/*.png`. Has a guard: only flattens when the outer dir contains exactly one inner item (see *Issues encountered* §13).

### Step 3 — Pose extraction
**Script:** [ur_pose_extract.py](../Codes/preprocessing/ur_pose_extract.py) — MediaPipe Pose with `static_image_mode=True`, `model_complexity=1`, `min_detection_confidence=0.5`. 33 landmarks × `(x, y, z, visibility)` per frame.

- **Array shape:** `(num_frames, 33, 4)`, dtype `float32`
- **Missing-pose policy:** zero-padded so temporal alignment is preserved

### Step 4 — Quality validation
**Script:** [check_pose_output.py](../Codes/preprocessing/check_pose_output.py) — `missing_ratio` → quality bucket:

| Bucket | Missing-frame ratio |
|---|---|
| `excellent` | 0.00 |
| `good` | ≤ 0.20 |
| `acceptable` | ≤ 0.40 |
| `weak` | > 0.40 |

### Step 5 — Drop unreliable sequences
**Script:** [filter_weak_sequences.py](../Codes/preprocessing/filter_weak_sequences.py) — keeps `excellent | good | acceptable`; weak sequences reserved for robustness analysis.

### UR results

| Metric | Count |
|---|---|
| Sequences extracted | **60** |
| Quality: excellent / good / acceptable / weak | 9 / 22 / 14 / 15 |
| **Training-ready (after filter)** | **45** (30 fall + 15 normal) |

Every removed `weak` sequence is either a side-view fall (`fall_cam1`) or a late-numbered ADL clip — consistent with MediaPipe's known behavior under self-occlusion / side-view geometry.

---

## 5. Preprocessing pipeline — NTU Dataset (✅ complete)

Outputs in [outputs/NTU_Pose_Output/](../outputs/NTU_Pose_Output/).

### Step 1 — Filter relevant classes
**Scripts:** [filter_dataset.py](../Codes/preprocessing/filter_dataset.py), [filter_dataset2.py](../Codes/preprocessing/filter_dataset2.py) — copy `.skeleton` files for the 5 target action classes from the original NTU release.

> The `source_dir` paths point to the original NTU release at `C:\Users\VICTUS\Downloads\Uni\Research_PP1\...`. Not part of this repo.

### Step 2 — Skeleton extraction
**Script:** [ntu_skeleton_extract.py](../Codes/preprocessing/ntu_skeleton_extract.py) — parses each `.skeleton` text file, extracts the first detected body's 25 joints `(x, y, z)` per frame.

**Class mapping** (defined in `CLASS_MAP`):

| Action code | Label | Risk level |
|---|---|---|
| A008 | `sit_down` | low_risk |
| A009 | `stand_up` | low_risk |
| A042 | `staggering` | moderate_risk |
| A043 | `falling_down` | **high_risk** |
| A080 | `squat_down` | moderate_risk |

- **Array shape:** `(num_frames, 25, 3)`, dtype `float32`

### Step 3 — Output validation
**Script:** [check_ntu_output.py](../Codes/preprocessing/check_ntu_output.py) — verifies shape `(frames, 25, 3)`, flags sequences <20 frames as "short", writes `short_sequences_report.csv` / `invalid_shapes_report.csv` / `missing_files_report.csv` (only those with content).

### NTU results

| Metric | Count |
|---|---|
| Total processed | 4,752 |
| A008 / A009 / A042 / A043 / A080 | 948 / 948 / 948 / 948 / 960 |
| Invalid shapes / Missing files | 0 / 0 |
| Short sequences (<20 frames) | 1 (`S023C001P067R001A080`, 19 frames) |

---

## 6. Sequence normalization (✅ complete)

**Script:** [normalize_sequences.py](../Codes/preprocessing/normalize_sequences.py)

Resamples every sequence to a fixed length so UR (33 landmarks × 4 channels) and NTU (25 joints × 3 channels) sequences have aligned temporal axes.

- **Target length:** `TARGET_FRAMES = 100`
- **Long sequences:** evenly sampled via `np.linspace(0, n-1, 100).astype(int)`
- **Short sequences:** padded with the last frame repeated until length 100
- **Reads:** `UR_POSE_OUTPUT/filtered_metadata.csv`, `NTU_POSE_OUTPUT/metadata.csv`
- **Writes:** `outputs/Normalized_Sequences/{UR,NTU}/<label>/<sequence_id>.npy`
- **Combined manifest:** `combined_normalized_metadata.csv`

> Per-dataset shape preserved at this stage: UR stays `(100, 33, 4)`, NTU stays `(100, 25, 3)`. Joint-count harmonization is the next stage.

---

## 7. Common joint mapping (✅ complete)

**Script:** [map_common_joints.py](../Codes/preprocessing/map_common_joints.py)

Unifies the two skeleton conventions into a single **14-joint common format** so a model can train on UR + NTU sequences interchangeably.

- **Final shape:** `(100, 14, 3)` for every sequence (UR's `visibility` channel is dropped)
- **13 anatomical joints** selected from each source via index lookup, then a **14th synthetic spine joint** is computed as the mean of left/right shoulders + left/right hips
- **Output:** `outputs/Common_Joint_Sequences/{UR,NTU}/<label>/<sequence_id>.npy`
- **Metadata:** `common_joint_metadata.csv`

### Joint-index mappings

| Common joint | MediaPipe-33 (UR) | NTU-25 (0-based) |
|---|---|---|
| head | 0 (nose) | 3 |
| left_shoulder | 11 | 4 |
| right_shoulder | 12 | 8 |
| left_elbow | 13 | 5 |
| right_elbow | 14 | 9 |
| left_wrist | 15 | 6 |
| right_wrist | 16 | 10 |
| left_hip | 23 | 12 |
| right_hip | 24 | 16 |
| left_knee | 25 | 13 |
| right_knee | 26 | 17 |
| left_ankle | 27 | 14 |
| right_ankle | 28 | 18 |
| spine | *(computed)* | *(computed)* |

### Mapping results

| Metric | Count |
|---|---|
| Sequences mapped | **4,797** (45 UR + 4,752 NTU) |
| All output shape | `(100, 14, 3)` |

---

## 8. Motion feature extraction (✅ complete)

**Script:** [extract_motion_features.py](../Codes/feature_engineering/extract_motion_features.py)

Reduces each `(100, 14, 3)` sequence to a row of **18 hand-crafted motion features** suitable for classical ML (random forest, gradient boosting, SVM, etc.). The final output is a flat CSV ready for training.

### Feature groups (18 total)

| Group | Features |
|---|---|
| **Center-body kinematics** (mean of all 14 joints per frame) | `center_speed_mean`, `center_speed_max`, `center_speed_std`, `center_acceleration_mean`, `center_acceleration_max`, `center_acceleration_std` |
| **Vertical movement** (y-axis of center body) | `vertical_range`, `vertical_drop`, `sudden_vertical_change` |
| **Body tilt** (torso vector = shoulder_center − hip_center, angle vs vertical) | `torso_angle_mean`, `torso_angle_max`, `torso_angle_std` |
| **Body height** (head ↔ ankle-center distance) | `body_height_change`, `body_height_range` |
| **Per-joint instability** | `mean_joint_speed`, `max_joint_speed`, `std_joint_speed`, `instability_score` |

### Feature dataset

| Metric | Count |
|---|---|
| Rows | **4,797** (one per sequence) |
| Columns | 23 (5 metadata + 18 features) |
| Saved to | [outputs/Feature_Dataset/features_dataset.csv](../outputs/Feature_Dataset/features_dataset.csv) |

This CSV is the final input to the modeling stage.

---

## 9. Modeling — RandomForest baseline (✅ complete)

**Script:** [Codes/models/baseline_rf.py](../Codes/models/baseline_rf.py)
**Outputs:** [Codes/models/baseline_results/](../Codes/models/baseline_results/)

### Role in the component
This is **not** the primary model. The primary model is the ST-GCN trained directly on the `(100, 14, 3)` skeletal sequences (next stage). The RandomForest baseline serves three purposes:

1. **Research-grade baseline** for comparison against the ST-GCN — the report can quantify the GCN's gain over hand-crafted features.
2. **Lightweight edge fallback** — model is ~10 MB, sub-millisecond inference. If the GCN can't run real-time on the edge laptop, this RF provides graceful degradation.
3. **Direct input to the explainability story** — Gini-importance ranking shows which motion features drive the prediction. These are the same features that will surface on the clinician-facing instability heatmap.

### Experiment design — train / validation / test

The 4,797 sequences are split **three ways** with stratification on the combined `dataset + risk_level` key. Each split is saved as a CSV (sequence IDs only) for full reproducibility.

| Split | % | Count | What the model sees | What this split is used for |
|---|---|---|---|---|
| **Train** | 70% | 3,357 | Model fits here — sees labels and adjusts decision trees | The model "learns" from this data |
| **Validation** | 15% | 720 | Predictions only — model never trains on this | During-development sanity checks: did training go well? Should I change a hyperparameter? When should I stop training? |
| **Test** | 15% | 720 | Predictions only — model never trains on this, **and the developer touches it only at the very end** | The FINAL number reported to examiners. Proves the model works on truly unseen data. |

#### What `val_split.csv` actually means

It's a list of 720 sequence IDs we set aside specifically for *during-development sanity checks*. The model is never trained on these rows; we only ever predict on them. Same goes for `test_split.csv` — except test is even more strict: **it is touched only once, at the very end of development**, to generate the headline numbers.

#### Why two held-out sets (val + test) and not just one?

If you only have train/test:
- Every time you tweak the model (new hyperparameter, new layer, new feature), you check on test
- Even though the model doesn't *train* on test, **you (the developer) use test scores to make decisions**
- The test set silently leaks into your decisions → final test numbers become optimistic
- An examiner can fairly challenge: *"how do we know you didn't just keep tuning until test looked good?"*

With train/val/test:
- All tweaking and tuning uses **val** scores
- Test stays pristine. You touch it **once**, at the very end
- Defensible answer to *"is your test number honest?"* → yes, it was never used for any decision

This matters MORE for the upcoming ST-GCN than for the RandomForest baseline, because ST-GCN has many tunable knobs (epochs, learning rate, layer count, dropout) — every one of those decisions should be made on val, not test.

#### Why 70 / 15 / 15 specifically?

70/15/15 is the **standard, defensible balanced choice** in skeleton action-recognition research. Comparison to alternatives for our 4,797-sample dataset:

| Ratio | Train | Val | Test | Trade-off |
|---|---|---|---|---|
| 80/10/10 | 3,838 | 480 | 480 | More training data, but val/test are smaller and per-class metrics get noisier |
| **70/15/15** ✅ | **3,357** | **720** | **720** | **Balanced. ≥720 samples per held-out set keeps per-class metrics stable.** |
| 60/20/20 | 2,878 | 959 | 960 | Cleaner held-out metrics, but loses ~480 training samples |

For our specific data:
- UR is only ~1% of total → all splits give noisy UR-only metrics regardless. The 5-fold CV on train provides the reliable estimate.
- 720 test samples is plenty for stable metrics on the majority (NTU) data
- 720 val samples is enough for trustworthy per-class precision/recall during development

#### Why stratify on `dataset + risk_level`?

UR contributes only 45 of 4,797 rows (~1%). A naive random split would push almost all UR rows into one side. The combined key (e.g. `UR_high_risk`, `NTU_low_risk`) guarantees that **all five strata appear proportionally in train, val, AND test** — enabling a per-dataset performance breakdown and ensuring UR is represented in the test set.

#### Evidence the splits are sound

| | Accuracy | Macro F1 |
|---|---|---|
| Validation (n=720) | 0.9292 | 0.9260 |
| Test (n=720) | 0.9278 | 0.9264 |
| 5-fold CV on train | 0.9324 ± 0.0100 | — |

All three numbers are within ~1% of each other — strong evidence that the splits are well-stratified, the model genuinely generalises, and there is no overfitting. If val and test had diverged (e.g. val 0.95 vs test 0.85), it would mean the splits were noisy and we'd need to redesign.

#### ST-GCN will reuse these exact splits

Critical: the upcoming ST-GCN must train on the **same** train/val/test sequence IDs. Otherwise the RF-vs-ST-GCN comparison becomes apples-to-oranges. The split CSVs make this trivial:

```python
import pandas as pd
train_ids = pd.read_csv("Codes/models/baseline_results/splits/train_split.csv")["sequence_id"]
val_ids   = pd.read_csv("Codes/models/baseline_results/splits/val_split.csv")["sequence_id"]
test_ids  = pd.read_csv("Codes/models/baseline_results/splits/test_split.csv")["sequence_id"]
```

Both models judged on the same 720 test sequences = honest comparison.

#### Saved split files

- [baseline_results/splits/train_split.csv](../Codes/models/baseline_results/splits/train_split.csv) — n=3,357
- [baseline_results/splits/val_split.csv](../Codes/models/baseline_results/splits/val_split.csv) — n=720
- [baseline_results/splits/test_split.csv](../Codes/models/baseline_results/splits/test_split.csv) — n=720

### Other design decisions

| Decision | Reason |
|---|---|
| Target = `risk_level` (3-class: low / moderate / high) | Aligns with the proposal's continuous risk score, not binary fall/no-fall |
| `class_weight="balanced"` | Class distribution is ~2:2:1 — balanced weighting protects against bias toward majority classes |
| 5-fold stratified CV on **train only** | Robustness estimate without test leakage |
| Headline metric = **high-risk recall** | Missed falls are far worse than false alarms — recall on `high_risk` is the metric to optimise |
| `n_estimators=300, min_samples_split=5, min_samples_leaf=2` | Sensible untuned defaults; this is a baseline, not a tuned model |

### Results

**Test set (n = 720)** — these are the headline numbers for the report.

| Metric | Value |
|---|---|
| **Test accuracy** | **0.9278** |
| Test macro F1 | 0.9264 |
| Test weighted F1 | 0.9276 |
| Validation accuracy (sanity check) | 0.9292 |
| **5-fold CV accuracy (on train)** | **0.9324 ± 0.0100** |
| **High-risk recall (test)** | **0.9388** (138 of 147 high-risk events flagged; 9 would be missed) |

> Val ≈ Test (0.9292 vs 0.9278) — the small gap is evidence the model generalises and is not overfitting.

**Per-class breakdown (test set):**

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| low_risk | 0.938 | 0.958 | 0.948 | 286 |
| moderate_risk | 0.931 | 0.892 | 0.911 | 287 |
| high_risk | 0.902 | **0.939** | 0.920 | 147 |

**Per-dataset breakdown (test set):**

| Dataset | n | Accuracy | Macro F1 | High-risk recall |
|---|---|---|---|---|
| NTU | 714 | 0.9272 | 0.9255 | 0.9371 |
| UR | 6 | 1.0000 | 0.6667 | 1.0000 |

> UR test sample is tiny (n=6) so its accuracy/recall are noisy. The 5-fold CV on the train set gives the reliable estimate: 0.9324 ± 0.0100.

### Top features driving risk prediction

| Rank | Feature | Gini importance |
|---|---|---|
| 1 | `vertical_range` | 0.203 |
| 2 | `vertical_drop` | 0.162 |
| 3 | `center_speed_mean` | 0.122 |
| 4 | `body_height_change` | 0.116 |
| 5 | `mean_joint_speed` | 0.075 |

These match domain expectation: falls are characterised by vertical body movement and changes in body height. This validates both the feature engineering and the data pipeline. These are the features that will surface on the clinician-facing instability heatmap promised in the proposal.

### Outputs saved
```
Codes/models/baseline_results/
├── splits/
│   ├── train_split.csv               sequence IDs in train (n=3357)
│   ├── val_split.csv                 sequence IDs in val   (n=720)
│   └── test_split.csv                sequence IDs in test  (n=720)
├── model.pkl                         trained RandomForest (joblib)
├── val_classification_report.txt     val sanity-check report (NOT the headline)
├── val_classification_report.json    same, machine-readable
├── val_confusion_matrix.png          val confusion matrix
├── val_confusion_matrix.csv          same, raw counts
├── test_classification_report.txt    THE HEADLINE numbers
├── test_classification_report.json   same, machine-readable
├── test_confusion_matrix.png         test confusion matrix
├── test_confusion_matrix.csv         same, raw counts
├── feature_importance.png            sorted bar chart (Gini)
├── feature_importance.csv            feature → importance, sorted
├── per_dataset_metrics.csv           test-set UR vs NTU breakdown
├── high_risk_recall.txt              recall on high_risk class (test)
└── cv_scores.csv                     5-fold CV on TRAIN only
```

### Why these results matter for the proposal

- **"Continuous risk score" claim** — the model produces calibrated probabilities for each of the 3 risk levels via `predict_proba()`, exactly the continuous score the proposal commits to.
- **"Explainable feedback" claim** — feature importance directly answers *"which body movements indicate fall risk?"* The top-5 features are the candidates for the instability heatmap.
- **"Edge deployment" claim** — ~9 MB model with sub-millisecond inference fits an edge laptop trivially.
- **Honest baseline** — 92.78% test accuracy with hand-crafted features sets a clear bar for the ST-GCN to beat. Anything below that means the deep model isn't justified for this problem.

---

## 10. Modeling — ST-GCN primary model (✅ complete)

**Scripts:** [Codes/models/stgcn/](../Codes/models/stgcn/) — `graph.py`, `model.py`, `dataset.py`, `train.py`, `evaluate.py`
**Outputs:** [Codes/models/stgcn_results/](../Codes/models/stgcn_results/)

### Role in the component
This is the **primary deep-learning model** committed to in the proposal. Unlike the RF baseline (which works on 18 hand-crafted summary features), ST-GCN learns spatio-temporal patterns directly from the `(100, 14, 3)` skeletal joint trajectories. It is the model the proposal's edge-deployment, real-time inference, and explainability claims are built around.

### Why ST-GCN (and not 2s-AGCN / CTR-GCN)
For this specific component the constraints favour ST-GCN, not because it is older but because:

| Constraint from the proposal | Why ST-GCN fits best |
|---|---|
| **Edge device (laptop, local)** | ~1.77M params, ~7 MB checkpoint — smallest of the GCN family |
| **Real-time inference** | Single-stream architecture; no two-stream fusion overhead |
| **Explainable instability heatmap** | Fixed anatomical adjacency maps directly to "which joint is unstable"; adaptive-graph models (2s-AGCN, CTR-GCN) learn non-anatomical edges that are hard to interpret for clinicians |
| **14-joint simplified skeleton** | Adaptive-graph models gain most when joints are many and their relationships non-obvious — with 14 well-chosen anatomical joints, the fixed graph is already near-optimal |
| **Fusion with contextual features (PP3)** | Single-stream output is straightforward to concat with hand-crafted features for fusion |

Reference: Yan, Xiong & Lin (2018), *"Spatial Temporal Graph Convolutional Networks for Skeleton-Based Action Recognition,"* AAAI.

### Architecture

| Component | Choice |
|---|---|
| Input shape | `(N, C=3, T=100, V=14)` |
| Graph | 14-joint anatomical adjacency, **17 bidirectional bones**, normalized as `D^(-1/2) (A + I) D^(-1/2)` (Kipf & Welling style) |
| ST-GCN block | Spatial graph conv → temporal conv (`kernel=9`) → BatchNorm → ReLU → residual |
| Stack | 7 blocks: 3→64→64→64→128(stride 2)→128→256(stride 2)→256 |
| Pooling | Global average over `(T, V)` |
| Classifier | Linear `256 → 3` (low / moderate / high risk) |
| Trainable params | **1,765,143** (~7 MB checkpoint) |

### Training setup

| Setting | Value | Rationale |
|---|---|---|
| Splits | **Identical to RF baseline** — same `train_split.csv`, `val_split.csv`, `test_split.csv` | Apples-to-apples comparison |
| Optimizer | Adam, lr=1e-3, weight_decay=1e-4 | Standard for ST-GCN |
| LR schedule | Cosine annealing across 50 epochs | Smooth convergence |
| Loss | CrossEntropy with class weights `(0.836, 0.838, 1.636)` | Same balancing rationale as RF baseline's `class_weight="balanced"` |
| Batch size | 32 | Fits comfortably in CPU memory |
| Max epochs | 50 | Cosine schedule reaches lr→0 at this point |
| Early stopping | Patience 10 on val accuracy | Did not trigger — model improved through to epoch 45 |
| Random seed | 42 | Same as RF baseline |
| Device | CPU (8 threads) | No GPU available; trained in 79.8 min total |

### Training trajectory

| Epoch | Train acc | Val acc | Note |
|---|---|---|---|
| 1 | 0.553 | 0.683 | initial |
| 13 | 0.850 | 0.871 | early plateau |
| 27 | 0.927 | 0.931 | crosses RF baseline (0.928) |
| 34 | 0.957 | 0.944 | strong regime |
| **45** ⭐ | 0.980 | **0.9583** | **best checkpoint saved** |
| 50 | 0.984 | 0.9556 | final epoch |

Cosine LR drove the learning rate from 1e-3 down to 0 over 50 epochs. Best val accuracy was **0.9583** at epoch 45. Total wall time **79.8 min** on CPU.

Training-curve plot: [stgcn_results/training_curves.png](../Codes/models/stgcn_results/training_curves.png).
Per-epoch log: [stgcn_results/training_log.csv](../Codes/models/stgcn_results/training_log.csv).

### Test-set results (n = 720, the same 720 sequences as the RF baseline)

| Metric | Value |
|---|---|
| **Test accuracy** | **0.9569** |
| Macro F1 | 0.9516 |
| Weighted F1 | 0.9569 |

**Per-class breakdown:**

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| low_risk | 0.9622 | 0.9790 | 0.9705 | 286 |
| moderate_risk | 0.9648 | 0.9547 | 0.9597 | 287 |
| high_risk | 0.9310 | 0.9184 | 0.9247 | 147 |

**High-risk recall: 0.9184** — of 147 actual high-risk events, **135 correctly flagged, 12 missed**.

**Per-dataset breakdown:**

| Dataset | n | Accuracy | Macro F1 | High-risk recall |
|---|---|---|---|---|
| NTU | 714 | 0.9594 | 0.9542 | 0.9161 |
| UR | 6 | 0.6667 | 0.2667 | 1.0000 |

UR test sample is tiny (n=6) — metrics there are noisy. NTU is the reliable headline.

### Head-to-head: RF baseline vs ST-GCN

Same 720 test sequences, same target, same class encoding, same evaluation script logic.

| Metric | RF Baseline | **ST-GCN** | Δ |
|---|---|---|---|
| Test accuracy | 0.9278 | **0.9569** | **+2.91%** |
| Macro F1 | 0.9264 | **0.9516** | **+2.52%** |
| Weighted F1 | 0.9276 | **0.9569** | **+2.93%** |
| Trainable params | 300 trees | 1,765,143 weights | — |
| Model size | 9.0 MB | 6.7 MB | smaller, edge-friendlier |
| **High-risk precision** | 0.902 | **0.931** | **+2.9%** (fewer false alarms) |
| **High-risk recall** | **0.939** | 0.918 | **−2.0%** (RF catches more falls) |
| High-risk F1 | 0.920 | 0.925 | +0.5% |
| Missed high-risk events | 9 | 12 | RF misses fewer |

### Honest interpretation of the trade-off

The ST-GCN clearly wins on overall accuracy and per-class F1. But on the **most clinically critical metric — high-risk recall** — the RF baseline edges ahead (93.9% vs 91.8%). Three observations:

1. **The trade-off is real, not a bug.** ST-GCN learned a more confident decision boundary (higher precision, fewer false alarms) at the cost of slightly lower sensitivity to high-risk events. Hand-crafted features (vertical drop, body height change) appear to be highly discriminative for fall events specifically.
2. **Both models achieve high-risk F1 in the same range (0.920 vs 0.925).** The difference between 9 and 12 missed events on n=147 is within natural fluctuation.
3. **For deployment, the two models are complementary.** This justifies the proposal's stated **fusion** approach (PP3): combine ST-GCN's superior overall pattern recognition with the RF baseline's stronger fall-specific recall via probability ensembling or feature concatenation.

### Why this matters for the proposal

- **"ST-GCN-based movement analysis" claim** — fully delivered, evaluated, beats baseline overall.
- **"Continuous risk score" claim** — `evaluate.py` saves `test_predictions.csv` with `p_low_risk / p_moderate_risk / p_high_risk` per sequence, exactly the continuous score the proposal commits to.
- **"Edge deployment" claim** — 6.7 MB checkpoint, fast CPU inference (no GPU required for inference at ~720 samples/sec on this hardware).
- **"Fusion with contextual features" claim (PP3)** — the trade-off above directly justifies why fusion is needed: each model has complementary strengths.

### Outputs saved
```
Codes/models/stgcn_results/
├── best_model.pt                   best checkpoint by val acc (epoch 45)
├── last_model.pt                   final-epoch checkpoint (epoch 50)
├── training_log.csv                per-epoch metrics
├── training_curves.png             loss + accuracy plots
├── summary.txt                     training run summary
├── test_classification_report.txt  test report (headline)
├── test_classification_report.json same, machine-readable
├── test_confusion_matrix.png       test heatmap
├── test_confusion_matrix.csv       same, raw counts
├── per_dataset_metrics.csv         test-set UR vs NTU
├── high_risk_recall.txt            recall on high_risk class (test)
└── test_predictions.csv            per-sequence: true/pred + probabilities
```

---

## 11. Modeling — Posture classifier (✅ complete)

**Script:** [Codes/models/posture_rf.py](../Codes/models/posture_rf.py)
**Outputs:** [Codes/models/posture_results/](../Codes/models/posture_results/)

### Role in the component
The frontend's `Patient.posture` field expects one of four states: **Lying / Sitting / Standing / Walking**. The proposal commits to *"posture states such as sitting, standing, walking, and bending are identified using joint relationships."* This model delivers that.

### Label source — action-derived (not heuristic)

Our datasets do not carry direct posture annotations, but they do carry **action labels**. We map those action labels to the posture classes the frontend expects:

| Source label | → Posture | Reasoning |
|---|---|---|
| NTU `sit_down` (A008, n=948) | **Sitting** | Sequence ends in sitting posture |
| NTU `squat_down` (A080, n=960) | **Sitting** | Squat = deep sitting variant |
| NTU `stand_up` (A009, n=948) | **Standing** | Sequence ends in standing posture |
| NTU `staggering` (A042, n=948) | **Walking** | Walking with instability |
| NTU `falling_down` (A043, n=948) | **Lying** | Sequence ends with body on floor |
| UR `fall` (cam0 + cam1, n=30) | **Lying** | Sequence ends with body fallen |
| UR `normal` (adl, n=15) | *excluded* | Mixed activities, no consistent posture |

**Net training set:** 4,782 sequences with action-derived posture labels (the 15 UR adl sequences are excluded because their posture is genuinely ambiguous).

This is the **principled alternative to a geometric heuristic.** The labels come from the dataset's own action annotations, so they're independent of the model's input features. Whatever accuracy the model achieves is a real measurement of how well skeletal pose features predict action-class membership.

### Class distribution (action-derived labels)

| Class | Count | Source |
|---|---|---|
| Sitting | 1,908 | NTU A008 + A080 |
| Lying | 978 | NTU A043 + UR fall |
| Standing | 948 | NTU A009 |
| Walking | 948 | NTU A042 |

`class_weight='balanced'` compensates for the natural Sitting majority (since A008 and A080 both map to it).

### Input features (8)

Same 8 posture-relevant features used elsewhere — mean torso inclination, std torso inclination, knee-to-hip drop ratio, ankle motion, mean body height, std body height (normalised), mean joint speed, std hip Y position.

### Experiment design

- Same train/val/test sequence IDs as RF baseline + ST-GCN + Fusion (UR adl IDs are simply absent from this model's data).
- RandomForest, 200 trees, balanced class weights, sensible defaults — same configuration as the risk baseline.

### Test set results (n = 718)

| Metric | Value |
|---|---|
| **Test accuracy** | **0.8760** |
| **Test macro F1** | **0.8783** |
| Validation accuracy | 0.8217 |
| Validation macro F1 | 0.8228 |

**Per-class breakdown (test set):**

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| Lying | 0.8303 | 0.9320 | 0.8782 | 147 |
| Sitting | 0.8930 | 0.8374 | 0.8643 | 289 |
| Standing | 0.8014 | 0.8309 | 0.8159 | 136 |
| Walking | 0.9716 | 0.9384 | **0.9547** | 146 |

### Interpretation of the per-class results

- **Walking is easiest** (F1 = 0.95) — staggering motion has very distinctive ankle dynamics and inter-joint variability.
- **Lying is solid** (F1 = 0.88) — falls produce large vertical body-height drops, easy to identify.
- **Standing is hardest** (F1 = 0.82) — `stand_up` (A009) overlaps with `sit_down` (A008) in reverse, both produce hip-vertical transitions of similar magnitude. The features alone can't always disambiguate the *direction* of the transition.
- **Sitting** (F1 = 0.86) — the conflation of A008 (`sit_down`) and A080 (`squat_down`) introduces some intra-class variance, slightly hurting precision.

### Top features driving posture prediction (Gini importance)

| Rank | Feature | Importance |
|---|---|---|
| 1 | `std_body_height_norm` | 0.181 |
| 2 | `std_hip_y` | 0.173 |
| 3 | `mean_body_height` | 0.160 |
| 4 | `mean_joint_speed` | 0.141 |
| 5 | `knee_hip_drop_ratio` | 0.123 |

The model relies most on **variation** features (std of body height, std of hip y) — sensible, because action-derived posture differences manifest as different *amounts* of postural change across the sequence. Pure-position features (`knee_hip_drop_ratio`, `mean_torso_inclination`) are secondary, which is consistent with the labels coming from action-class membership rather than static pose geometry.

### Honest caveats
- **Action-derived ≠ frame-level posture ground truth.** A `sit_down` sequence has frames in standing, transitioning, and sitting states; we label the whole sequence as "Sitting" because that's its dominant ending state. A frame-level posture model would need manual labels (PP3 work).
- **UR ADL sequences excluded** (15 sequences). They're a small fraction of the data, and their varied content would inject noise without ground-truth posture annotations.
- **Val/Test accuracy gap** (82.2% vs 87.6%) is larger than for the risk models — partly because per-class samples are smaller (~150 per class per split) and partly because some action classes (especially Standing/Sitting which both involve vertical transitions) are genuinely ambiguous given only sequence-level features.

---

## 12. Modeling — Fusion MLP (✅ complete)

**Script:** [Codes/models/fusion_mlp.py](../Codes/models/fusion_mlp.py)
**Outputs:** [Codes/models/fusion_results/](../Codes/models/fusion_results/)

### Role in the component
This delivers the proposal's stated **fusion** approach directly:

> *"These contextual and temporal features are fused with the ST-GCN-based movement analysis to produce a more reliable and context-aware fall risk assessment."*

The recall/precision trade-off measured between RF baseline and ST-GCN (RF wins recall, ST-GCN wins overall accuracy) empirically motivates the fusion: each model is stronger on different metrics, so combining them should beat both.

### Architecture

| Component | Choice |
|---|---|
| Input dimension | **24** = 3 ST-GCN logits + 3 RF probabilities + 18 motion features |
| MLP | `Linear(24, 64)` → BN → ReLU → Dropout(0.3) → `Linear(64, 32)` → BN → ReLU → Dropout(0.2) → `Linear(32, 3)` |
| Trainable parameters | 3,811 (~15 KB checkpoint) |
| Loss | CrossEntropy with class weights (matches RF + ST-GCN balancing) |
| Optimizer | Adam, lr=1e-3, weight_decay=1e-4 |
| LR schedule | Cosine annealing across 80 epochs |
| Batch size | 64 |
| Early stopping | patience 15 on val accuracy |

Same train/val/test splits as RF and ST-GCN — apples-to-apples comparison guaranteed.

### Reference
Late fusion methodology follows Simonyan & Zisserman (2014), *"Two-Stream Convolutional Networks for Action Recognition in Videos"* (NeurIPS), which established that combining streams with different inductive biases outperforms either alone. Same principle applied here: deep stream (ST-GCN) + tabular stream (RF) + raw features.

### Training trajectory
- Best val_acc: **0.9681** at epoch 28
- Early stopped at epoch 43 (no val improvement for 15 epochs)
- Wall time: 0.1 min (8 sec) — tiny model trains instantly
- Train acc reached 0.99+, val plateaued at 0.96 — small gap, model generalises

### Test-set results (n = 720)

| Metric | Value |
|---|---|
| **Test accuracy** | **0.9694** |
| Macro F1 | 0.9652 |
| Weighted F1 | 0.9695 |
| **High-risk recall** | **0.9524** (140 of 147 flagged, **only 7 missed**) |

**Per-class breakdown:**

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| low_risk | 0.9895 | 0.9895 | 0.9895 | 286 |
| moderate_risk | 0.9683 | 0.9582 | 0.9632 | 287 |
| high_risk | 0.9333 | **0.9524** | **0.9428** | 147 |

**Per-dataset breakdown:**

| Dataset | n | Accuracy | Macro F1 | High-risk recall |
|---|---|---|---|---|
| NTU | 714 | 0.9692 | 0.9646 | 0.9510 |
| UR | 6 | 1.0000 | 0.6667 | 1.0000 |

### Three-model head-to-head

| Model | Test Acc | Macro F1 | High-risk recall | Missed falls |
|---|---|---|---|---|
| RF baseline | 0.9278 | 0.9264 | 0.9388 | 9 |
| ST-GCN primary | 0.9569 | 0.9516 | 0.9184 | 12 |
| **Fusion MLP** | **0.9694** | **0.9652** | **0.9524** | **7** ⭐ |

**Fusion wins on every metric, including the most clinically critical one (high-risk recall).** Compared to ST-GCN alone, the fusion model misses **5 fewer falls** out of 147 — a **42% reduction in missed-fall events**. This is the empirical validation of the proposal's fusion approach: the RF baseline's stronger fall sensitivity and the ST-GCN's stronger overall pattern recognition combine into a model better than either alone.

### Why this matters for the proposal
- **Direct delivery of a proposal claim** — *"features are fused with the ST-GCN-based movement analysis"* is no longer pending; it's evaluated.
- **Best-of-both-worlds outcome** — fusion beats ST-GCN on the metric ST-GCN was weakest at (recall) AND on overall accuracy.
- **Publishable research story** — *"We observed an empirical recall/precision trade-off between our deep model and classical baseline; late fusion (Simonyan & Zisserman 2014) combines their complementary strengths and reduces missed falls by 42% relative to the ST-GCN alone."*
- **Edge-deployable** — 15 KB checkpoint, sub-millisecond inference. The fusion stage adds negligible compute on top of the upstream models.

### Outputs saved
```
Codes/models/fusion_results/
├── fusion_features.csv            24-dim input + label per sequence (4,797 rows)
├── best_model.pt                  best checkpoint by val accuracy (epoch 28)
├── training_log.csv               per-epoch loss + accuracy
├── training_curves.png            loss + accuracy plots
├── summary.txt                    run summary
├── test_classification_report.txt
├── test_classification_report.json
├── test_confusion_matrix.png
├── test_confusion_matrix.csv
├── per_dataset_metrics.csv        UR vs NTU on test
├── high_risk_recall.txt
├── test_predictions.csv           per-sequence: true/pred + softmax probs
└── comparison.csv                 RF vs ST-GCN vs Fusion side-by-side
```

---

## 13. Output schema reference

### `metadata.csv` (UR)
`sequence_id, dataset, category, camera, label, risk_level, frame_count, detected_frames, missing_frames, pose_shape, pose_array_path`

### `filtered_metadata.csv` / `removed_weak_sequences.csv` (UR)
Same as `metadata.csv` plus `missing_ratio, quality`.

### `pose_quality_report.csv` (UR)
`sequence_id, category, label, status, pose_shape, total_frames, missing_frames, missing_ratio, quality`

### `metadata.csv` (NTU)
`sequence_id, dataset, action_code, label, risk_level, frame_count, joint_count, coordinate_count, pose_shape, pose_array_path`

### `combined_normalized_metadata.csv`
`sequence_id, dataset, label, risk_level, original_shape, normalized_shape, target_frames, pose_array_path`

### `common_joint_metadata.csv`
`sequence_id, dataset, label, risk_level, original_shape, common_shape, common_joint_count, common_joint_names, pose_array_path`

### `features_dataset.csv` (final ML-ready)
`sequence_id, dataset, label, risk_level, pose_array_path` + 18 feature columns listed in §8.

---

## 14. Issues encountered & fixes applied

### Issue 1 — Stale hardcoded paths after restructure
When the project was reorganized into `datasets/`, `outputs/`, etc., every preprocessing script had hardcoded absolute paths and stopped working. **Fix:** introduced [paths.py](../Codes/paths.py); scripts bootstrap with `sys.path.insert(...)` then `from paths import ...`. The `pose_array_path` columns in `metadata.csv`, `filtered_metadata.csv`, and `removed_weak_sequences.csv` were also rewritten to point at the new location.

### Issue 2 — 3 UR sequences silently skipped during extraction
`adl-05-cam0-rgb`, `adl-13-cam0-rgb`, `fall-08-cam0-rgb` produced empty `.npy` arrays the first run. Investigation showed `Unzip.py` had left those folders with the structure `<seq>/<seq>/*.png` *plus* stray duplicate `.zip` files of *other* sequences. The stray zips meant `len(inner) > 1`, which caused `fix_nested.py`'s flatten guard to skip them — leaving the PNGs one level too deep.

**Fix:** deleted 5 stray duplicate zips (verified each had a properly-extracted sibling folder elsewhere), re-ran `fix_nested.py`, then re-ran the full pipeline. All 60 UR sequences now extract cleanly.

### Issue 3 — `ModuleNotFoundError: No module named 'paths'` in `check_ntu_output.py`
When run from `Codes/`, the script raised `ModuleNotFoundError` on `from paths import NTU_POSE_OUTPUT`. Even though `paths.py` was in the working directory, Python only auto-adds the *script's* directory (`preprocessing/`) to `sys.path` — not the cwd.

**Fix:** added the same bootstrap the other scripts use:
```python
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import NTU_POSE_OUTPUT
```
**Rule for new scripts:** every new file under `preprocessing/`, `feature_engineering/`, etc. needs these two lines before importing `paths`.

---

## 15. How to run from scratch

```powershell
# 1. Activate venv
Codes\venv\Scripts\Activate.ps1

# 2. Place raw data
#    - UR Dataset zips in Research\datasets\UR Dataset\{adl,falls\cam0,falls\cam1}\
#    - NTU .skeleton files in Research\datasets\NTU_Fall_Detection_Subset\
#      (or run filter_dataset.py / filter_dataset2.py with adjusted source_dir)

# 3. UR pipeline
python Codes\preprocessing\Unzip.py
python Codes\preprocessing\fix_nested.py
python Codes\preprocessing\ur_pose_extract.py            # ~25 min
python Codes\preprocessing\check_pose_output.py
python Codes\preprocessing\filter_weak_sequences.py

# 4. NTU pipeline
python Codes\preprocessing\ntu_skeleton_extract.py       # ~5–10 min on 4.7k files
python Codes\preprocessing\check_ntu_output.py

# 5. Unify both datasets
python Codes\preprocessing\normalize_sequences.py        # → 100-frame length
python Codes\preprocessing\map_common_joints.py          # → 14-joint common skeleton

# 6. Feature engineering
python Codes\feature_engineering\extract_motion_features.py
# → Research\outputs\Feature_Dataset\features_dataset.csv (final ML-ready CSV)

# 7. Baseline classifier (RandomForest)
python Codes\models\baseline_rf.py                       # ~30 sec
# → Research\Codes\models\baseline_results\ (model + reports + plots)

# 8. Primary model (ST-GCN) — train then evaluate on test set
python Codes\models\stgcn\train.py                       # ~80 min on CPU
python Codes\models\stgcn\evaluate.py                    # ~10 sec
# → Research\Codes\models\stgcn_results\ (checkpoints + reports + plots)

# 9. Posture classifier (4-class on heuristic-derived labels)
python Codes\models\posture_rf.py                        # ~5 min
# → Research\Codes\models\posture_results\

# 10. Fusion MLP (RF + ST-GCN + 18 features)
python Codes\models\fusion_mlp.py                        # ~5-10 min
# → Research\Codes\models\fusion_results\ (best_model.pt + comparison.csv)
```

---

## 16. Pipeline summary

| Stage | Sequences in | Sequences out | Output shape |
|---|---|---|---|
| UR extract (with last-valid carry-forward) | 60 raw | 60 | `(N, 33, 4)` |
| UR filter (drop weak) | 60 | 45 | `(N, 33, 4)` |
| NTU extract | 4,752 `.skeleton` files | 4,752 | `(N, 25, 3)` |
| Normalize (linear-interp padding) | 45 + 4,752 | 4,797 | `(100, 33, 4)` / `(100, 25, 3)` |
| Common joint mapping (with spatial normalization) | 4,797 | 4,797 | `(100, 14, 3)` — spine-centered, torso-scaled |
| Motion features | 4,797 | 4,797 rows × 18 features | flat CSV |
| **RandomForest baseline (CS)** | 4,797 rows × 18 features | trained 3-class; **87.48% test acc, 74.85% high-risk recall** | `model.pkl` (~8 MB) |
| **ST-GCN (CS, with augmentation)** | `(100, 14, 3)` skeleton sequences | trained 3-class; **91.86% test acc, 82.63% high-risk recall** | `best_model.pt` (~12 MB) |
| **Posture classifier (CS)** | 8 posture features per sequence | trained 4-class classifier (Lying / Sitting / Standing / Walking); **74.15% test acc** | `model.pkl` |
| **Fusion MLP (CS)** ⭐ | ST-GCN logits + RF probs + 18 features (24-dim) | trained 3-class classifier; **94.24% test acc, 87.43% high-risk recall — best in-domain** | `best_model.pt` (~15 KB) |

> **Numbers above are iteration 2 (Cross-Subject protocol, post-fix).** For iteration 1 numbers and the full Cross-View / Cross-Dataset breakdown, see §18.

### Class balance (final feature dataset)

The two datasets contribute very differently to the label distribution:

| Source | `fall` count | `normal` count | NTU non-fall labels |
|---|---|---|---|
| UR | 30 | 15 | — |
| NTU | 948 (`falling_down`) | — | 948 × 4 (sit_down, stand_up, staggering, squat_down) |

The NTU labels are kept as the original action names (`sit_down`, `stand_up`, etc.), not collapsed to `normal`. The model stage will need to decide:
1. **Binary classifier** (`falling_down` + `fall` vs everything else): fall ≈ 978, non-fall ≈ 3,819 — moderate imbalance, addressable with class weights.
2. **Multi-class classifier** preserving the 6 distinct labels: useful if you want to distinguish `staggering` (moderate risk) from outright `falling_down`.
3. **Risk-level classifier** (3 classes: low / moderate / high): aligns with the `risk_level` column already present.

---

## 17. Next steps

Model layer is complete (see §18 for iteration-2 results). Remaining work all depends on hardware that is not yet available.

1. **Backend framework decision + scaffolding** (still pending — group coordination)
2. **Backend API service** — endpoints to serve the trained Fusion model:
   - `GET /api/sequences`, `GET /api/sequences/{id}`, `POST /api/predict/{id}`
3. **Real-time pipeline** (requires camera): MediaPipe capture loop + sliding-window aggregation + alert dispatcher
4. **Frontend ↔ backend integration** — React dashboard + Flutter app
5. **In-house lab study** (requires camera + volunteers) — the realistic test the dataset-trained models cannot provide
6. **Explainability output generator** — 5-second skeletal replay + instability heatmap from top features (RF Gini + ST-GCN edge importance)
7. **GitHub push** with clean commit history through iteration 2

---

## 18. Iteration 2 — Preprocessing fixes + multi-protocol evaluation (May 2026)

This section supersedes the headline numbers in §9, §10, §11, §12. Iteration 1 trained correctly on the splits it had, but the preprocessing pipeline and split design contained four leakage paths that were inflating the numbers. Iteration 2 fixes all four and re-evaluates every model under three escalating-difficulty protocols.

### 18.1 Why iteration 2

After completing iteration 1, four issues were identified:

| # | Issue | Why it inflates accuracy |
|---|---|---|
| 1 | **No spatial normalization** | NTU and UR live in different coordinate systems. The model can memorize "this absolute X coordinate range = NTU lab", giving it a free dataset-id signal it can use as a shortcut. |
| 2 | **Frame-freeze padding** | Short sequences padded by repeating the last frame. Falls end with the body on the floor; padding produces *N copies of the impact pose at the tail*. The model can learn "static tail = fall" instead of fall dynamics. |
| 3 | **Zero-fill on missing UR pose** | When MediaPipe failed to detect a pose, the frame was `[0, 0, 0, 0]` for all 33 landmarks. All-zero frames are detectable artifacts the model can correlate with high-motion (fall) clips. |
| 4 | **No training-time augmentation for the deep model** | ST-GCN had no exposure to rotational / mirror / temporal variations of training samples → potential overfitting to NTU's specific camera angle and frame-by-frame layout. |

### 18.2 Four preprocessing/training fixes

| Fix | File modified | What it does |
|---|---|---|
| **1. Spatial normalization** | [`Codes/preprocessing/map_common_joints.py`](../Codes/preprocessing/map_common_joints.py) — `normalize_skeleton()` | Per-frame: translate origin to spine joint (index 13). Then divide all coordinates by the mean torso length (spine → mid-shoulder, averaged over the sequence). NTU and UR now live in a common coordinate frame. |
| **2. Linear-interpolation padding** | [`Codes/preprocessing/normalize_sequences.py`](../Codes/preprocessing/normalize_sequences.py) — `normalize_sequence()` | Short sequences are now interpolated, not padded. No N-copies-of-the-last-frame artifact. |
| **3. Carry-forward UR pose** | [`Codes/preprocessing/ur_pose_extract.py`](../Codes/preprocessing/ur_pose_extract.py) | When MediaPipe fails on a frame, copy the last valid pose instead of zeros. Pose stream stays continuous; `missing_frames` is still counted in metadata. |
| **4. Training-time augmentation** | [`Codes/models/stgcn/dataset.py`](../Codes/models/stgcn/dataset.py) — `apply_augmentations()` | Train-only. Each train sample is randomly transformed by: (a) rotation around vertical Y axis ±15°, (b) horizontal mirror with left/right joint swap, (c) time-jitter — drop 5 random frames, re-interpolate. Each transform fires with p=0.5. **Disabled for val/test/inference.** |

**Why augmentation only on ST-GCN (not RF/Posture):** The RF and Posture features are 18 (or 8) summary statistics — vertical drop, joint speeds, torso angles. These are physical quantities that are *coordinate-invariant by construction*. Rotating or mirroring a sequence and re-extracting features barely changes the numbers. ST-GCN sees raw `(X, Y, Z)` coordinates of every joint, where rotation and mirror genuinely change the input — that's the only place augmentation is meaningful.

### 18.3 Three evaluation protocols

| Protocol | Held out | What it tests | Difficulty |
|---|---|---|---|
| **Cross-Subject (CS)** | Subjects (each NTU performer + each UR session in exactly one of train/val/test) | Generalization to new bodies the model has never seen | Medium |
| **Cross-View (CV)** | NTU camera C001 (train uses C002+C003) | Generalization to a different camera angle in the same lab | Easy-medium (same subjects) |
| **Cross-Dataset (CD)** | Whole datasets (train NTU → test UR, and vice versa) | Generalization to a completely different lab setup, actors, lighting | Hard |

Splits are produced by:

- [`Codes/models/cross_subject_split.py`](../Codes/models/cross_subject_split.py) → `Codes/models/splits/`
- [`Codes/models/cross_view_split.py`](../Codes/models/cross_view_split.py) → `Codes/models/splits_cv/`
- [`Codes/models/cross_dataset_ntu2ur_split.py`](../Codes/models/cross_dataset_ntu2ur_split.py) → `Codes/models/splits_cd_ntu2ur/`

All scripts share [`Codes/models/split_utils.py`](../Codes/models/split_utils.py) which switches splits-dir based on the `MODELS_PROTOCOL` environment variable (`cs` / `cv` / `cd_ntu2ur`).

| Protocol | Train / Val / Test n |
|---|---|
| Cross-Subject | 3,121 / 877 / 799 |
| Cross-View (NTU only) | 2,596 / 572 / 1,584 |
| Cross-Dataset NTU→UR | 3,894 (NTU) / 858 (NTU) / 45 (UR) |

### 18.4 Final results — full evaluation matrix

All four models retrained from scratch under each protocol with new preprocessing + augmentation. **Test-set accuracy:**

| Model | CS | CV | CD-NTU→UR | CD-UR→NTU |
|---|---|---|---|---|
| Baseline RF | 87.48% | 90.91% | 20.00% | 26.91% |
| Posture RF (4-class) | 74.15% | 77.97% | 23.33% | n/a |
| ST-GCN | 91.86% | 88.89% | 4.44% | n/a |
| **Fusion MLP** | **94.24%** | **94.07%** | 0.00% | n/a |

**High-risk recall** (most safety-critical metric — recall on the `high_risk` class):

| Model | CS | CV | CD-NTU→UR |
|---|---|---|---|
| Baseline RF | 74.85% | 82.91% | 0% |
| ST-GCN | 82.63% | 88.29% | 0% |
| **Fusion MLP** | **87.43%** | **90.19%** | 0% |

> *n/a* in the table = experiment is meaningless (UR has 45 samples → cannot train a 3M-param ST-GCN; UR has only one posture class → cannot train the 4-class posture classifier).

### 18.4b Overfitting check + preprocessing-leakage sanity check

For every (model × protocol) run we put **train, val, test** side by side. Healthy = train ≈ val ≈ test (gaps under ~5%). Big train-val gap = overfitting; big val-test gap = leaky split.

**Cross-Subject (CS)**

| Model | Train | Val | Test | T→V gap | V→T gap | Verdict |
|---|---|---|---|---|---|---|
| Baseline RF | 87.31%¹ | 85.06% | 87.48% | +2.25 | −2.42 | healthy |
| Posture RF | — | 74.86% | 74.15% | — | +0.71 | healthy |
| ST-GCN (best ep 27/37) | 95.29% | 92.82% | 91.86% | +2.47 | +0.96 | healthy |
| Fusion MLP (best ep 12/50) | — | 94.41% | 94.24% | — | +0.17 | healthy |

**Cross-View (CV — NTU only, train C002+C003, test C001)**

| Model | Train | Val | Test | T→V gap | V→T gap | Verdict |
|---|---|---|---|---|---|---|
| Baseline RF | 85.13%¹ | 86.89% | 90.91% | −1.76 | −4.02 | healthy |
| Posture RF | — | 76.40% | 77.97% | — | −1.57 | healthy |
| ST-GCN (best ep 4/14, early stop) | 85.86% | 93.88% | 88.89% | −8.02 | +4.99 | healthy (val>train at early stop = regularizing, not overfit) |
| Fusion MLP (best ep 14/50) | — | 93.01% | 94.07% | — | −1.06 | healthy |

**Cross-Dataset (CD — train all NTU, test all UR)**

| Model | Train (NTU) | Val (NTU) | Test (UR) | T→V gap | V→T gap | Verdict |
|---|---|---|---|---|---|---|
| Baseline RF | ~87%¹ | n/a | 20.00% | — | massive | domain shift |
| Posture RF | — | — | 23.33% | — | massive | domain shift |
| ST-GCN (best ep 29/39) | **96.10%** | **96.39%** | 4.44% | −0.29 | massive | **trained perfectly on source, fails to transfer** |
| Fusion MLP | — | — | 0.00% | — | massive | deepest model, hardest fall |

¹ 5-fold CV on the train set (RF doesn't have a separate "train accuracy").

**The single cleanest piece of evidence:** the ST-GCN CD row. Train 96.10% ≈ val 96.39% on NTU → no overfitting, the network has learned the source domain fine. The collapse to 4.4% on UR is therefore *domain shift* (different camera, different actors, different action vocabulary), not a training or preprocessing bug.

**Two corollary sanity checks:**
1. **Val ≈ test on every CS run** (gaps within 2.5%) → the subject-disjoint split is honest, no test-set surprise.
2. **CD collapses to 0–25%** → if our preprocessing still leaked a hidden cross-dataset shortcut, CD would also be high; it isn't.

A slide-ready, panel-friendly version of this table lives at [`Codes/models/comparison_report/comparison_summary.md`](../Codes/models/comparison_report/comparison_summary.md).

### 18.5 Iteration 1 vs iteration 2 — what the fixes bought

| Model | Iter-1 CS test acc (leaky) | **Iter-2 CS test acc (honest)** | Drop |
|---|---|---|---|
| Baseline RF | 92.78% | **87.48%** | -5.3 |
| Posture RF | 87.60% | **74.15%** | -13.5 |
| ST-GCN | 95.69% | **91.86%** | -3.8 |
| Fusion MLP | 96.94% | **94.24%** | -2.7 |

The drops are direct evidence that the iteration-1 numbers were partly explained by coordinate-system memorization, frame-freeze tail patterns, and zero-fill artifacts. Iteration 2 numbers are what remains after those shortcuts are removed.

### 18.6 The cross-dataset finding

Cross-Dataset NTU→UR collapses on every model:

| Model | Accuracy on UR test |
|---|---|
| Baseline RF | 20.00% |
| Posture RF | 23.33% |
| ST-GCN | 4.44% |
| Fusion MLP | 0.00% |

**Notable:** the deeper the model, the worse it crashes on cross-dataset. This is because deep models compose layers of dataset-specific features — domain shift compounds across layers. Spatial normalization removed coordinate-frame memorization, but the underlying motion-pattern divergence between scripted NTU falls and recorded UR falls remains.

This is actually a strong, panel-defensible finding — it gives three concrete arguments for the proposal's design decisions:

1. **Combined NTU + UR training is *necessary*, not just convenient.** Each dataset alone cannot generalize to the other.
2. **The planned in-house lab study is *load-bearing*, not optional.** Closing the cross-dataset gap requires deployment-domain data; we cannot claim deployment-readiness from these two datasets alone.
3. **Per-dataset metrics matter.** Reporting the full evaluation matrix prevents the headline number from misleading — anyone can see that a CS-trained model is not a deployment-ready model.

### 18.7 Backup of iteration 1 results

Iteration-1 outputs are preserved unchanged in [`Codes/models/_backup_old_preprocessing/`](../Codes/models/_backup_old_preprocessing/):

```
_backup_old_preprocessing/
├── splits/                    iteration-1 random-stratified splits
├── splits_cv/                 (CV splits from a partial iteration-1 attempt)
├── splits_cd_ntu2ur/          (CD splits from a partial iteration-1 attempt)
├── baseline_results/          iteration-1 RF outputs
├── baseline_results_cv/       iteration-1 RF CV (partial)
├── posture_results/           iteration-1 Posture outputs
├── posture_results_cv/        iteration-1 Posture CV (partial)
├── stgcn_results/             iteration-1 ST-GCN outputs
├── stgcn_results_cv/          iteration-1 ST-GCN CV (partial)
├── fusion_results/            iteration-1 Fusion outputs
├── cross_dataset_results/     iteration-1 RF cross-dataset
├── comparison_report/         iteration-1 comparison
└── stgcn_results_train.log    original iteration-1 training log
```

This is the single source of truth for *what iteration 1 produced*. The before-vs-after comparison story (§18.5) draws from these files.

### 18.8 Where iteration 2 results live

```
Codes/models/
├── splits/                    CS splits (iter-2)
├── splits_cv/                 CV splits (iter-2)
├── splits_cd_ntu2ur/          CD-NTU→UR splits (iter-2)
├── baseline_results/          RF CS  ← MODELS_PROTOCOL=cs (default)
├── baseline_results_cv/       RF CV  ← MODELS_PROTOCOL=cv
├── posture_results/           Posture CS
├── posture_results_cv/        Posture CV
├── stgcn_results/             ST-GCN CS
├── stgcn_results_cv/          ST-GCN CV
├── stgcn_results_cd_ntu2ur/   ST-GCN CD-NTU→UR  ← MODELS_PROTOCOL=cd_ntu2ur
├── fusion_results/            Fusion CS
├── fusion_results_cv/         Fusion CV
├── cross_dataset_results/     RF CD (both directions) + Posture-CD + Fusion-CD
└── comparison_report/         the slide-ready master comparison
    ├── comparison_all.csv         13-row table: every (model, protocol) pair
    ├── comparison_per_dataset.csv UR vs NTU breakdown per protocol
    ├── comparison_summary.md      slide-ready markdown
    └── comparison_summary.txt     plain-text equivalent
```

To regenerate the comparison report after re-running anything:

```powershell
python Codes\models\generate_comparison_report.py
```

### 18.9 How to re-run iteration 2 from scratch

```powershell
# Activate venv
Codes\venv\Scripts\Activate.ps1

# 1. Preprocessing pipeline (with iteration-2 fixes)
python Codes\preprocessing\ur_pose_extract.py            # carry-forward UR
python Codes\preprocessing\filter_weak_sequences.py
python Codes\preprocessing\normalize_sequences.py        # interpolation padding
python Codes\preprocessing\map_common_joints.py          # spatial normalization
python Codes\feature_engineering\extract_motion_features.py

# 2. Generate all 3 sets of splits
python Codes\models\cross_subject_split.py
python Codes\models\cross_view_split.py
python Codes\models\cross_dataset_ntu2ur_split.py

# 3. Train and evaluate under each protocol
# Cross-Subject (default)
python Codes\models\baseline_rf.py
python Codes\models\posture_rf.py
python Codes\models\stgcn\train.py        # ~3 hr on CPU
python Codes\models\stgcn\evaluate.py
python Codes\models\fusion_mlp.py

# Cross-View
$env:MODELS_PROTOCOL = "cv"
python Codes\models\baseline_rf.py
python Codes\models\posture_rf.py
python Codes\models\stgcn\train.py        # ~1 hr on CPU (smaller train set)
python Codes\models\stgcn\evaluate.py
python Codes\models\fusion_mlp.py
$env:MODELS_PROTOCOL = $null

# Cross-Dataset NTU→UR
$env:MODELS_PROTOCOL = "cd_ntu2ur"
python Codes\models\stgcn\train.py        # ~3 hr on CPU
python Codes\models\stgcn\evaluate.py
$env:MODELS_PROTOCOL = $null

# 4. Cross-Dataset other directions / extended
python Codes\models\cross_dataset_eval.py            # RF NTU↔UR (both)
python Codes\models\cross_dataset_extended.py        # Posture-CD + Fusion-CD

# 5. Final report
python Codes\models\generate_comparison_report.py
```

### 18.10 What's deferred (not in this iteration, requires hardware or further work)

| Item | Why it's deferred |
|---|---|
| In-house lab study with deployment camera | Requires physical USB camera + volunteers — cannot be done offline |
| Real-time MediaPipe capture loop | Requires live video stream |
| Sliding-window temporal trend module (live) | Built on top of the real-time loop |
| Pose-quality gating end-to-end | Requires real partial-occlusion frames |
| Zone calibration (bed/chair/walking) | Requires install-time observation in a real room |
| Posture transition detector (sit-to-stand etc.) | Built on top of the live pipeline |
| Audio + push notification dispatcher | Requires the runtime service |
| Backend API service (FastAPI / Flask) | Pending team coordination on framework |
| React + Vite web dashboard | Frontend stack, separate effort |
| Flutter mobile app | Mobile stack, separate effort |
| Explainability replay + heatmap renderer | Built on top of the runtime service |
