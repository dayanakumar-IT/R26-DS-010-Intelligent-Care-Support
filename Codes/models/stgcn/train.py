"""
ST-GCN training loop.

================================================================
EXPERIMENT DESIGN
================================================================
Trains the ST-GCN on the CS train split. The val split drives
early stopping and best-checkpoint selection. The test split is
NEVER touched here — it is held out for `evaluate.py`.

Hyperparameters
    Optimizer        : Adam, lr=1e-3 with cosine schedule
    Loss             : CrossEntropy with inverse-frequency class weights
                       (matches RF baseline's class_weight='balanced')
    Batch size       : 32
    Max epochs       : 50
    Early stopping   : patience = 10 epochs on val accuracy
    Best checkpoint  : saved by highest val accuracy
    Random seed      : 42 (matches RF baseline)

================================================================
OUTPUTS — Codes/models/stgcn_results/
================================================================
    best_model.pt           best checkpoint by val accuracy
    last_model.pt           final-epoch checkpoint
    training_log.csv        per-epoch train/val loss + accuracy
    training_curves.png     loss + accuracy plots
    summary.txt             best epoch, best val acc, total epochs run
"""

import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dataset import CommonJointDataset, NUM_CLASSES
from model import STGCN


# ============================================================
# CONFIG
# ============================================================
import os
_PROTOCOL = os.environ.get("MODELS_PROTOCOL", "cs").lower()
if _PROTOCOL == "cv":
    RESULTS_DIR = Path(__file__).resolve().parent.parent / "stgcn_results_cv"
elif _PROTOCOL == "cd_ntu2ur":
    RESULTS_DIR = Path(__file__).resolve().parent.parent / "stgcn_results_cd_ntu2ur"
else:
    RESULTS_DIR = Path(__file__).resolve().parent.parent / "stgcn_results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_SEED = 42

BATCH_SIZE = 32
MAX_EPOCHS = 50
LEARNING_RATE = 1e-3
WEIGHT_DECAY = 1e-4
EARLY_STOPPING_PATIENCE = 10

NUM_WORKERS = 0   # Windows + small per-sample work -> 0 is fastest


# ============================================================
# UTILITIES
# ============================================================
def set_seed(seed: int):
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def get_device():
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ============================================================
# EPOCH RUNNERS
# ============================================================
def run_train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss, total_correct, total_samples = 0.0, 0, 0
    for x, y in loader:
        x = x.to(device, non_blocking=True)
        y = y.to(device, non_blocking=True)
        optimizer.zero_grad()
        logits = model(x)
        loss = criterion(logits, y)
        loss.backward()
        optimizer.step()
        bs = y.size(0)
        total_loss += loss.item() * bs
        total_correct += (logits.argmax(dim=1) == y).sum().item()
        total_samples += bs
    return total_loss / total_samples, total_correct / total_samples


@torch.no_grad()
def run_eval_epoch(model, loader, criterion, device):
    model.eval()
    total_loss, total_correct, total_samples = 0.0, 0, 0
    for x, y in loader:
        x = x.to(device, non_blocking=True)
        y = y.to(device, non_blocking=True)
        logits = model(x)
        loss = criterion(logits, y)
        bs = y.size(0)
        total_loss += loss.item() * bs
        total_correct += (logits.argmax(dim=1) == y).sum().item()
        total_samples += bs
    return total_loss / total_samples, total_correct / total_samples


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 60)
    print(f"  ST-GCN training ({_PROTOCOL.upper()} protocol)")
    print("=" * 60)

    set_seed(RANDOM_SEED)
    device = get_device()
    print(f"Device          : {device}")
    print(f"PyTorch threads : {torch.get_num_threads()}")

    # ---- Data ----
    print("\nLoading datasets...")
    train_ds = CommonJointDataset("train")
    val_ds = CommonJointDataset("val")
    print(f"  Train: n={len(train_ds)}  | distribution: {train_ds.get_label_distribution()}")
    print(f"  Val  : n={len(val_ds)}    | distribution: {val_ds.get_label_distribution()}")

    train_loader = DataLoader(
        train_ds, batch_size=BATCH_SIZE, shuffle=True,
        num_workers=NUM_WORKERS, drop_last=False,
    )
    val_loader = DataLoader(
        val_ds, batch_size=BATCH_SIZE, shuffle=False,
        num_workers=NUM_WORKERS,
    )

    # ---- Model ----
    print("\nBuilding model...")
    model = STGCN(num_classes=NUM_CLASSES, in_channels=3, t_kernel=9).to(device)
    print(f"Trainable parameters: {model.count_parameters():,}")

    # ---- Loss with class weights ----
    class_weights = train_ds.get_class_weights().to(device)
    print(f"Class weights (low / moderate / high): "
          f"{class_weights.cpu().numpy().round(3).tolist()}")
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    # ---- Optimizer + scheduler ----
    optimizer = torch.optim.Adam(
        model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=MAX_EPOCHS
    )

    # ---- Training loop ----
    print("\n" + "=" * 60)
    print("  Training")
    print("=" * 60)
    log_rows = []
    best_val_acc = -1.0
    best_epoch = -1
    epochs_no_improve = 0
    total_start = time.time()

    for epoch in range(1, MAX_EPOCHS + 1):
        epoch_start = time.time()
        train_loss, train_acc = run_train_epoch(
            model, train_loader, optimizer, criterion, device
        )
        val_loss, val_acc = run_eval_epoch(model, val_loader, criterion, device)
        scheduler.step()

        elapsed = time.time() - epoch_start
        current_lr = optimizer.param_groups[0]["lr"]

        log_rows.append({
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "train_acc": round(train_acc, 4),
            "val_loss": round(val_loss, 4),
            "val_acc": round(val_acc, 4),
            "lr": round(current_lr, 6),
            "epoch_time_sec": round(elapsed, 1),
        })

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_epoch = epoch
            epochs_no_improve = 0
            torch.save(model.state_dict(), RESULTS_DIR / "best_model.pt")
            mark = "  *** new best, checkpoint saved ***"
        else:
            epochs_no_improve += 1
            mark = ""

        print(
            f"Epoch {epoch:3d}/{MAX_EPOCHS}  "
            f"train_loss={train_loss:.4f} train_acc={train_acc:.4f}  "
            f"val_loss={val_loss:.4f} val_acc={val_acc:.4f}  "
            f"lr={current_lr:.5f}  {elapsed:.1f}s{mark}"
        )

        # Survives Ctrl-C
        pd.DataFrame(log_rows).to_csv(RESULTS_DIR / "training_log.csv", index=False)

        if epochs_no_improve >= EARLY_STOPPING_PATIENCE:
            print(f"\nEarly stopping: no val_acc improvement for "
                  f"{EARLY_STOPPING_PATIENCE} epochs.")
            break

    total_elapsed = time.time() - total_start
    torch.save(model.state_dict(), RESULTS_DIR / "last_model.pt")

    # ---- Summary ----
    summary = (
        f"ST-GCN training summary ({_PROTOCOL.upper()} protocol)\n"
        f"================================================\n"
        f"Random seed         : {RANDOM_SEED}\n"
        f"Device              : {device}\n"
        f"Trainable params    : {model.count_parameters():,}\n"
        f"Train samples       : {len(train_ds)}\n"
        f"Val samples         : {len(val_ds)}\n"
        f"Batch size          : {BATCH_SIZE}\n"
        f"Max epochs          : {MAX_EPOCHS}\n"
        f"Early stopping      : patience {EARLY_STOPPING_PATIENCE}\n"
        f"Initial LR          : {LEARNING_RATE}\n"
        f"Weight decay        : {WEIGHT_DECAY}\n"
        f"\n"
        f"Best epoch          : {best_epoch}\n"
        f"Best val accuracy   : {best_val_acc:.4f}\n"
        f"Final epoch run     : {len(log_rows)}\n"
        f"Total wall time     : {total_elapsed/60:.1f} min\n"
        f"\n"
        f"Best checkpoint     : {RESULTS_DIR / 'best_model.pt'}\n"
        f"Final checkpoint    : {RESULTS_DIR / 'last_model.pt'}\n"
        f"Training log        : {RESULTS_DIR / 'training_log.csv'}\n"
    )
    print("\n" + summary)
    (RESULTS_DIR / "summary.txt").write_text(summary, encoding="utf-8")

    # ---- Plot training curves ----
    df = pd.DataFrame(log_rows)
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))

    axes[0].plot(df["epoch"], df["train_loss"], label="train")
    axes[0].plot(df["epoch"], df["val_loss"], label="val")
    axes[0].axvline(best_epoch, color="green", linestyle="--", alpha=0.5,
                    label=f"best (epoch {best_epoch})")
    axes[0].set_xlabel("epoch"); axes[0].set_ylabel("loss")
    axes[0].set_title("Loss"); axes[0].legend(); axes[0].grid(alpha=0.3)

    axes[1].plot(df["epoch"], df["train_acc"], label="train")
    axes[1].plot(df["epoch"], df["val_acc"], label="val")
    axes[1].axvline(best_epoch, color="green", linestyle="--", alpha=0.5,
                    label=f"best (epoch {best_epoch})")
    axes[1].set_xlabel("epoch"); axes[1].set_ylabel("accuracy")
    axes[1].set_title("Accuracy"); axes[1].legend(); axes[1].grid(alpha=0.3)

    plt.tight_layout()
    plt.savefig(RESULTS_DIR / "training_curves.png", dpi=150)
    plt.close()

    print(f"\nAll training artifacts saved in: {RESULTS_DIR}")
    print("\nNext step: run `python evaluate.py` to score the best checkpoint on TEST.")


if __name__ == "__main__":
    main()
