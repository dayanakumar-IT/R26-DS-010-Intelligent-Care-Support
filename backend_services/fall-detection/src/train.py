# backend/src/train.py
"""Joint training of the ST-GCN + late-fusion fall-risk model."""
import os
import csv
import random
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from sklearn.metrics import f1_score, precision_recall_fscore_support

from config.settings import (
    PROCESSED_DATA_DIR,
    MODELS_DIR,
    BATCH_SIZE,
    LEARNING_RATE,
    WEIGHT_DECAY,
    MAX_EPOCHS,
    EARLY_STOPPING_PATIENCE,
    SEED,
    CLASS_NAMES,
)
from src.models.stgcn import SkeletalSTGCN
from src.models.fusion import LateFusionNetwork
from src.data_splits import (
    load_combined_dataset,
    build_or_load_splits,
    build_or_load_subject_disjoint_splits,
    load_ntu_subjects_padded,
    fit_and_save_scaler,
    compute_class_weights,
)
from src.data_processor import DataProcessor
from src.features import FeatureExtractor


# ---------------------------------------------------------------------------
# Reproducibility
# ---------------------------------------------------------------------------
def set_seed(seed=SEED):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------
class MultimodalFallDataset(Dataset):
    """
    Pairs raw skeleton sequences with their standardised 18 features.
    When `train=True`, applies augmentations on the fly and recomputes
    the features so the deep and physics branches stay consistent.
    """

    def __init__(self, skeletons, features_std, labels,
                 scaler=None, train=False, augment_rng=None,
                 feature_extractor=None):
        self.skeletons = skeletons.astype(np.float32)
        self.features_std = features_std.astype(np.float32)
        self.labels = labels.astype(np.int64)
        self.scaler = scaler
        self.train = train
        self.rng = augment_rng if augment_rng is not None else np.random.default_rng(SEED)
        self.feat = feature_extractor

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        seq = self.skeletons[idx]
        feat = self.features_std[idx]
        label = self.labels[idx]

        if self.train:
            seq = DataProcessor.training_augment(seq, self.rng)
            # Recompute the 18 features on the augmented sequence and
            # apply the *training* scaler so val/test scaling is left
            # untouched.
            raw_feat = self.feat.extract_sequence_features(seq)
            feat = self.scaler.transform(raw_feat.reshape(1, -1))[0].astype(np.float32)

        return (
            torch.from_numpy(seq),
            torch.from_numpy(feat.astype(np.float32)),
            torch.tensor(label, dtype=torch.long),
        )


# ---------------------------------------------------------------------------
# Eval helper
# ---------------------------------------------------------------------------
STGCN_AUX_WEIGHT = 0.2   # weight of the ST-GCN standalone-head loss (B4)
UR_OVERSAMPLE_MULT = 10   # A3: UR row sampling weight vs NTU


def best_f1_threshold(probs, labels, grid=None):
    """B5: sweep the decision threshold on the val set, return the
    threshold that maximises macro-F1."""
    if grid is None:
        grid = np.linspace(0.05, 0.95, 91)
    best_t, best_f1 = 0.5, -1.0
    for t in grid:
        preds = (probs >= t).astype(np.int64)
        f1 = f1_score(labels, preds, average="macro", zero_division=0)
        if f1 > best_f1:
            best_f1, best_t = float(f1), float(t)
    return best_t, best_f1


def evaluate(model_pair, loader, device, criterion):
    stgcn, fusion = model_pair
    stgcn.eval()
    fusion.eval()
    total_loss, total = 0.0, 0
    all_pred, all_true, all_probs = [], [], []
    with torch.no_grad():
        for sk, ph, lb in loader:
            sk, ph, lb = sk.to(device), ph.to(device), lb.to(device)
            emb = stgcn(sk, extract_embedding=True)
            logits = fusion(emb, ph)
            loss = criterion(logits, lb)
            total_loss += float(loss.item()) * sk.size(0)
            total += sk.size(0)
            probs = torch.softmax(logits, 1)[:, 1].cpu().numpy()
            all_probs.extend(probs.tolist())
            all_pred.extend((probs >= 0.5).astype(np.int64).tolist())
            all_true.extend(lb.cpu().tolist())
    macro_f1 = f1_score(all_true, all_pred, average="macro", zero_division=0)
    prec, rec, f1, _ = precision_recall_fscore_support(
        all_true, all_pred, labels=[0, 1], zero_division=0
    )
    return {
        "loss": total_loss / max(total, 1),
        "macro_f1": macro_f1,
        "fall_precision": prec[1],
        "fall_recall":    rec[1],
        "fall_f1":        f1[1],
        "normal_recall":  rec[0],
        "probs":  np.asarray(all_probs, dtype=np.float32),
        "labels": np.asarray(all_true,  dtype=np.int64),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def execute_training_pipeline(split_mode: str = None, seed: int = None,
                              checkpoint_suffix: str = ""):
    """
    split_mode: "random" (default, 70/15/15 stratified) or "subject" (subject-disjoint by NTU PXXX).
                Also read from env var FALLRISK_SPLIT if not passed.
    seed:       override the global SEED for multi-seed runs.
    checkpoint_suffix: appended to saved filenames so multiple runs don't overwrite.
    """
    if split_mode is None:
        split_mode = os.environ.get("FALLRISK_SPLIT", "random")
    if seed is None:
        seed = int(os.environ.get("FALLRISK_SEED", SEED))
    set_seed(seed)
    print("=" * 65)
    print(f"       ST-GCN + LATE-FUSION TRAINING  split={split_mode}  seed={seed}")
    print("=" * 65)

    skeletons, features_raw, labels, origin = load_combined_dataset(return_origin=True)
    if split_mode == "subject":
        subjects = load_ntu_subjects_padded(len(labels))
        train_idx, val_idx, test_idx = build_or_load_subject_disjoint_splits(labels, subjects)
    else:
        train_idx, val_idx, test_idx = build_or_load_splits(labels)

    # Fit scaler on TRAINING features only (B1: per-run suffix)
    scaler = fit_and_save_scaler(features_raw[train_idx], suffix=checkpoint_suffix)
    features_std = scaler.transform(features_raw).astype(np.float32)

    feat_extractor = FeatureExtractor()

    train_ds = MultimodalFallDataset(
        skeletons[train_idx], features_std[train_idx], labels[train_idx],
        scaler=scaler, train=True,
        augment_rng=np.random.default_rng(seed),
        feature_extractor=feat_extractor,
    )
    val_ds = MultimodalFallDataset(
        skeletons[val_idx], features_std[val_idx], labels[val_idx],
        train=False,
    )

    # A3: WeightedRandomSampler — oversample UR so it stops being drowned.
    # Weights combine class balance and per-row origin.
    n_class = np.bincount(labels[train_idx], minlength=2).astype(np.float32)
    class_w = 1.0 / np.maximum(n_class, 1.0)
    row_w = class_w[labels[train_idx]]
    origin_train = origin[train_idx]
    row_w = row_w * np.where(origin_train == 1, float(UR_OVERSAMPLE_MULT), 1.0)
    sampler = WeightedRandomSampler(
        weights=torch.as_tensor(row_w, dtype=torch.double),
        num_samples=len(row_w),
        replacement=True,
    )
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"device: {device}")

    stgcn = SkeletalSTGCN(num_classes=2).to(device)
    fusion = LateFusionNetwork(num_classes=2).to(device)

    cw = compute_class_weights(labels[train_idx])
    print(f"class weights -> NORMAL={cw[0]:.3f}, FALL={cw[1]:.3f}")
    criterion = nn.CrossEntropyLoss(weight=torch.tensor(cw, device=device))

    optimizer = optim.AdamW(
        list(stgcn.parameters()) + list(fusion.parameters()),
        lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY,
    )
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=MAX_EPOCHS)

    os.makedirs(MODELS_DIR, exist_ok=True)
    log_path = os.path.join(MODELS_DIR, f"train_log{checkpoint_suffix}.csv")
    log_file = open(log_path, "w", newline="")
    log = csv.writer(log_file)
    log.writerow(["epoch", "train_loss", "train_acc",
                  "val_loss", "val_macro_f1", "fall_recall",
                  "fall_precision", "normal_recall"])

    best_f1 = -1.0
    patience = 0
    best_epoch = 0

    for epoch in range(1, MAX_EPOCHS + 1):
        stgcn.train(); fusion.train()
        running, correct, total = 0.0, 0, 0
        for sk, ph, lb in train_loader:
            sk, ph, lb = sk.to(device), ph.to(device), lb.to(device)
            optimizer.zero_grad()
            emb = stgcn(sk, extract_embedding=True)
            logits = fusion(emb, ph)
            # Auxiliary head: keeps stgcn.fc trainable so the standalone
            # ST-GCN baseline in evaluate.py is meaningful.
            stgcn_logits = stgcn.fc(emb)
            loss = criterion(logits, lb) + STGCN_AUX_WEIGHT * criterion(stgcn_logits, lb)
            loss.backward()
            nn.utils.clip_grad_norm_(
                list(stgcn.parameters()) + list(fusion.parameters()), max_norm=1.0
            )
            optimizer.step()

            running += float(loss.item()) * sk.size(0)
            correct += int((torch.argmax(logits, 1) == lb).sum().item())
            total += sk.size(0)

        train_loss = running / max(total, 1)
        train_acc = 100.0 * correct / max(total, 1)

        metrics = evaluate((stgcn, fusion), val_loader, device, criterion)
        scheduler.step()

        print(
            f"epoch {epoch:02d}/{MAX_EPOCHS}  "
            f"train_loss={train_loss:.4f} acc={train_acc:5.2f}%  ||  "
            f"val_loss={metrics['loss']:.4f}  "
            f"macroF1={metrics['macro_f1']:.4f}  "
            f"fall_rec={metrics['fall_recall']:.4f} "
            f"fall_prec={metrics['fall_precision']:.4f}"
        )
        log.writerow([
            epoch, f"{train_loss:.4f}", f"{train_acc:.2f}",
            f"{metrics['loss']:.4f}", f"{metrics['macro_f1']:.4f}",
            f"{metrics['fall_recall']:.4f}", f"{metrics['fall_precision']:.4f}",
            f"{metrics['normal_recall']:.4f}",
        ])
        log_file.flush()

        if metrics["macro_f1"] > best_f1:
            best_f1 = metrics["macro_f1"]
            best_epoch = epoch
            patience = 0
            torch.save(stgcn.state_dict(), os.path.join(MODELS_DIR, f"stgcn_best{checkpoint_suffix}.pth"))
            torch.save(fusion.state_dict(), os.path.join(MODELS_DIR, f"fusion_best{checkpoint_suffix}.pth"))
            # B5: sweep val threshold for max macro-F1 at this epoch,
            # persist alongside the checkpoint.
            t_star, f1_at_t = best_f1_threshold(metrics["probs"], metrics["labels"])
            with open(os.path.join(MODELS_DIR, f"threshold{checkpoint_suffix}.json"), "w") as tf:
                import json as _json
                _json.dump({"fusion_threshold": t_star,
                            "val_macro_f1_at_threshold": f1_at_t,
                            "default_threshold_macro_f1": best_f1,
                            "epoch": epoch}, tf, indent=2)
        else:
            patience += 1
            if patience >= EARLY_STOPPING_PATIENCE:
                print(f"early stopping at epoch {epoch} (best macroF1={best_f1:.4f} @ epoch {best_epoch})")
                break

    log_file.close()
    print("=" * 65)
    print(f" done. best macro-F1 = {best_f1:.4f} (epoch {best_epoch})")
    print(f" checkpoints: stgcn_best{checkpoint_suffix}.pth, fusion_best{checkpoint_suffix}.pth")
    print(f" log:         {log_path}")
    print("=" * 65)
    return {"best_macro_f1": best_f1, "best_epoch": best_epoch,
            "checkpoint_suffix": checkpoint_suffix}


if __name__ == "__main__":
    execute_training_pipeline()
