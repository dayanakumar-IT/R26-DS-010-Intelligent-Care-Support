# Training Protocol

The exact recipe that `train.py` and `train_classifier.py` must
implement once the P0 fixes are applied.

## Splits

- 70 % train / 15 % val / 15 % test, **stratified** on the binary label.
- Persist indices to:
  - `data/processed/train_idx.npy`
  - `data/processed/val_idx.npy`
  - `data/processed/test_idx.npy`
- Test indices are written **once** and reused. Never tune anything on
  the test set.

For the subject-disjoint robustness run (P1-4), use NTU subject IDs
(`PXXX` in the filename) to define the split.

## Preprocessing pipeline

1. Load combined `[ntu_data, ur_data]` skeletons of shape
   `(N, 90, 14, 3)`.
2. Load combined 18-feature matrix `(N, 18)`.
3. Fit `StandardScaler` on the **training** rows of the feature matrix;
   transform all rows.
4. Save the scaler to `models/saved/feature_scaler.joblib`.
5. Wrap with `MultimodalFallDataset(skeletons, scaled_features,
   labels, train=True/False)`.

## Augmentation (training only)

Applied **inside** `Dataset.__getitem__` when `train=True`:

- `random_temporal_jitter(seq, max_pct=0.1)` — re-sample 90 evenly
  spaced frames from a slightly stretched/squashed timeline.
- `random_lr_flip(seq, p=0.5)` — swap the L/R joint pairs.
- `gaussian_joint_noise(seq, sigma=0.01)`.
- `random_yaw_rotation(seq, max_deg=10)`.

The handcrafted features must be **recomputed** after augmentation to
stay consistent with the deep branch — do this inside `__getitem__`.

## Class weights

```python
n_normal, n_fall = (labels == 0).sum(), (labels == 1).sum()
w = torch.tensor([n_fall, n_normal], dtype=torch.float32)
w = w / w.sum() * 2.0          # normalised so mean weight ≈ 1.0
criterion = nn.CrossEntropyLoss(weight=w.to(device))
```

## Optimiser & schedule

- `optim.AdamW(params, lr=3e-4, weight_decay=1e-4)`.
- `CosineAnnealingLR(T_max=epochs)`.
- Batch size 32.
- Up to 60 epochs.
- Gradient clip at norm 1.0.

## Early stopping

- Metric: **macro-F1** on val.
- Patience: 10 epochs.
- Save the *best* (not the latest) checkpoint to
  `models/saved/<name>_best.pth`.

## Metrics to log every epoch

- Train loss, train accuracy.
- Val loss, val accuracy, val **macro-F1**, **fall-recall**,
  **fall-precision**, val ROC-AUC.
- Time per epoch.

Use a simple CSV at `models/saved/train_log.csv` plus stdout.

## Calibration (after training)

Run on val:

```python
T = optimize_temperature(logits_val, y_val)   # 1-D LBFGS on NLL
torch.save({"T": T}, "models/saved/temperature.pt")
```

Apply `softmax(logits / T)` at inference.

## Evaluation (`src/evaluate.py`)

Load:
- `stgcn_best.pth`, `classifier_best.pth`, `fusion_best.pth`,
- `feature_scaler.joblib`, `temperature.pt`,
- test split indices.

Report for each of the three model variants (ST-GCN-only, classifier,
fusion):

1. Confusion matrix.
2. Classification report (precision/recall/F1 per class, macro).
3. ROC-AUC and PR-AUC.
4. Operating-point table: precision @ recall = 0.90 / 0.95 / 0.99 and
   recall @ precision = 0.85 / 0.90.
5. Cross-dataset row (NTU-train → UR-test) for the fusion model.
6. Median + p95 inference latency for one window on CPU.

Write a one-page Markdown summary to `models/saved/eval_report.md`.

## Reproducibility

- Set `torch.manual_seed(42)`, `np.random.seed(42)`,
  `random.seed(42)`, and `torch.backends.cudnn.deterministic = True`.
- Pin all package versions in `requirements.txt`.
