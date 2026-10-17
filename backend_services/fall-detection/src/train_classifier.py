# backend/src/train_classifier.py
"""Trains the feature-only classifier (the physics branch)."""
import os
import csv
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import precision_recall_fscore_support

from config.settings import (
    MODELS_DIR,
    BATCH_SIZE,
    LEARNING_RATE,
    WEIGHT_DECAY,
    MAX_EPOCHS,
    EARLY_STOPPING_PATIENCE,
    SEED,
)
from src.models.classifier import FeatureClassifier
from src.data_splits import (
    load_combined_dataset,
    build_or_load_splits,
    build_or_load_subject_disjoint_splits,
    load_ntu_subjects_padded,
    fit_and_save_scaler,
    compute_class_weights,
)
from src.train import set_seed


def evaluate(model, loader, device, criterion):
    model.eval()
    total_loss, total = 0.0, 0
    all_pred, all_true = [], []
    with torch.no_grad():
        for ph, lb in loader:
            ph, lb = ph.to(device), lb.to(device)
            logits = model(ph)
            loss = criterion(logits, lb)
            total_loss += float(loss.item()) * ph.size(0)
            total += ph.size(0)
            all_pred.extend(torch.argmax(logits, 1).cpu().tolist())
            all_true.extend(lb.cpu().tolist())
    prec, rec, f1, _ = precision_recall_fscore_support(
        all_true, all_pred, labels=[0, 1], zero_division=0
    )
    return {
        "loss": total_loss / max(total, 1),
        "macro_f1": float(np.mean(f1)),
        "fall_recall": rec[1],
        "fall_precision": prec[1],
    }


def main(split_mode: str = None, seed: int = None, checkpoint_suffix: str = ""):
    if split_mode is None:
        split_mode = os.environ.get("FALLRISK_SPLIT", "random")
    if seed is None:
        seed = int(os.environ.get("FALLRISK_SEED", SEED))
    set_seed(seed)
    print("=" * 65)
    print(f"       FEATURE-ONLY CLASSIFIER TRAINING  split={split_mode}  seed={seed}")
    print("=" * 65)

    skeletons, features_raw, labels = load_combined_dataset()
    if split_mode == "subject":
        subjects = load_ntu_subjects_padded(len(labels))
        train_idx, val_idx, _ = build_or_load_subject_disjoint_splits(labels, subjects)
    else:
        train_idx, val_idx, _ = build_or_load_splits(labels)

    # Reuse the scaler saved by train.py under the same suffix; if
    # missing, fit on training features. (B1)
    from src.data_splits import _scaler_path
    if os.path.exists(_scaler_path(checkpoint_suffix)):
        import joblib
        scaler = joblib.load(_scaler_path(checkpoint_suffix))
        print(f"[clf] reusing scaler at {_scaler_path(checkpoint_suffix)}")
    else:
        scaler = fit_and_save_scaler(features_raw[train_idx], suffix=checkpoint_suffix)

    features_std = scaler.transform(features_raw).astype(np.float32)

    # B3: augment the *skeleton* on-the-fly and recompute features so
    # the classifier stops seeing the same static 18-vector each epoch.
    from src.data_processor import DataProcessor
    from src.features import FeatureExtractor
    feat_extractor = FeatureExtractor()
    rng = np.random.default_rng(seed)

    class ClassifierTrainDS(torch.utils.data.Dataset):
        def __len__(self): return len(train_idx)
        def __getitem__(self, i):
            idx = int(train_idx[i])
            sk = DataProcessor.training_augment(skeletons[idx], rng)
            raw = feat_extractor.extract_sequence_features(sk)
            std = scaler.transform(raw.reshape(1, -1))[0].astype(np.float32)
            return torch.from_numpy(std), torch.tensor(int(labels[idx]), dtype=torch.long)

    train_ds = ClassifierTrainDS()
    val_ds = TensorDataset(
        torch.from_numpy(features_std[val_idx]),
        torch.from_numpy(labels[val_idx]),
    )
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"device: {device}")

    model = FeatureClassifier().to(device)

    cw = compute_class_weights(labels[train_idx])
    print(f"class weights -> NORMAL={cw[0]:.3f}, FALL={cw[1]:.3f}")
    criterion = nn.CrossEntropyLoss(weight=torch.tensor(cw, device=device))
    optimizer = optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=MAX_EPOCHS)

    os.makedirs(MODELS_DIR, exist_ok=True)
    log_path = os.path.join(MODELS_DIR, f"train_classifier_log{checkpoint_suffix}.csv")
    log_file = open(log_path, "w", newline="")
    log = csv.writer(log_file)
    log.writerow(["epoch", "train_loss", "val_loss", "val_macro_f1",
                  "fall_recall", "fall_precision"])

    best_f1 = -1.0
    best_epoch = 0
    patience = 0

    for epoch in range(1, MAX_EPOCHS + 1):
        model.train()
        running, total = 0.0, 0
        for ph, lb in train_loader:
            ph, lb = ph.to(device), lb.to(device)
            optimizer.zero_grad()
            logits = model(ph)
            loss = criterion(logits, lb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            running += float(loss.item()) * ph.size(0)
            total += ph.size(0)
        train_loss = running / max(total, 1)

        m = evaluate(model, val_loader, device, criterion)
        scheduler.step()

        print(
            f"epoch {epoch:02d}/{MAX_EPOCHS}  "
            f"train_loss={train_loss:.4f}  ||  "
            f"val_loss={m['loss']:.4f}  macroF1={m['macro_f1']:.4f}  "
            f"fall_rec={m['fall_recall']:.4f} fall_prec={m['fall_precision']:.4f}"
        )
        log.writerow([
            epoch, f"{train_loss:.4f}", f"{m['loss']:.4f}",
            f"{m['macro_f1']:.4f}", f"{m['fall_recall']:.4f}",
            f"{m['fall_precision']:.4f}",
        ])
        log_file.flush()

        if m["macro_f1"] > best_f1:
            best_f1 = m["macro_f1"]
            best_epoch = epoch
            patience = 0
            torch.save(model.state_dict(), os.path.join(MODELS_DIR, f"classifier_best{checkpoint_suffix}.pth"))
        else:
            patience += 1
            if patience >= EARLY_STOPPING_PATIENCE:
                print(f"early stopping at epoch {epoch} (best macroF1={best_f1:.4f} @ epoch {best_epoch})")
                break

    log_file.close()
    print("=" * 65)
    print(f" done. best macro-F1 = {best_f1:.4f} (epoch {best_epoch})")
    print(f" checkpoint: classifier_best{checkpoint_suffix}.pth")
    print("=" * 65)
    return {"best_macro_f1": best_f1, "best_epoch": best_epoch,
            "checkpoint_suffix": checkpoint_suffix}


if __name__ == "__main__":
    main()
