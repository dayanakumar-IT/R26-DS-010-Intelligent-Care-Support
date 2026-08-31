"""
landmark_extraction.py
GLOSS component — MediaPipe-dependent raw landmark extraction.

This is the exact extraction logic that used to live in
preprocessing.py (notebook cells 9, 11, 12), moved here unchanged so
that preprocessing.py itself never needs to import mediapipe/cv2.
Only .venv_mediapipe has these packages installed; only this module
(and extract_landmarks_worker.py, which runs under .venv_mediapipe)
should import them.

Do not add interpolation, normalization, resampling, kinematic
features, or standardization here — this module's only job is turning
a video into a raw (T, 49, 3) landmark array, NaN where a landmark was
not detected. Everything downstream lives in preprocessing.py.
"""

import numpy as np
import cv2
import mediapipe as mp

from preprocessing import (
    POSE_IDX,
    POSE_ORDER,
    N_POSE_LANDMARKS,
    N_HAND_LANDMARKS,
    N_TOTAL_LANDMARKS,
)

mp_holistic = mp.solutions.holistic


# ---------------------------------------------------------------
# Stage 3 (notebook cell 11) — per-video landmark extraction
# ---------------------------------------------------------------
def extract_landmarks_from_video(video_path, holistic):
    """Returns array of shape (n_frames, 49, 3), NaN where a landmark was not detected."""
    cap = cv2.VideoCapture(str(video_path))
    frames_landmarks = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = holistic.process(rgb)

        frame_lm = np.full((N_TOTAL_LANDMARKS, 3), np.nan, dtype=np.float32)

        if results.pose_landmarks:
            for i, name in enumerate(POSE_ORDER):
                lm = results.pose_landmarks.landmark[POSE_IDX[name]]
                frame_lm[i] = [lm.x, lm.y, lm.z]

        if results.left_hand_landmarks:
            for j, lm in enumerate(results.left_hand_landmarks.landmark):
                frame_lm[N_POSE_LANDMARKS + j] = [lm.x, lm.y, lm.z]

        if results.right_hand_landmarks:
            for j, lm in enumerate(results.right_hand_landmarks.landmark):
                frame_lm[N_POSE_LANDMARKS + N_HAND_LANDMARKS + j] = [lm.x, lm.y, lm.z]

        frames_landmarks.append(frame_lm)

    cap.release()
    if len(frames_landmarks) == 0:
        return None
    return np.stack(frames_landmarks, axis=0)  # (T, 49, 3)


def make_holistic():
    """Same settings as training (notebook cell 12)."""
    return mp_holistic.Holistic(
        static_image_mode=False,
        model_complexity=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )
