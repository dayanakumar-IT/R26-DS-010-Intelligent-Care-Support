"""
grading.py
GLOSS component — recognise, then grade (Layers 2 + 3 of the thesis).

Ported from gloss_assets/gloss_reference_pipeline.py (notebook 03,
cell A2) WITHOUT changing the logic: compute_landmark_deviation,
evaluate_attempt, segment_by_motion_troughs, isolate_best_attempt,
grade_learner_attempt. DTW is dtw-python, step pattern symmetric2,
normalized distance — the scale gloss_assets/class_thresholds.json (v3)
was calibrated on. If the notebook's logic ever changes, re-sync this
file from the reference, do not edit it independently.

The only differences from the reference file:
  - resample_sequence / add_kinematic_features live in preprocessing.py
    (already identical to the notebook) and the resample -> kinematic ->
    standardize lines of grade_learner_attempt are the shared
    preprocessing.features_from_normalized();
  - the model is called through recogniser.predict_probs()
    (model(x, training=False)) instead of .predict();
  - class names come from class_names.json (= label_encoder.classes_)
    instead of unpickling label_encoder.pkl;
  - grade_learner_attempt's result carries one extra key, "probs" (the
    full probability vector), for the app's top-3 diagnostics.

Module globals (set by load_assets(), exactly like the reference's
load_assets()): LANDMARK_NAMES, threshold_table (v3), references,
feature_scaler, class_names. Everything is read from gloss_assets/ —
the DTW references are reference_exemplars.npz, NOT the Supabase
gloss_sign_references rows.
"""

import json
import os

import numpy as np
from dtw import dtw          # pip install dtw-python

from preprocessing import N_TOTAL_LANDMARKS, TARGET_FRAMES, features_from_normalized
from recogniser import ASSETS_DIR, predict_probs

N_LANDMARKS = N_TOTAL_LANDMARKS   # 49

LANDMARK_NAMES = None
threshold_table = None
references = None
feature_scaler = None
class_names = None


# ---------------- loading the product bundle ----------------
def load_feature_scaler(assets_dir=ASSETS_DIR):
    global feature_scaler
    s = np.load(os.path.join(assets_dir, "feature_scaler.npz"))
    feature_scaler = {"mean": s["mean"], "std": s["std"]}
    return feature_scaler


def load_thresholds(assets_dir=ASSETS_DIR):
    global threshold_table
    with open(os.path.join(assets_dir, "class_thresholds.json")) as f:
        threshold_table = json.load(f)          # v3
    return threshold_table


def load_class_names(assets_dir=ASSETS_DIR):
    global class_names
    with open(os.path.join(assets_dir, "class_names.json")) as f:
        class_names = json.load(f)
    return class_names


def load_references(assets_dir=ASSETS_DIR):
    global references, LANDMARK_NAMES
    with open(os.path.join(assets_dir, "landmark_names.json")) as f:
        LANDMARK_NAMES = json.load(f)
    loaded_refs = np.load(os.path.join(assets_dir, "reference_exemplars.npz"))
    references = {cls.replace("_", " "): {"sequence": loaded_refs[cls]} for cls in loaded_refs.files}
    return references


def load_assets(assets_dir=ASSETS_DIR):
    """Loads everything the functions below need (except the model —
    see recogniser.load_ensemble()) from the fingerprinted bundle."""
    load_feature_scaler(assets_dir)
    load_thresholds(assets_dir)
    load_class_names(assets_dir)
    load_references(assets_dir)


def flatten_sequence(arr):
    return arr.reshape(arr.shape[0], -1)


# ---------- Layer 3: DTW comparison ----------
def compute_landmark_deviation(query_seq_flat, reference_seq_flat, n_landmarks=N_LANDMARKS):
    alignment = dtw(query_seq_flat, reference_seq_flat, dist_method="euclidean",
                    keep_internals=True, step_pattern="symmetric2")
    query_3d = query_seq_flat.reshape(-1, n_landmarks, 3)
    reference_3d = reference_seq_flat.reshape(-1, n_landmarks, 3)
    idx1, idx2 = alignment.index1, alignment.index2
    per_landmark_distances = np.zeros((len(idx1), n_landmarks))
    for k, (i, j) in enumerate(zip(idx1, idx2)):
        per_landmark_distances[k] = np.linalg.norm(query_3d[i] - reference_3d[j], axis=1)
    return per_landmark_distances.mean(axis=0), alignment.normalizedDistance


def evaluate_attempt(query_seq_raw, predicted_class, top_n=5):
    if predicted_class not in references:
        raise ValueError(f"No reference exemplar available for class '{predicted_class}'")
    deviation_profile, overall_distance = compute_landmark_deviation(
        flatten_sequence(query_seq_raw), references[predicted_class]["sequence"])
    ranked_idx = np.argsort(deviation_profile)[::-1][:top_n]
    return {"predicted_class": predicted_class,
            "overall_dtw_distance": float(overall_distance),
            "deviation_profile": deviation_profile,
            "top_deviating_landmarks": [{"landmark": LANDMARK_NAMES[i], "deviation": float(deviation_profile[i])}
                                        for i in ranked_idx]}


def segment_by_motion_troughs(arr, trough_frac=0.3, min_len=20, max_len=150):
    diffs = np.diff(arr[:, :, :2], axis=0)
    motion_energy = np.linalg.norm(diffs, axis=2).sum(axis=1)
    is_low = motion_energy < motion_energy.mean() * trough_frac
    segments, in_segment, start = [], False, 0
    for i, low in enumerate(is_low):
        if not low and not in_segment:
            start, in_segment = i, True
        elif low and in_segment:
            segments.append((start, i)); in_segment = False
    if in_segment:
        segments.append((start, len(is_low)))
    return [(s, e) for s, e in segments if min_len <= (e - s) <= max_len]


def isolate_best_attempt(learner_seq, reference_seq, min_len=20, max_len=250):
    segments = segment_by_motion_troughs(learner_seq, trough_frac=0.3, min_len=min_len, max_len=max_len)
    if len(segments) <= 1:
        return learner_seq, False, len(segments)
    ref_flat = reference_seq.reshape(reference_seq.shape[0], -1)
    best_seg, best_dist = None, np.inf
    for (s, e) in segments:
        candidate = learner_seq[s:e]
        dist = dtw(candidate.reshape(candidate.shape[0], -1), ref_flat, dist_method="euclidean").distance
        if dist < best_dist:
            best_dist, best_seg = dist, candidate
    return best_seg, True, len(segments)


# ---------- Layers 2+3 together: recognise, then grade ----------
def grade_learner_attempt(raw_learner_seq, tcn_model, class_names, references, feature_scaler,
                          target_frames=TARGET_FRAMES, min_len=20, max_len=250, thresholds=None):
    """raw_learner_seq: the normalized (T, 49, 3) attempt sequence —
    preprocessing.normalize_raw_landmarks()'s output ("raw" here means
    un-resampled, as in the notebook, not un-normalized)."""
    thresholds = threshold_table if thresholds is None else thresholds
    coarse_segments = segment_by_motion_troughs(raw_learner_seq, trough_frac=0.3, min_len=min_len, max_len=max_len)
    tcn_input_seq = raw_learner_seq if len(coarse_segments) <= 1 else \
        raw_learner_seq[coarse_segments[0][0]:coarse_segments[0][1]]

    standardized = features_from_normalized(tcn_input_seq, feature_scaler["mean"], feature_scaler["std"])

    probs = predict_probs(tcn_model, standardized)
    predicted_idx = np.argmax(probs)
    predicted_class = class_names[predicted_idx]
    tcn_confidence = float(probs[predicted_idx])

    reference_seq = references[predicted_class]["sequence"].reshape(-1, N_LANDMARKS, 3)
    isolated_seq, was_multi_attempt, n_segments = isolate_best_attempt(raw_learner_seq, reference_seq, min_len, max_len)
    dtw_result = evaluate_attempt(isolated_seq, predicted_class)
    dist = dtw_result["overall_dtw_distance"]

    t = thresholds.get(predicted_class)
    if t:
        quality_tier = "strong" if dist <= t["strong_max"] else "moderate" if dist <= t["moderate_max"] else "weak"
    else:
        quality_tier = "unknown"
    return {"predicted_class": predicted_class, "tcn_confidence": tcn_confidence,
            "was_multi_attempt": was_multi_attempt, "n_repetitions_detected": n_segments,
            "dtw_distance": dist, "quality_tier": quality_tier,
            "top_deviating_landmarks": dtw_result["top_deviating_landmarks"],
            "probs": probs}


def grade(normalized_seq, model):
    """grade_learner_attempt() with the startup-loaded bundle."""
    return grade_learner_attempt(normalized_seq, model, class_names, references, feature_scaler)
