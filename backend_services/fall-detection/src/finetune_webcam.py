"""
Fine-tune Model A (NTU+UR) on in-house webcam clips â†’ Model C.

Loads:
    models/saved/stgcn_best.pth        â† frozen backbone (first 3 epochs)
    models/saved/fusion_best.pth       â† frozen (first 3 epochs)

Trains (fine-tunes) on webcam_data.npy / webcam_features.npy using a
very low LR and saves:
    models/saved/stgcn_best_webcam.pth
    models/saved/fusion_best_webcam.pth
    models/saved/threshold_webcam.json

Subject-disjoint split: if â‰¥2 subjects recorded, holds out one for val.
Falls back to a random 80/20 split when only 1 subject exists.

Usage
-----
    python -m src.finetune_webcam
    python -m src.finetune_webcam --epochs 30 --lr 5e-5 --batch 8
    python -m src.finetune_webcam --suffix _subj   # fine-tune from Model C_subj
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.metrics import f1_score
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import PROCESSED_DATA_DIR, MODELS_DIR
from src.data_processor import DataProcessor
from src.features import FeatureExtractor
from src.models.stgcn import SkeletalSTGCN
from src.models.fusion import LateFusionNetwork
from src.data_splits import load_scaler

SEED = 42


def set_seed(seed=SEED):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------
class WebcamDataset(Dataset):
    def __init__(self, skeletons, features, labels, train=False, scaler=None):
        self.skeletons = skeletons.astype(np.float32)
        self.features  = features.astype(np.float32)
        self.labels    = labels.astype(np.int64)
        self.train     = train
        self.scaler    = scaler
        self.feat_ext  = FeatureExtractor()
        self.rng       = np.random.default_rng(SEED)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        seq   = self.skeletons[idx].copy()
        feats = self.features[idx].copy()
        label = self.labels[idx]

        if self.train:
            seq = DataProcessor.training_augment(seq, self.rng)
            if self.scaler is not None:
                raw = self.feat_ext.extract_sequence_features(seq)
                feats = self.scaler.transform(raw.reshape(1, -1))[0].astype(np.float32)

        return (
            torch.from_numpy(seq),
            torch.from_numpy(feats),
            torch.tensor(label, dtype=torch.long),
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _best_threshold(probs, labels):
    best_t, best_f1 = 0.5, -1.0
    for t in np.linspace(0.05, 0.95, 91):
        preds = (probs >= t).astype(int)
        f1 = f1_score(labels, preds, average="macro", zero_division=0)
        if f1 > best_f1:
            best_f1, best_t = float(f1), float(t)
    return best_t, best_f1


def _evaluate(stgcn, fusion, loader, device, criterion):
    stgcn.eval(); fusion.eval()
    total_loss = 0.0
    all_probs, all_labels = [], []
    with torch.no_grad():
        for sk, ph, lb in loader:
            sk, ph, lb = sk.to(device), ph.to(device), lb.to(device)
            emb    = stgcn(sk, extract_embedding=True)
            logits = fusion(emb, ph)
            total_loss += criterion(logits, lb).item() * sk.size(0)
            probs = torch.softmax(logits, 1)[:, 1].cpu().numpy()
            all_probs.extend(probs.tolist())
            all_labels.extend(lb.cpu().tolist())
    probs_arr  = np.array(all_probs)
    labels_arr = np.array(all_labels)
    preds      = (probs_arr >= 0.5).astype(int)
    macro_f1   = f1_score(labels_arr, preds, average="macro", zero_division=0)
    return total_loss / max(len(all_labels), 1), macro_f1, probs_arr, labels_arr


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def finetune(
    suffix_in:  str = "",
    suffix_out: str = "_webcam",
    lr:         float = 1e-5,
    batch:      int   = 8,
    epochs:     int   = 20,
    freeze_epochs: int = 3,
    random_split: bool = False,
):
    set_seed()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[finetune] Device: {device}")

    # â”€â”€ Load webcam arrays â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    data_path = os.path.join(PROCESSED_DATA_DIR, "webcam_data.npy")
    feat_path = os.path.join(PROCESSED_DATA_DIR, "webcam_features.npy")
    lbl_path  = os.path.join(PROCESSED_DATA_DIR, "webcam_labels.npy")
    subj_path = os.path.join(PROCESSED_DATA_DIR, "webcam_subjects.npy")

    for p in (data_path, feat_path, lbl_path):
        if not os.path.exists(p):
            print(f"[finetune] Missing: {p}")
            print("           Run parse_webcam.py first.")
            sys.exit(1)

    data     = np.load(data_path)      # (N, 90, 14, 4)
    features = np.load(feat_path)      # (N, 18)
    labels   = np.load(lbl_path)       # (N,)
    subjects = np.load(subj_path) if os.path.exists(subj_path) else np.zeros(len(labels), int)

    N = len(labels)
    print(f"[finetune] Sequences: {N}  "
          f"fall={int((labels==1).sum())}  normal={int((labels==0).sum())}")

    # Load pre-trained scaler (from Model A training)
    scaler = load_scaler(suffix_in)

    # Re-standardise features with the existing scaler
    features_std = scaler.transform(features).astype(np.float32)

    # â”€â”€ Train / val split â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    unique_subjects = np.unique(subjects)
    if not random_split and len(unique_subjects) >= 2:
        val_subj   = unique_subjects[-1]     # hold out last subject
        train_mask = subjects != val_subj
        val_mask   = subjects == val_subj
        print(f"[finetune] Subject-disjoint split: "
              f"train subjects={unique_subjects[:-1].tolist()}  val subject={val_subj}")
    else:
        rng = np.random.default_rng(SEED)
        idx = rng.permutation(N)
        split = int(0.8 * N)
        train_mask = np.zeros(N, bool); train_mask[idx[:split]] = True
        val_mask   = ~train_mask
        print(f"[finetune] Random 80/20 split (mixed {len(unique_subjects)} subjects)")

    tr_sk = data[train_mask]; tr_ft = features_std[train_mask]; tr_lb = labels[train_mask]
    va_sk = data[val_mask];   va_ft = features_std[val_mask];   va_lb = labels[val_mask]
    print(f"[finetune] Train: {len(tr_lb)}  Val: {len(va_lb)}")

    if len(tr_lb) < 2 or len(np.unique(tr_lb)) < 2:
        print("[finetune] Not enough labelled data for fine-tuning. "
              "Record more clips (at least 2 fall + 2 normal).")
        sys.exit(1)

    # Class-weighted sampler for imbalanced webcam data
    class_counts = np.bincount(tr_lb.astype(int), minlength=2)
    sample_weights = (1.0 / np.maximum(class_counts[tr_lb.astype(int)], 1)).tolist()
    sampler = WeightedRandomSampler(sample_weights, len(sample_weights), replacement=True)

    tr_dataset = WebcamDataset(tr_sk, tr_ft, tr_lb, train=True, scaler=scaler)
    va_dataset = WebcamDataset(va_sk, va_ft, va_lb, train=False)
    tr_loader  = DataLoader(tr_dataset, batch_size=batch, sampler=sampler, drop_last=True)
    va_loader  = DataLoader(va_dataset, batch_size=batch, shuffle=False, drop_last=False)

    # â”€â”€ Load Model A weights â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    stgcn = SkeletalSTGCN().to(device)
    stgcn.load_state_dict(torch.load(
        os.path.join(MODELS_DIR, f"stgcn_best{suffix_in}.pth"),
        map_location=device, weights_only=True))

    fusion = LateFusionNetwork().to(device)
    fusion.load_state_dict(torch.load(
        os.path.join(MODELS_DIR, f"fusion_best{suffix_in}.pth"),
        map_location=device, weights_only=True))

    print(f"[finetune] Loaded Model A  (suffix='{suffix_in}')")

    criterion = nn.CrossEntropyLoss()

    def _make_optimizer(freeze: bool):
        if freeze:
            for p in stgcn.parameters():
                p.requires_grad = False
            for p in fusion.parameters():
                p.requires_grad = False
            # Unfreeze only the final classification head
            for p in stgcn.fc.parameters():
                p.requires_grad = True
            for p in fusion.head.parameters():
                p.requires_grad = True
            params = (list(stgcn.fc.parameters()) +
                      list(fusion.head.parameters()))
        else:
            for p in stgcn.parameters():
                p.requires_grad = True
            for p in fusion.parameters():
                p.requires_grad = True
            params = list(stgcn.parameters()) + list(fusion.parameters())

        return optim.Adam(params, lr=lr, weight_decay=1e-4)

    # â”€â”€ Training loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    best_f1 = -1.0
    patience = 7
    no_improve = 0
    os.makedirs(MODELS_DIR, exist_ok=True)

    optimizer = _make_optimizer(freeze=True)

    for epoch in range(1, epochs + 1):
        if epoch == freeze_epochs + 1:
            optimizer = _make_optimizer(freeze=False)
            print(f"[finetune] Epoch {epoch}: unfroze all layers")

        stgcn.train(); fusion.train()
        for sk, ph, lb in tr_loader:
            sk, ph, lb = sk.to(device), ph.to(device), lb.to(device)
            optimizer.zero_grad()
            emb    = stgcn(sk, extract_embedding=True)
            logits = fusion(emb, ph)
            loss   = criterion(logits, lb)
            loss.backward()
            nn.utils.clip_grad_norm_(
                list(stgcn.parameters()) + list(fusion.parameters()), 1.0)
            optimizer.step()

        if len(va_loader) == 0:
            continue

        val_loss, val_f1, probs, true_labels = _evaluate(
            stgcn, fusion, va_loader, device, criterion)
        print(f"  epoch {epoch:03d}  val_loss={val_loss:.4f}  val_macro_f1={val_f1:.4f}")

        if val_f1 > best_f1:
            best_f1 = val_f1
            no_improve = 0
            torch.save(stgcn.state_dict(),
                       os.path.join(MODELS_DIR, f"stgcn_best{suffix_out}.pth"))
            torch.save(fusion.state_dict(),
                       os.path.join(MODELS_DIR, f"fusion_best{suffix_out}.pth"))
            # Save optimal threshold
            thr, thr_f1 = _best_threshold(probs, true_labels)
            with open(os.path.join(MODELS_DIR, f"threshold{suffix_out}.json"), "w") as f:
                json.dump({"fusion_threshold": thr, "val_macro_f1": thr_f1}, f, indent=2)
            print(f"    âœ“ saved best model  f1={best_f1:.4f}  threshold={thr:.3f}")
        else:
            no_improve += 1
            if no_improve >= patience:
                print(f"[finetune] Early stopping at epoch {epoch}")
                break

    print(f"\n[finetune] Done.  Best val macro-F1: {best_f1:.4f}")
    print(f"[finetune] Models saved as *{suffix_out}.pth in {MODELS_DIR}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Fine-tune Model A on in-house webcam clips (â†’ Model C).")
    parser.add_argument("--suffix_in",  default="",       help="Input model suffix (default '')")
    parser.add_argument("--suffix_out", default="_webcam", help="Output model suffix (default '_webcam')")
    parser.add_argument("--lr",    type=float, default=1e-5, help="Learning rate (default 1e-5)")
    parser.add_argument("--batch", type=int,   default=8,    help="Batch size (default 8)")
    parser.add_argument("--epochs",type=int,   default=20,   help="Max epochs (default 20)")
    parser.add_argument("--freeze_epochs", type=int, default=3,
                        help="Epochs to freeze backbone, train head only (default 3)")
    parser.add_argument("--random_split", action="store_true",
                        help="Use random 80/20 split instead of subject-disjoint split")
    args = parser.parse_args()

    finetune(
        suffix_in    = args.suffix_in,
        suffix_out   = args.suffix_out,
        lr           = args.lr,
        batch        = args.batch,
        epochs       = args.epochs,
        freeze_epochs= args.freeze_epochs,
        random_split = args.random_split,
    )
