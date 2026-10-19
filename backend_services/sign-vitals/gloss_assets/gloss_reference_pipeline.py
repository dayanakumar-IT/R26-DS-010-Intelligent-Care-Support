"""GLOSS reference pipeline — copied VERBATIM from notebook 03 (Part A, cells A1/A2) on 9 Oct 2026.
This is the code that produced every Layer 3/4/6/7 number in the thesis. The app must behave exactly like it.
Use it as the reference implementation: port it, or import it, but do not change the logic.

Contents: ClassTokenPooling (custom layer of the ensemble) | preprocessing + DTW grading (grade_learner_attempt)
| rule-based feedback (generate_feedback) | learner model + lesson selection.
NOT included on purpose: the old Gemini prompt (generate_feedback_llm_phrased) - use gloss_feedback_guard.py instead.

Globals expected by these functions (set them with load_assets() below):
  N_LANDMARKS=49, TARGET_FRAMES=60, LANDMARK_NAMES, threshold_table (v3), references, feature_scaler, label_encoder
"""
import json, pickle, datetime, random
from pathlib import Path
import numpy as np
import tensorflow as tf
from dtw import dtw          # pip install dtw-python

N_LANDMARKS, TARGET_FRAMES = 49, 60


# ---------------- A1: custom layer of the ensemble ----------------
@tf.keras.utils.register_keras_serializable()
class ClassTokenPooling(tf.keras.layers.Layer):   # custom layer used by the SPOTER-style model
    def __init__(self, d_model, **kwargs):
        super().__init__(**kwargs)
        self.d_model = d_model

    def build(self, input_shape):
        self.class_token = self.add_weight(shape=(1, 1, self.d_model), initializer="random_normal",
                                           trainable=True, name="class_token")

    def call(self, x):
        token = tf.tile(self.class_token, [tf.shape(x)[0], 1, 1])
        return tf.concat([token, x], axis=1)



# ---------------- A2: preprocessing + DTW grading ----------------
from dtw import dtw

# ---------- preprocessing (same as training) ----------
def resample_sequence(arr, target_len=TARGET_FRAMES):
    T, L, C = arr.shape
    if T == target_len:
        return arr
    old_t = np.linspace(0, 1, T)
    new_t = np.linspace(0, 1, target_len)
    out = np.zeros((target_len, L, C), dtype=np.float32)
    for l in range(L):
        for c in range(C):
            out[:, l, c] = np.interp(new_t, old_t, arr[:, l, c])
    return out


def add_kinematic_features(X_flat, target_frames, n_landmarks):
    N = X_flat.shape[0]
    X = X_flat.reshape(N, target_frames, n_landmarks, 3)
    velocity = np.zeros_like(X)
    velocity[:, 1:] = X[:, 1:] - X[:, :-1]
    velocity[:, 0] = velocity[:, 1]
    acceleration = np.zeros_like(velocity)
    acceleration[:, 1:] = velocity[:, 1:] - velocity[:, :-1]
    acceleration[:, 0] = acceleration[:, 1]
    combined = np.concatenate([X, velocity, acceleration], axis=-1)
    return combined.reshape(N, target_frames, n_landmarks * 9)


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
def grade_learner_attempt(raw_learner_seq, tcn_model, label_encoder, references, feature_scaler,
                          target_frames=60, min_len=20, max_len=250, thresholds=None):
    thresholds = threshold_table if thresholds is None else thresholds
    coarse_segments = segment_by_motion_troughs(raw_learner_seq, trough_frac=0.3, min_len=min_len, max_len=max_len)
    tcn_input_seq = raw_learner_seq if len(coarse_segments) <= 1 else \
        raw_learner_seq[coarse_segments[0][0]:coarse_segments[0][1]]

    resampled = resample_sequence(tcn_input_seq, target_frames).reshape(1, target_frames, -1)
    kinematic = add_kinematic_features(resampled, target_frames, N_LANDMARKS)
    standardized = (kinematic - feature_scaler["mean"]) / feature_scaler["std"]

    probs = tcn_model.predict(standardized, verbose=0)[0]
    predicted_idx = np.argmax(probs)
    predicted_class = label_encoder.classes_[predicted_idx]
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
            "top_deviating_landmarks": dtw_result["top_deviating_landmarks"]}

# ---------------- A2: rule-based feedback ----------------
# ---------- Layer 4: explainable feedback ----------
HAND_LANDMARK_NAMES = {
    0: "wrist", 1: "thumb base", 2: "thumb knuckle", 3: "thumb joint", 4: "thumb tip",
    5: "index finger base", 6: "index finger middle joint", 7: "index finger upper joint", 8: "index fingertip",
    9: "middle finger base", 10: "middle finger middle joint", 11: "middle finger upper joint", 12: "middle fingertip",
    13: "ring finger base", 14: "ring finger middle joint", 15: "ring finger upper joint", 16: "ring fingertip",
    17: "pinky base", 18: "pinky middle joint", 19: "pinky upper joint", 20: "pinky tip",
}

def landmark_to_plain_english(landmark_name):
    for joint in ("wrist", "elbow", "shoulder"):
        if landmark_name in (f"left_{joint}", f"right_{joint}"):
            return f"{'left' if 'left' in landmark_name else 'right'} {joint}"
    if landmark_name == "nose":
        return "head position"
    if "_hand_" in landmark_name:
        side = "left" if landmark_name.startswith("left") else "right"
        return f"{side} {HAND_LANDMARK_NAMES.get(int(landmark_name.split('_')[-1]), 'hand')}"
    return landmark_name.replace("_", " ")


NON_ACTIONABLE_LANDMARKS = {"nose"}

def get_actionable_landmarks(top_deviating_landmarks, max_items=2):
    filtered = [d for d in top_deviating_landmarks if d["landmark"] not in NON_ACTIONABLE_LANDMARKS]
    return filtered[:max_items] if filtered else top_deviating_landmarks[:max_items]


def join_landmarks_naturally(names):
    return names[0] if len(names) == 1 else " and ".join(names)


def generate_feedback(result, confidence_threshold=0.6, low_confidence_cutoff=0.35):
    predicted, confidence, tier = result["predicted_class"], result["tcn_confidence"], result["quality_tier"]
    if confidence < low_confidence_cutoff:
        return {"full_text": "The system couldn't confidently identify which sign was performed. "
                             "Please try the sign again, making sure your hands are clearly visible.",
                "headline": "Sign not clearly recognized.", "quality_tier": "unclear", "cited_landmarks": [],
                "evidence": {"tcn_confidence": confidence, "dtw_distance": None, "raw_top_landmarks": []}}

    landmarks = get_actionable_landmarks(result["top_deviating_landmarks"])
    parts = []
    if confidence < confidence_threshold:
        parts.append(f"This looked like it might be '{predicted}', though the system wasn't fully certain.")
    else:
        parts.append(f"The sign was recognized as '{predicted}'.")
    if result.get("was_multi_attempt"):
        parts.append(f"It looks like you signed this {result['n_repetitions_detected']} times — "
                     f"your best attempt was used for grading.")
    if tier == "strong":
        parts.append("Your execution closely matched the reference sign. Well done.")
    elif tier == "moderate":
        parts.append(f"Your movement was reasonably close to the reference, with the largest "
                     f"difference around your {landmark_to_plain_english(landmarks[0]['landmark'])}.")
        parts.append("Try again, paying a little more attention to that movement.")
    elif tier == "weak":
        named = join_landmarks_naturally([landmark_to_plain_english(d["landmark"]) for d in landmarks])
        parts.append(f"Your movement differed noticeably from the reference sign, mainly around your {named}.")
        parts.append("Try slowing down and focusing on that part of the movement, then attempt it again.")
    else:
        parts.append("Not enough calibration data was available to grade this sign's execution quality yet.")

    return {"full_text": " ".join(parts), "headline": parts[0], "quality_tier": tier,
            "cited_landmarks": [landmark_to_plain_english(d["landmark"]) for d in landmarks],
            "evidence": {"tcn_confidence": confidence, "dtw_distance": result["dtw_distance"],
                         "raw_top_landmarks": result["top_deviating_landmarks"]}}



# ---------------- A2: learner model + lesson selection ----------------
# ---------- Layer 6: learner profile ----------
# Demo profiles go to the evidence folder so the original learner_profiles.json is never touched
DEMO_PROFILES_PATH = "learner_profiles.json"   # notebook wrote a demo file here; the app uses its own storage
MASTERY_STREAK_REQUIRED = 3
HISTORY_CAP = 10

def load_learner_profiles(path=DEMO_PROFILES_PATH):
    return json.load(open(path)) if Path(path).exists() else {}

def save_learner_profiles(profiles, path=DEMO_PROFILES_PATH):
    json.dump(profiles, open(path, "w"), indent=2)


def update_learner_profile(profiles, learner_id, target_sign, grading_result):
    key = f"{learner_id}::{target_sign}"
    if key not in profiles:
        profiles[key] = {"learner_id": learner_id, "sign": target_sign, "attempts": 0,
                         "consecutive_strong": 0, "mastery_status": "not_started",
                         "recognition_mismatches": 0, "history": [], "last_practiced": None}
    profile = profiles[key]
    predicted, tier = grading_result["predicted_class"], grading_result["quality_tier"]
    now = datetime.datetime.now().isoformat()
    profile["attempts"] += 1
    profile["last_practiced"] = now
    if predicted != target_sign:
        profile["recognition_mismatches"] += 1
        profile["consecutive_strong"] = 0
        event = {"timestamp": now, "outcome": "recognition_mismatch", "predicted_instead": predicted,
                 "tcn_confidence": grading_result["tcn_confidence"]}
    else:
        profile["consecutive_strong"] = profile["consecutive_strong"] + 1 if tier == "strong" else 0
        event = {"timestamp": now, "outcome": tier, "dtw_distance": grading_result["dtw_distance"],
                 "tcn_confidence": grading_result["tcn_confidence"],
                 "top_landmarks": [d["landmark"] for d in grading_result["top_deviating_landmarks"][:2]]}
    profile["history"] = (profile["history"] + [event])[-HISTORY_CAP:]
    if profile["consecutive_strong"] >= MASTERY_STREAK_REQUIRED:
        profile["mastery_status"] = "mastered"
    elif profile["attempts"] >= 2:
        profile["mastery_status"] = "practicing"
    else:
        profile["mastery_status"] = "learning"
    return profile


# ---------- Layer 7: next lesson ----------
def get_next_lesson(profiles, learner_id, all_signs, n_signs=5):
    scored = []
    for sign in all_signs:
        p = profiles.get(f"{learner_id}::{sign}")
        if p is None:
            scored.append((sign, 5, "never_attempted"))
        elif p["mastery_status"] == "mastered":
            scored.append((sign, 100, "mastered"))
        else:
            scored.append((sign, max(0, p["attempts"] - p["consecutive_strong"] - 3), p["mastery_status"]))
    random.shuffle(scored)          # break ties randomly, not alphabetically
    scored.sort(key=lambda x: x[1])
    return [{"sign": s, "reason": reason} for s, _, reason in scored[:n_signs]]


# all_signs = [str(c) for c in label_encoder.classes_]   (set after load_assets)

# ---------------- loading the product bundle ----------------
def load_assets(assets_dir="gloss_assets"):
    """Loads everything the functions above need, from the fingerprinted product bundle."""
    global LANDMARK_NAMES, threshold_table, all_signs, references, feature_scaler, label_encoder
    a = Path(assets_dir)
    LANDMARK_NAMES = json.load(open(a / "landmark_names.json"))
    threshold_table = json.load(open(a / "class_thresholds.json"))          # v3
    loaded_refs = np.load(a / "reference_exemplars.npz")
    references = {cls.replace("_", " "): {"sequence": loaded_refs[cls]} for cls in loaded_refs.files}
    s = np.load(a / "feature_scaler.npz")
    feature_scaler = {"mean": s["mean"], "std": s["std"]}
    with open(a / "label_encoder.pkl", "rb") as f:
        label_encoder = pickle.load(f)
    model = tf.keras.models.load_model(a / "GLOSS_ensemble.keras", compile=False,
                                       custom_objects={"ClassTokenPooling": ClassTokenPooling})
    all_signs = [str(c) for c in label_encoder.classes_]
    return model
