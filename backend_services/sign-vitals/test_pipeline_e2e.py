"""
test_pipeline_e2e.py
GLOSS component — Phase 1 architecture verification.

Runs the FULL pipeline from the main .venv (no MediaPipe installed
here): subprocess -> .venv_mediapipe for raw landmark extraction, then
the rest of preprocessing.py in-process, then a TCN model.predict()
regression check. Run this with .venv's python, NOT .venv_mediapipe's.
"""

import sys

import numpy as np
import tensorflow as tf

from extract_landmarks_bridge import extract_landmarks_via_subprocess
from preprocessing import preprocess_landmarks_for_inference

VIDEO_PATH = sys.argv[1] if len(sys.argv) > 1 else "test_samples/pain.mp4"
SCALER_PATH = "models/feature_scaler.npz"
MODEL_PATH = "models/TCN_FINAL_layer2.keras"

print(f"=== GLOSS Phase 1 end-to-end pipeline check ({VIDEO_PATH}) ===")

print("\n[1] Extracting raw landmarks via subprocess (.venv_mediapipe)...")
raw = extract_landmarks_via_subprocess(VIDEO_PATH)
print("    subprocess completed successfully")
print("    raw landmark shape:", raw.shape)
print("    raw landmark dtype:", raw.dtype)
assert raw.ndim == 3 and raw.shape[1:] == (49, 3), f"unexpected raw shape {raw.shape}"

print("\n[2] Loading feature scaler...")
scaler = np.load(SCALER_PATH)
feature_mean, feature_std = scaler["mean"], scaler["std"]
print("    mean shape:", feature_mean.shape, "std shape:", feature_std.shape)

print("\n[3] Running preprocess_landmarks_for_inference() in-process (.venv)...")
tensor, positional, dtw_sequence = preprocess_landmarks_for_inference(raw, feature_mean, feature_std)
print("    DTW positional (60,147 resampled) shape:", positional.shape)
print("    DTW positional dtype:", positional.dtype)
print("    DTW positional NaN:", bool(np.isnan(positional).any()))
print("    DTW positional Inf:", bool(np.isinf(positional).any()))
print("    DTW sequence (variable-length, pre-resample) shape:", dtw_sequence.shape)
print("    DTW sequence dtype:", dtw_sequence.dtype)
print("    DTW sequence NaN:", bool(np.isnan(dtw_sequence).any()))
print("    DTW sequence Inf:", bool(np.isinf(dtw_sequence).any()))
print("    TCN tensor shape:", tensor.shape)
print("    TCN tensor dtype:", tensor.dtype)
print("    TCN tensor NaN:", bool(np.isnan(tensor).any()))
print("    TCN tensor Inf:", bool(np.isinf(tensor).any()))

assert positional.shape == (60, 147), f"unexpected positional shape {positional.shape}"
assert dtw_sequence.ndim == 2 and dtw_sequence.shape[1] == 147, f"unexpected dtw_sequence shape {dtw_sequence.shape}"
assert dtw_sequence.shape[0] == raw.shape[0], "dtw_sequence frame count should match raw landmark frame count"
assert tensor.shape == (1, 60, 441), f"unexpected tensor shape {tensor.shape}"
assert not np.isnan(positional).any() and not np.isinf(positional).any()
assert not np.isnan(dtw_sequence).any() and not np.isinf(dtw_sequence).any()
assert not np.isnan(tensor).any() and not np.isinf(tensor).any()

print("\n[4] Regression check: feeding TCN tensor into the model...")
model = tf.keras.models.load_model(MODEL_PATH, compile=False)
prediction = model.predict(tensor, verbose=0)
print("    model output shape:", prediction.shape)
assert prediction.shape == (1, 59), f"unexpected model output shape {prediction.shape}"

print("\n=== ALL CHECKS PASSED ===")
