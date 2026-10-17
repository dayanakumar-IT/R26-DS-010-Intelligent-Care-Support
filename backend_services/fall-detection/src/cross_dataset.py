"""
Cross-dataset generalisation test.

Trains ST-GCN + fusion + classifier on **NTU only** (with an internal
val split held out from NTU), then evaluates on **UR only**.

This is the credible "does the model generalise" number to put in the
report — random-split accuracy on a concatenated dataset over-reports
because the same subject and camera setup appears in both train and
test.

Usage:
    python -m src.cross_dataset
"""
import os
import json
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, average_precision_score,
    precision_recall_fscore_support, f1_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib

from config.settings import (
    MODELS_DIR, PROCESSED_DATA_DIR, BATCH_SIZE, LEARNING_RATE,
    WEIGHT_DECAY, MAX_EPOCHS, EARLY_STOPPING_PATIENCE, SEED, CLASS_NAMES,
)
from src.models.stgcn import SkeletalSTGCN
from src.models.fusion import LateFusionNetwork
from src.models.classifier import FeatureClassifier
from src.data_splits import compute_class_weights
from src.data_processor import DataProcessor
from src.features import FeatureExtractor
from src.train import set_seed, STGCN_AUX_WEIGHT


def _load_split(stem):
    base = PROCESSED_DATA_DIR
    return (
        np.load(os.path.join(base, f"{stem}_data.npy")),
        np.load(os.path.join(base, f"{stem}_features.npy")),
        np.load(os.path.join(base, f"{stem}_labels.npy")),
    )


def train_ntu_only(device, seed=SEED):
    set_seed(seed)
    ntu_sk, ntu_ft, ntu_lb = _load_split("ntu")

    # 85/15 internal val split of NTU for early stopping
    idx = np.arange(len(ntu_lb))
    tr_idx, va_idx = train_test_split(idx, train_size=0.85,
                                      stratify=ntu_lb, random_state=seed)

    # Feature scaler fit on NTU-train only
    scaler = StandardScaler().fit(ntu_ft[tr_idx])
    from src.data_splits import _scaler_path
    joblib.dump(scaler, _scaler_path("_ntu"))
    ntu_ft_std = scaler.transform(ntu_ft).astype(np.float32)

    feat = FeatureExtractor()
    rng = np.random.default_rng(seed)

    stgcn = SkeletalSTGCN().to(device)
    fusion = LateFusionNetwork().to(device)
    clf = FeatureClassifier().to(device)

    cw = compute_class_weights(ntu_lb[tr_idx])
    print(f"[xds] class weights (NTU-train)  NORMAL={cw[0]:.3f} FALL={cw[1]:.3f}")
    criterion = nn.CrossEntropyLoss(weight=torch.tensor(cw, device=device))

    params = list(stgcn.parameters()) + list(fusion.parameters()) + list(clf.parameters())
    opt = optim.AdamW(params, lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
    sched = optim.lr_scheduler.CosineAnnealingLR(opt, T_max=MAX_EPOCHS)

    best_f1 = -1.0; best_epoch = 0; patience = 0
    for epoch in range(1, MAX_EPOCHS + 1):
        stgcn.train(); fusion.train(); clf.train()
        # Augmented mini-batches
        order = rng.permutation(len(tr_idx))
        for start in range(0, len(order), BATCH_SIZE):
            batch = tr_idx[order[start : start + BATCH_SIZE]]
            sk_b, lb_b = ntu_sk[batch], ntu_lb[batch]
            sk_aug = np.stack([DataProcessor.training_augment(sk_b[i], rng)
                               for i in range(len(sk_b))], axis=0)
            raw_ft = np.stack([feat.extract_sequence_features(sk_aug[i])
                               for i in range(len(sk_aug))], axis=0)
            ft_std = scaler.transform(raw_ft).astype(np.float32)

            sk_t = torch.from_numpy(sk_aug.astype(np.float32)).to(device)
            ft_t = torch.from_numpy(ft_std).to(device)
            lb_t = torch.from_numpy(lb_b.astype(np.int64)).to(device)

            opt.zero_grad()
            emb = stgcn(sk_t, extract_embedding=True)
            loss = (criterion(fusion(emb, ft_t), lb_t)
                    + STGCN_AUX_WEIGHT * criterion(stgcn.fc(emb), lb_t)
                    + criterion(clf(ft_t), lb_t))
            loss.backward()
            nn.utils.clip_grad_norm_(params, 1.0)
            opt.step()

        # Validation on NTU-val (no augmentation)
        stgcn.eval(); fusion.eval(); clf.eval()
        with torch.no_grad():
            sk_v = torch.from_numpy(ntu_sk[va_idx].astype(np.float32)).to(device)
            ft_v = torch.from_numpy(ntu_ft_std[va_idx]).to(device)
            emb_v = stgcn(sk_v, extract_embedding=True)
            preds = torch.argmax(fusion(emb_v, ft_v), 1).cpu().numpy()
        f1 = f1_score(ntu_lb[va_idx], preds, average="macro", zero_division=0)
        prec, rec, _, _ = precision_recall_fscore_support(
            ntu_lb[va_idx], preds, labels=[0, 1], zero_division=0)
        sched.step()
        print(f"[xds] epoch {epoch:02d}/{MAX_EPOCHS}  val_macroF1={f1:.4f}  fall_rec={rec[1]:.4f}")

        if f1 > best_f1:
            best_f1 = f1; best_epoch = epoch; patience = 0
            torch.save(stgcn.state_dict(),  os.path.join(MODELS_DIR, "stgcn_best_ntu.pth"))
            torch.save(fusion.state_dict(), os.path.join(MODELS_DIR, "fusion_best_ntu.pth"))
            torch.save(clf.state_dict(),    os.path.join(MODELS_DIR, "classifier_best_ntu.pth"))
        else:
            patience += 1
            if patience >= EARLY_STOPPING_PATIENCE:
                print(f"[xds] early stop @ epoch {epoch}. best macroF1={best_f1:.4f} @ epoch {best_epoch}")
                break

    return best_f1, best_epoch


def evaluate_on_ur(device):
    ur_sk, ur_ft, ur_lb = _load_split("ur")
    from src.data_splits import _scaler_path
    scaler = joblib.load(_scaler_path("_ntu"))
    ur_ft_std = scaler.transform(ur_ft).astype(np.float32)

    stgcn = SkeletalSTGCN().to(device).eval()
    stgcn.load_state_dict(torch.load(os.path.join(MODELS_DIR, "stgcn_best_ntu.pth"),
                                     map_location=device, weights_only=True))
    fusion = LateFusionNetwork().to(device).eval()
    fusion.load_state_dict(torch.load(os.path.join(MODELS_DIR, "fusion_best_ntu.pth"),
                                      map_location=device, weights_only=True))
    clf = FeatureClassifier().to(device).eval()
    clf.load_state_dict(torch.load(os.path.join(MODELS_DIR, "classifier_best_ntu.pth"),
                                   map_location=device, weights_only=True))

    with torch.no_grad():
        sk_t = torch.from_numpy(ur_sk.astype(np.float32)).to(device)
        ft_t = torch.from_numpy(ur_ft_std).to(device)
        emb = stgcn(sk_t, extract_embedding=True)
        stgcn_logits = stgcn.fc(emb)
        fusion_logits = fusion(emb, ft_t)
        clf_logits = clf(ft_t)

    lines = ["# Cross-Dataset Evaluation Report",
             "", f"Train: NTU only  |  Test: UR only ({len(ur_lb)} clips)", ""]
    summary = {}
    for name, logits in [("ST-GCN only", stgcn_logits),
                         ("Feature-only classifier", clf_logits),
                         ("Fusion (ST-GCN + features)", fusion_logits)]:
        probs = torch.softmax(logits, 1)[:, 1].cpu().numpy()
        preds = probs.argmax(0) if False else (probs >= 0.5).astype(int)
        cm = confusion_matrix(ur_lb, preds, labels=[0, 1])
        try:
            roc = roc_auc_score(ur_lb, probs)
            ap = average_precision_score(ur_lb, probs)
        except ValueError:
            roc = ap = float("nan")
        lines.append(f"## {name}")
        lines.append("```")
        lines.append(classification_report(ur_lb, preds, target_names=CLASS_NAMES,
                                           digits=4, zero_division=0))
        lines.append(f"confusion matrix:\n{cm}")
        lines.append(f"ROC-AUC: {roc:.4f}   PR-AUC: {ap:.4f}")
        lines.append("```\n")
        summary[name] = {"confusion_matrix": cm.tolist(),
                         "roc_auc": float(roc), "pr_auc": float(ap)}

    out_md = os.path.join(MODELS_DIR, "eval_report_cross_dataset.md")
    with open(out_md, "w") as f:
        f.write("\n".join(lines))
    out_json = os.path.join(MODELS_DIR, "eval_report_cross_dataset.json")
    with open(out_json, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"[xds] wrote {out_md} and {out_json}")


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[xds] device: {device}")
    train_ntu_only(device)
    evaluate_on_ur(device)


if __name__ == "__main__":
    main()
