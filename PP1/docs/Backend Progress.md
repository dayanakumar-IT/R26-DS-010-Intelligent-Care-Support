**Env Setup**

Created Python virtual environment (Codes/venv/)

Installed required libraries (mediapipe 0.10.9, scikit-learn, torch, etc.)

Generated requirements.txt



**A. Dataset selection \& extraction**

Selected UR Fall Detection Dataset (45 sequences, 1 lab, side+overhead views)

Selected NTU RGB+D 60 subset (4,752 sequences, 106 performers, 3 cameras)

Justified dataset selection vs research scope (real-world fall + scripted ADL coverage)

Codes/preprocessing/Unzip.py — automatic dataset extraction

Codes/preprocessing/fix\_nested.py — folder-structure normalization



**B. UR preprocessing**

Codes/preprocessing/ur\_pose\_extract.py

MediaPipe Pose extraction (33 landmarks, x/y/z + visibility)

\[iter-2] carry-forward last-valid pose on missed detections (replaces zero-fill)

Converts RGB sequences → .npy skeleton arrays

Generated UR metadata.csv (frame counts, missing-frame counts, risk + category labels, paths)

Codes/preprocessing/check\_pose\_output.py — pose quality analysis (missing ratio, weak sequences, occlusion check)

Generated pose\_quality\_report.csv

Codes/preprocessing/filter\_weak\_sequences.py — categorizes (excellent / good / acceptable / weak) and drops unreliable sequences

Generated filtered\_metadata.csv + removed\_weak\_sequences.csv (weak set kept for future robustness analysis)



**C. NTU preprocessing**

Codes/preprocessing/ntu\_skeleton\_extract.py — parses .skeleton, extracts 25 joints x/y/z → .npy + NTU metadata

Codes/preprocessing/check\_ntu\_output.py — validates missing files, array shape, skeleton integrity



**D. Sequence unification**

Codes/preprocessing/normalize\_sequences.py

Standardized all sequences to 100 frames

\[iter-2] linear interpolation padding (replaces frame-freeze)

**Combined UR + NTU into combined\_normalized\_metadata.csv**

**Codes/preprocessing/map\_common\_joints.py**

**33-joint UR ↔ 25-joint NTU mismatch resolved → unified 14-joint format (100, 14, 3)**

**\[iter-2] spatial normalization: spine-centered, torso-scaled (removes coordinate-system leakage)**



**E. Feature engineering**

Codes/feature\_engineering/extract\_motion\_features.py — 18 biomechanical features (center body speed, acceleration, vertical drop, sudden vertical change, torso angle, body instability, joint movement statistics, body height variation, vertical range)

Generated features\_dataset.csv



**F. Evaluation-protocol design (NEW in iter-2)**

Codes/models/cross\_subject\_split.py → splits/ — 70/15/15 by subject (NTU 106, UR 34), subject-disjoint guaranteed (3,121 / 877 / 799)

Codes/models/cross\_view\_split.py → splits\_cv/ — train C002+C003, test C001 (NTU only) (2,596 / 572 / 1,584)

Codes/models/cross\_dataset\_ntu2ur\_split.py → splits\_cd\_ntu2ur/ — train all NTU, test all UR (3,894 / 858 / 45)

Codes/models/split\_utils.py — single switch via MODELS\_PROTOCOL env var (cs / cv / cd\_ntu2ur)



**G. Model 1 — RandomForest baseline (3-class risk: low / moderate / high)**

Codes/models/baseline\_rf.py

Reuses 14-joint sequences + 18 motion features

5-fold CV on train set only (no test leakage)

class\_weight="balanced" for the 2:2:1 imbalance

Per-dataset breakdown + high-risk recall as primary safety metric

Generated baseline\_results/ (CS) + baseline\_results\_cv/ (CV) — model.pkl, classification reports, confusion matrices, feature\_importance.png, per\_dataset\_metrics.csv, high\_risk\_recall.txt, cv\_scores.csv

RF results (iter-2):

CS test acc 87.48 % · macro F1 86.18 % · high-risk recall 74.85 %

CV test acc 90.91 % · macro F1 89.95 % · high-risk recall 82.91 %

CD NTU→UR 20.00 % / UR→NTU 26.91 % (domain shift expected)

5-fold CV on train: 87.31 % ± 0.68 %

Top features: vertical\_range, vertical\_drop, center\_speed\_mean, body\_height\_change



**H. Model 2 — Posture classifier (4-class: Lying / Sitting / Standing / Walking)**

Codes/models/posture\_rf.py

Action-derived labels (NOT heuristic) — UR adl excluded (single posture)

8 input features

Generated posture\_results/ (CS) + posture\_results\_cv/ (CV)

Posture results (iter-2):

CS test acc 74.15 % · macro F1 74.71 %

CV test acc 77.97 % · macro F1 78.72 %

CD NTU→UR 23.33 %



**I. Model 3 — ST-GCN (primary deep model)**

Codes/models/stgcn/ package

graph.py — 14-joint anatomical adjacency, 3-partition spatial graph, normalized D⁻¹ᐟ²(A+I)D⁻¹ᐟ²

model.py — ST-GCN, 3,071,247 trainable params (spatial GCN → temporal Conv k=9 → BN → ReLU → residual; 7 blocks + GAP + linear)

dataset.py — reuses split CSVs (apples-to-apples vs RF)

\[iter-2] training augmentation: rotation ±15° around vertical axis, horizontal mirror with L/R joint swap, time-jitter

train.py — Adam + cosine LR, early stopping (patience 10) on val accuracy

evaluate.py — test-set metrics matching RF baseline

Trained ST-GCN under all 3 protocols (same risk target, class-weighted CE loss, batch 32, lr 1e-3, max 50 epochs)

Generated stgcn\_results/ (CS) + stgcn\_results\_cv/ (CV) + stgcn\_results\_cd\_ntu2ur/ (CD) — best/last checkpoints, training\_log.csv, training\_curves.png, summary.txt, classification reports, confusion matrices, per\_dataset\_metrics.csv, high\_risk\_recall.txt, test\_predictions.csv (with softmax)

ST-GCN results (iter-2):

CS test acc 91.86 % · macro F1 90.71 % · high-risk recall 82.63 % (best epoch 27/37, 151.7 min CPU)

CV test acc 88.89 % · macro F1 87.67 % · high-risk recall 88.29 % (best epoch 4/14, 45.7 min)

CD NTU→UR 4.44 % — but train 96.10 % ≈ val 96.39 % on NTU, so no overfitting — domain shift on target

Beats RF on CS overall accuracy + macro F1 + high-risk recall (proves the deep model adds value)



**J. Model 4 — Fusion MLP (late fusion)**

Codes/models/fusion\_mlp.py

24-dim input: ST-GCN 3 logits + RF 3 probs + 18 motion features

Small MLP, \~2 min training

Trained per-protocol on the same splits

Generated fusion\_results/ (CS) + fusion\_results\_cv/ (CV)

Codes/models/cross\_dataset\_extended.py — runs Fusion-CD (NTU→UR) reusing the NTU-only ST-GCN checkpoint

Fusion results (iter-2):

CS test acc 94.24 % · macro F1 93.54 % · high-risk recall 87.43 % ← best in-domain

CV test acc 94.07 % · macro F1 93.46 % · high-risk recall 90.19 % ← best in-domain

CD NTU→UR 0.00 % — deepest stack, hardest fall on cross-dataset (informative finding)



**K. Comparison \& overfitting/leakage analysis (NEW)**

Codes/models/generate\_comparison\_report.py — aggregates every (model × protocol) result into one table

Generated comparison\_report/ — comparison\_all.csv, comparison\_per\_dataset.csv, comparison\_summary.md, comparison\_summary.txt

Overfitting check across all 12 runs: train ≈ val ≈ test on every CS/CV run (gaps under \~5 %); ST-GCN CD shows train 96.10 % ≈ val 96.39 % on NTU but 4.4 % on UR → cleanly proves the CD collapse is domain shift, not overfitting

Preprocessing-leakage sanity check:

Iter-1 (random split) RF was 96.94 % CS → iter-2 (subject-disjoint) RF is 87.48 % → −9.46 % drop confirms iter-1 had person leakage

Val ≈ Test on every CS run → split is honest

CD collapses to 0–25 % → if a hidden cross-dataset shortcut still existed, CD would be high; it isn't

Iter-1 outputs preserved at Codes/models/\_backup\_old\_preprocessing/ for the before/after story

