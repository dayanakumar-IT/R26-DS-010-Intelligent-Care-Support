"""
preprocessing.py
GLOSS component — inference-time preprocessing.

This is a direct, unmodified transcription of the preprocessing logic
from PP2_Sign_Language_Training.ipynb (Layer 1: Stages 3-6, Layer 2
Phase 1: Stage 2). Every formula below matches the notebook exactly —
nothing here was rederived or approximated. If the notebook's logic
ever changes, this file must be re-synced from it, not edited
independently.

Source cells (for traceability):
  - Landmark index map + extraction  -> notebook cells 9, 11
  - Missing-landmark repair           -> notebook cell 14
  - Normalization                     -> notebook cell 16
  - Temporal resampling to 60 frames  -> notebook cell 20
  - Kinematic features (147->441)     -> notebook cell 59
  - Standardization                   -> notebook cell 60 (uses the
    saved feature_scaler.npz mean/std, NOT recomputed here)

Note: training-time augmentation (notebook cell 57) is intentionally
NOT included here — it's explicitly train-split-only in the notebook
("Stage 1 - Landmark-sequence augmentation (train split only)") and
must never run at inference time.

This module deliberately imports neither `mediapipe` nor `cv2` at the
top level, so it can be imported in the main .venv (FastAPI/TensorFlow)
without MediaPipe installed. Raw landmark extraction lives in
landmark_extraction.py instead, which only .venv_mediapipe needs to
import. See preprocess_video_for_inference() below for the one place
that bridges the two (used only for local testing under
.venv_mediapipe) and extract_landmarks_bridge.py for the subprocess
bridge used by the main app.
"""

import numpy as np
import pandas as pd

# ---------------------------------------------------------------
# Stage 2 (notebook cell 9) — landmark index map
# ---------------------------------------------------------------
POSE_IDX = {
    "left_shoulder": 11, "right_shoulder": 12,
    "left_elbow": 13,    "right_elbow": 14,
    "left_wrist": 15,    "right_wrist": 16,
    "nose": 0,
}
POSE_ORDER = ["nose", "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", "left_wrist", "right_wrist"]

N_HAND_LANDMARKS = 21
N_POSE_LANDMARKS = len(POSE_ORDER)                              # 7
N_TOTAL_LANDMARKS = N_POSE_LANDMARKS + 2 * N_HAND_LANDMARKS      # 49
N_FEATURES_PER_FRAME = N_TOTAL_LANDMARKS * 3                     # 147
TARGET_FRAMES = 60

LEFT_SHOULDER_IDX = POSE_ORDER.index("left_shoulder")
RIGHT_SHOULDER_IDX = POSE_ORDER.index("right_shoulder")


# ---------------------------------------------------------------
# Stage 3 (notebook cell 11) — per-video landmark extraction
#
# The MediaPipe-dependent implementation (extract_landmarks_from_video,
# make_holistic) now lives in landmark_extraction.py, since it requires
# `mediapipe` and `cv2`, which are only installed in .venv_mediapipe.
# It still uses POSE_IDX/POSE_ORDER/N_* below — unchanged, unmoved.
# ---------------------------------------------------------------


# ---------------------------------------------------------------
# Stage 4 (notebook cell 14) — missing-landmark repair
# ---------------------------------------------------------------
def interpolate_missing(arr):
    """arr: (T, 49, 3) with NaNs. Returns repaired array + fraction still missing after repair."""
    T, L, C = arr.shape
    out = arr.copy()
    for l in range(L):
        for c in range(C):
            series = pd.Series(out[:, l, c])
            if series.isna().all():
                series = series.fillna(0.0)
            else:
                series = series.interpolate(method="linear", limit_direction="both")
            out[:, l, c] = series.values
    still_missing = float(np.isnan(out).mean())
    return out, still_missing


# ---------------------------------------------------------------
# Stage 5 (notebook cell 16) — translation, scale, rotation normalization
# ---------------------------------------------------------------
def normalize_sequence(arr, eps=1e-6):
    """arr: (T, 49, 3) already NaN-repaired. Returns normalized (T, 49, 3)."""
    T = arr.shape[0]
    out = np.zeros_like(arr)

    for t in range(T):
        frame = arr[t]
        l_sh = frame[LEFT_SHOULDER_IDX]
        r_sh = frame[RIGHT_SHOULDER_IDX]
        mid_shoulder = (l_sh + r_sh) / 2.0

        centered = frame - mid_shoulder

        shoulder_width = np.linalg.norm((r_sh - l_sh)[:2]) + eps
        scaled = centered / shoulder_width

        l_sh_c, r_sh_c = scaled[LEFT_SHOULDER_IDX], scaled[RIGHT_SHOULDER_IDX]
        dx, dy = (r_sh_c - l_sh_c)[0], (r_sh_c - l_sh_c)[1]
        theta = np.arctan2(dy, dx)
        cos_t, sin_t = np.cos(-theta), np.sin(-theta)
        rot_matrix = np.array([[cos_t, -sin_t], [sin_t, cos_t]])

        rotated = scaled.copy()
        rotated[:, :2] = scaled[:, :2] @ rot_matrix.T
        # z is left as scaled depth; MediaPipe z is already relative depth, not rotated
        out[t] = rotated

    return out


# ---------------------------------------------------------------
# Stage 6 (notebook cell 20) — temporal resampling to TARGET_FRAMES
# ---------------------------------------------------------------
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


# ---------------------------------------------------------------
# Phase 1, Stage 2 (notebook cell 59) — kinematic features, 147 -> 441
# ---------------------------------------------------------------
def add_kinematic_features(X_flat, target_frames, n_landmarks):
    """X_flat: (N, T, L*3) position-only. Returns (N, T, L*3*3) [position, velocity, acceleration]."""
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


# ---------------------------------------------------------------
# Full inference pipeline, from raw landmarks: raw (T,49,3) ->
# (TCN tensor, resampled positional array, variable-length DTW sequence)
#
# This is the function the main .venv app should call — it takes
# already-extracted raw landmarks (e.g. from the subprocess bridge)
# and never touches mediapipe/cv2.
# ---------------------------------------------------------------
def preprocess_landmarks_for_inference(raw_landmarks, feature_mean, feature_std):
    """
    raw_landmarks: np.ndarray of shape (T, 49, 3), NaN where a landmark
      was not detected — exactly what extract_landmarks_from_video()
      returns.
    feature_mean, feature_std: the arrays loaded from feature_scaler.npz
      (saved at training time in notebook cell 60) — never recomputed here.

    Returns a tuple (tensor, positional, dtw_sequence):
      - tensor: np.ndarray of shape (1, 60, 441), standardized,
        ready for model.predict() (TCN input).
      - positional: np.ndarray of shape (60, 147), resampled but
        NOT standardized and NOT kinematic-expanded.
      - dtw_sequence: np.ndarray of shape (T, 147), the ORIGINAL
        variable-length normalized sequence — BEFORE resampling to
        TARGET_FRAMES. This, not `positional`, is what DTW needs
        (confirmed against notebook cell 23 and calibration data —
        see dtw.py): the same representation stored in
        gloss_sign_references and reference_exemplars.npz. T matches
        the video's actual detected frame count.
    Returns (None, None, None) if raw_landmarks is None or too short.
    """
    if raw_landmarks is None or raw_landmarks.shape[0] < 3:
        return None, None, None

    repaired, _ = interpolate_missing(raw_landmarks)
    normalized = normalize_sequence(repaired)                          # (T, 49, 3)
    dtw_sequence = normalized.reshape(-1, N_FEATURES_PER_FRAME).astype(np.float32)  # (T, 147)

    resampled = resample_sequence(normalized, TARGET_FRAMES)          # (60, 49, 3)

    flat = resampled.reshape(1, TARGET_FRAMES, N_FEATURES_PER_FRAME)  # (1, 60, 147)
    positional = flat.reshape(TARGET_FRAMES, N_FEATURES_PER_FRAME).astype(np.float32)  # (60, 147)

    kinematic = add_kinematic_features(flat, TARGET_FRAMES, N_TOTAL_LANDMARKS)  # (1, 60, 441)

    standardized = (kinematic - feature_mean) / feature_std
    return standardized.astype(np.float32), positional, dtw_sequence


# ---------------------------------------------------------------
# Convenience wrapper: video -> (TCN tensor, DTW positional array)
#
# Only usable where mediapipe/cv2 are installed (.venv_mediapipe).
# The import is local/lazy so importing this module elsewhere (e.g.
# the main .venv) never requires mediapipe — only calling this
# particular function does. The main app should use the subprocess
# bridge (extract_landmarks_bridge.py) + preprocess_landmarks_for_
# inference() above instead.
# ---------------------------------------------------------------
def preprocess_video_for_inference(video_path, feature_mean, feature_std):
    """
    video_path: path to a single caregiver attempt clip.
    feature_mean, feature_std: the arrays loaded from feature_scaler.npz.

    Returns the same (tensor, positional, dtw_sequence) tuple as
    preprocess_landmarks_for_inference(). Returns (None, None, None)
    if no frames could be extracted (e.g. corrupt/empty video).
    """
    from landmark_extraction import extract_landmarks_from_video, make_holistic

    holistic = make_holistic()
    try:
        raw = extract_landmarks_from_video(video_path, holistic)
    finally:
        holistic.close()

    return preprocess_landmarks_for_inference(raw, feature_mean, feature_std)
