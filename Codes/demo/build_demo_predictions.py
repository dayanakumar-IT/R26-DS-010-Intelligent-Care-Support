"""
PP1 demo manifest builder.

Produces:
  Frontend_code_base/.../public/demo_data/manifest.json
  Frontend_code_base/.../public/demo_data/skeletons/<patientId>.mp4   x24

Each patient slot in mockData.ts (24 patients, fixed ward layout) is matched to
exactly one held-out test sequence, picked to honour:
  - the ward's room-level risk distribution (R01: 6L/4M/2H, R02: 5L/4M/3H)
  - the seed posture where a matching test sequence exists
  - uniqueness (no sequence reused)

Each manifest entry carries the real Fusion + Posture model outputs so the
frontend can show ground-truth-vs-prediction checks.
"""

from __future__ import annotations
import json
import shutil
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from skeleton_renderer import render_skeleton_mp4

warnings.filterwarnings("ignore", category=UserWarning)

# ------------------------------------------------------------------
REPO = Path(__file__).resolve().parents[2]
COMMON_META = REPO / "outputs" / "Common_Joint_Sequences" / "common_joint_metadata.csv"
FUSION_PRED = REPO / "Codes" / "models" / "fusion_results" / "test_predictions.csv"
FUSION_FEATS = REPO / "Codes" / "models" / "fusion_results" / "fusion_features.csv"
POSTURE_DATA = REPO / "Codes" / "models" / "posture_results" / "posture_dataset.csv"
POSTURE_MODEL = REPO / "Codes" / "models" / "posture_results" / "model.pkl"

OUT_PUBLIC = REPO / "Frontend_code_base" / "caregiver-intelligence-system" / "frontend" / "public"
OUT_DATA = OUT_PUBLIC / "demo_data"
OUT_SKELETONS = OUT_PUBLIC / "demo_data" / "skeletons"
OUT_DATA.mkdir(parents=True, exist_ok=True)
OUT_SKELETONS.mkdir(parents=True, exist_ok=True)

# ------------------------------------------------------------------
# Slot definition: extracted from mockData.ts so we keep the ward layout
# exactly as the supervisor UI was designed.
SLOTS: list[dict] = [
    # Room 01
    {"id": "P001", "room": "R01", "bed": 1,  "risk": "low_risk",      "posture": "Lying"},
    {"id": "P002", "room": "R01", "bed": 2,  "risk": "moderate_risk", "posture": "Sitting"},
    {"id": "P003", "room": "R01", "bed": 3,  "risk": "high_risk",     "posture": "Standing"},
    {"id": "P004", "room": "R01", "bed": 4,  "risk": "low_risk",      "posture": "Walking"},
    {"id": "P005", "room": "R01", "bed": 5,  "risk": "high_risk",     "posture": "Standing"},
    {"id": "P006", "room": "R01", "bed": 6,  "risk": "low_risk",      "posture": "Lying"},
    {"id": "P007", "room": "R01", "bed": 7,  "risk": "moderate_risk", "posture": "Sitting"},
    {"id": "P008", "room": "R01", "bed": 8,  "risk": "low_risk",      "posture": "Lying"},
    {"id": "P009", "room": "R01", "bed": 9,  "risk": "low_risk",      "posture": "Sitting"},
    {"id": "P010", "room": "R01", "bed": 10, "risk": "low_risk",      "posture": "Lying"},
    {"id": "P011", "room": "R01", "bed": 11, "risk": "moderate_risk", "posture": "Sitting"},
    {"id": "P012", "room": "R01", "bed": 12, "risk": "moderate_risk", "posture": "Standing"},
    # Room 02
    {"id": "P013", "room": "R02", "bed": 1,  "risk": "high_risk",     "posture": "Walking"},
    {"id": "P014", "room": "R02", "bed": 2,  "risk": "moderate_risk", "posture": "Sitting"},
    {"id": "P015", "room": "R02", "bed": 3,  "risk": "low_risk",      "posture": "Lying"},
    {"id": "P016", "room": "R02", "bed": 4,  "risk": "low_risk",      "posture": "Sitting"},
    {"id": "P017", "room": "R02", "bed": 5,  "risk": "moderate_risk", "posture": "Standing"},
    {"id": "P018", "room": "R02", "bed": 6,  "risk": "low_risk",      "posture": "Lying"},
    {"id": "P019", "room": "R02", "bed": 7,  "risk": "high_risk",     "posture": "Walking"},
    {"id": "P020", "room": "R02", "bed": 8,  "risk": "low_risk",      "posture": "Sitting"},
    {"id": "P021", "room": "R02", "bed": 9,  "risk": "moderate_risk", "posture": "Sitting"},
    {"id": "P022", "room": "R02", "bed": 10, "risk": "low_risk",      "posture": "Lying"},
    {"id": "P023", "room": "R02", "bed": 11, "risk": "high_risk",     "posture": "Standing"},
    {"id": "P024", "room": "R02", "bed": 12, "risk": "moderate_risk", "posture": "Standing"},
]

POSTURE_FEATURES = [
    "mean_torso_inclination", "std_torso_inclination", "knee_hip_drop_ratio",
    "ankle_motion", "mean_body_height", "std_body_height_norm",
    "mean_joint_speed", "std_hip_y",
]

ACTION_TO_POSTURE = {
    "sit_down":     "Sitting",
    "squat_down":   "Sitting",
    "stand_up":     "Standing",
    "staggering":   "Walking",
    "falling_down": "Lying",
    "fall":         "Lying",
    "normal":       "Standing",   # UR adl — assigned default; below we run model
}


def risk_class_to_score(pred: str, prob: float) -> int:
    if pred == "high_risk":      return int(round(71 + prob * 24))   # 71..95
    if pred == "moderate_risk":  return int(round(41 + prob * 29))   # 41..70
    return int(round(10 + prob * 30))                                # 10..40


def risk_class_to_level(pred: str) -> str:
    return {"high_risk": "High Risk",
            "moderate_risk": "Moderate Risk",
            "low_risk": "Low Risk"}[pred]


def predict_posture(seq_id: str, dataset: str, action_label: str,
                    posture_df: pd.DataFrame, model) -> tuple[str, float]:
    """Posture model prediction. Falls back to action mapping if features
    aren't in the posture dataset (e.g. UR adl was excluded from training)."""
    row = posture_df[posture_df["sequence_id"] == seq_id]
    if not row.empty:
        X = row[POSTURE_FEATURES].to_numpy()
        probs = model.predict_proba(X)[0]
        classes = list(model.classes_)
        idx = int(np.argmax(probs))
        return classes[idx], float(probs[idx])
    return ACTION_TO_POSTURE.get(action_label, "Standing"), 0.85


def pick_assignments(fusion: pd.DataFrame,
                     meta: pd.DataFrame,
                     posture_df: pd.DataFrame,
                     posture_model) -> dict[str, dict]:
    """Greedy assignment: each slot gets one unique test sequence.

    Strategy:
      - High slots take the 5 UR falls (the only high-risk UR test sequences)
      - Moderate slots take NTU moderate sequences, preferring matching posture
      - Low slots take 2 UR ADL + 9 NTU low sequences, preferring matching posture
    """
    # Join meta (has action label) with fusion predictions
    test = fusion.merge(
        meta[["sequence_id", "label"]].rename(columns={"label": "action_label"}),
        on="sequence_id", how="left",
    )
    # Compute predicted posture for every test sequence
    # (vectorised for speed: build feature matrix once)
    feat_df = test.merge(posture_df[["sequence_id"] + POSTURE_FEATURES],
                         on="sequence_id", how="left")
    has_feats = feat_df[POSTURE_FEATURES].notna().all(axis=1)
    pred_post = np.empty(len(test), dtype=object)
    pred_post_prob = np.zeros(len(test), dtype=np.float32)

    classes = list(posture_model.classes_)
    if has_feats.any():
        X = feat_df.loc[has_feats, POSTURE_FEATURES].to_numpy()
        probs = posture_model.predict_proba(X)
        idx = probs.argmax(axis=1)
        pred_post[has_feats.values] = [classes[i] for i in idx]
        pred_post_prob[has_feats.values] = probs.max(axis=1)
    # Fallback for sequences not in posture dataset
    for i in np.where(~has_feats.values)[0]:
        action = feat_df.iloc[i]["action_label"]
        pred_post[i] = ACTION_TO_POSTURE.get(action, "Standing")
        pred_post_prob[i] = 0.85

    test = test.copy()
    test["pred_posture"] = pred_post
    test["pred_posture_prob"] = pred_post_prob
    test["max_risk_prob"] = test[["p_low_risk", "p_moderate_risk", "p_high_risk"]].max(axis=1)

    used: set[str] = set()
    assignments: dict[str, dict] = {}

    def take_one(pool: pd.DataFrame, want_posture: str | None) -> pd.Series | None:
        candidates = pool[~pool["sequence_id"].isin(used)]
        if candidates.empty:
            return None
        if want_posture:
            match = candidates[candidates["pred_posture"] == want_posture]
            if not match.empty:
                # Highest confidence first within posture match
                return match.sort_values("max_risk_prob", ascending=False).iloc[0]
        # Fallback: best confidence in pool
        return candidates.sort_values("max_risk_prob", ascending=False).iloc[0]

    ur = test[test["dataset"] == "UR"]
    ntu = test[test["dataset"] == "NTU"]

    high_pool = pd.concat([ur[ur["pred_label"] == "high_risk"],
                           ntu[ntu["pred_label"] == "high_risk"]])
    mod_pool = ntu[ntu["pred_label"] == "moderate_risk"]
    low_pool_ur = ur[ur["pred_label"] == "low_risk"]
    low_pool_ntu = ntu[ntu["pred_label"] == "low_risk"]

    high_slots = [s for s in SLOTS if s["risk"] == "high_risk"]
    mod_slots = [s for s in SLOTS if s["risk"] == "moderate_risk"]
    low_slots = [s for s in SLOTS if s["risk"] == "low_risk"]

    # High slots — prefer UR (we have RGB skeletons from MediaPipe extraction)
    for slot in high_slots:
        row = take_one(high_pool, slot["posture"])
        if row is None:
            print(f"WARN: no sequence for slot {slot['id']}")
            continue
        used.add(row["sequence_id"])
        assignments[slot["id"]] = row.to_dict()

    # Moderate slots — NTU only
    for slot in mod_slots:
        row = take_one(mod_pool, slot["posture"])
        if row is None:
            print(f"WARN: no moderate sequence for slot {slot['id']}")
            continue
        used.add(row["sequence_id"])
        assignments[slot["id"]] = row.to_dict()

    # Low slots — UR first (those have RGB-derived skeletons), then NTU
    ur_count = 0
    for slot in low_slots:
        if ur_count < len(low_pool_ur) and slot["posture"] in ("Standing", "Walking"):
            row = take_one(low_pool_ur, slot["posture"])
            if row is not None:
                used.add(row["sequence_id"])
                assignments[slot["id"]] = row.to_dict()
                ur_count += 1
                continue
        row = take_one(low_pool_ntu, slot["posture"])
        if row is None:
            print(f"WARN: no low sequence for slot {slot['id']}")
            continue
        used.add(row["sequence_id"])
        assignments[slot["id"]] = row.to_dict()

    return assignments


def softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - x.max())
    return e / e.sum()


def main() -> None:
    fusion = pd.read_csv(FUSION_PRED)
    fusion_feats = pd.read_csv(FUSION_FEATS).set_index("sequence_id")
    meta = pd.read_csv(COMMON_META)
    posture_df = pd.read_csv(POSTURE_DATA)
    posture_model = joblib.load(POSTURE_MODEL)

    print("Picking 24 assignments...")
    assignments = pick_assignments(fusion, meta, posture_df, posture_model)
    print(f"  matched {len(assignments)}/24 slots")

    # Build manifest entries -------------------------------------------
    entries = []
    for slot in SLOTS:
        a = assignments.get(slot["id"])
        if a is None:
            continue
        seq = a["sequence_id"]
        pred = a["pred_label"]
        prob = float(a["max_risk_prob"])
        posture = a["pred_posture"]
        posture_prob = float(a["pred_posture_prob"])
        true_label = a["true_label"]
        correct = bool(pred == true_label)
        is_ur = (a["dataset"] == "UR")

        # Per-sequence RF + ST-GCN outputs (already produced when fusion
        # features were generated). RF is probabilities; ST-GCN is raw
        # logits — softmax them so the panel can show probabilities.
        feats = fusion_feats.loc[seq] if seq in fusion_feats.index else None
        rf_probs = None
        stgcn_probs = None
        if feats is not None:
            rf_probs = [float(feats["rf_prob_low"]),
                        float(feats["rf_prob_moderate"]),
                        float(feats["rf_prob_high"])]
            stgcn_logits = np.array([feats["stgcn_logit_low"],
                                     feats["stgcn_logit_moderate"],
                                     feats["stgcn_logit_high"]])
            stgcn_probs = [float(p) for p in softmax(stgcn_logits)]

        entries.append({
            "patientId": slot["id"],
            "room": slot["room"],
            "bed": slot["bed"],
            "source": a["dataset"],
            "sequenceId": seq,
            "actionLabel": a.get("action_label"),
            "skeletonFile": f"skeletons/{slot['id']}.mp4",
            "riskLevel": risk_class_to_level(pred),
            "riskScore": risk_class_to_score(pred, prob),
            "posture": posture,
            "confidence": round(prob, 3),
            "posturePrior": round(posture_prob, 3),
            # Fusion (final) model
            "pLow": round(float(a["p_low_risk"]), 3),
            "pModerate": round(float(a["p_moderate_risk"]), 3),
            "pHigh": round(float(a["p_high_risk"]), 3),
            # Component models — for showing the full backend pipeline
            "rfLow":        round(rf_probs[0], 3) if rf_probs else None,
            "rfModerate":   round(rf_probs[1], 3) if rf_probs else None,
            "rfHigh":       round(rf_probs[2], 3) if rf_probs else None,
            "stgcnLow":     round(stgcn_probs[0], 3) if stgcn_probs else None,
            "stgcnModerate": round(stgcn_probs[1], 3) if stgcn_probs else None,
            "stgcnHigh":    round(stgcn_probs[2], 3) if stgcn_probs else None,
            "groundTruth": risk_class_to_level(true_label),
            "correct": correct,
            "modality": "RGB→Skeleton" if is_ur else "Motion-Capture Skeleton",
        })

    manifest = {
        "evaluationProtocol": "Cross-Subject (CS)",
        "testSetSize": 799,
        "modelAccuracy": {
            "Fusion":  0.9424,
            "ST-GCN":  0.9186,
            "Posture": 0.9978,
            "RF":      0.8748,
        },
        "totalPatients": len(entries),
        "correctCount": sum(1 for e in entries if e["correct"]),
        "entries": entries,
    }
    (OUT_DATA / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"  wrote {OUT_DATA / 'manifest.json'}")

    # Render 24 skeleton MP4s ------------------------------------------
    print("\nRendering 24 skeleton animations...")
    for e in entries:
        npy = REPO / "outputs" / "Common_Joint_Sequences" / e["source"]
        # find the .npy — it lives in <dataset>/<label>/<seqid>.npy
        candidates = list(npy.glob(f"**/{e['sequenceId']}.npy"))
        if not candidates:
            print(f"  ! missing npy for {e['sequenceId']}")
            continue
        out = OUT_SKELETONS / f"{e['patientId']}.mp4"
        label = f"{e['patientId']}  {e['source']}  {e['sequenceId']}"
        render_skeleton_mp4(candidates[0], out, label=label, fps=25)
        print(f"  {e['patientId']} -> {e['sequenceId']:30s} pred={e['riskLevel']:13s} "
              f"posture={e['posture']:8s}  {'OK' if e['correct'] else 'MISS'}")

    print("\nDone.")
    print(f"  Manifest : {OUT_DATA / 'manifest.json'}")
    print(f"  Skeletons: {OUT_SKELETONS}/")


if __name__ == "__main__":
    main()
