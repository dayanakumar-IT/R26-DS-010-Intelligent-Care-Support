import numpy as np

from preprocessing import preprocess_video_for_inference


VIDEO_PATH = "test_samples/eat.mp4"
SCALER_PATH = "models/feature_scaler.npz"


scaler = np.load(SCALER_PATH)

feature_mean = scaler["mean"]
feature_std = scaler["std"]

print("Scaler mean shape:", feature_mean.shape)
print("Scaler std shape:", feature_std.shape)

X, positional, dtw_sequence = preprocess_video_for_inference(
    VIDEO_PATH,
    feature_mean,
    feature_std,
)

if X is None:
    print("ERROR: preprocessing returned None")
else:
    print("Preprocessing successful")
    print("Tensor (TCN input) shape:", X.shape)
    print("Tensor dtype:", X.dtype)
    print("Tensor contains NaN:", np.isnan(X).any())
    print("Tensor contains Inf:", np.isinf(X).any())

    print("Positional (60,147 resampled) shape:", positional.shape)
    print("Positional dtype:", positional.dtype)
    print("Positional contains NaN:", np.isnan(positional).any())
    print("Positional contains Inf:", np.isinf(positional).any())
    print("Positional min/max/mean:", positional.min(), positional.max(), positional.mean())

    print("DTW sequence (variable-length, pre-resample) shape:", dtw_sequence.shape)
    print("DTW sequence dtype:", dtw_sequence.dtype)
    print("DTW sequence contains NaN:", np.isnan(dtw_sequence).any())
    print("DTW sequence contains Inf:", np.isinf(dtw_sequence).any())
    print("DTW sequence min/max/mean:", dtw_sequence.min(), dtw_sequence.max(), dtw_sequence.mean())

    np.save("test_samples/preprocessed_sample.npy", X)
    np.save("test_samples/preprocessed_positional.npy", positional)
    np.save("test_samples/preprocessed_dtw_sequence.npy", dtw_sequence)
    print("Saved tensor to test_samples/preprocessed_sample.npy")
    print("Saved positional array to test_samples/preprocessed_positional.npy")
    print("Saved DTW sequence to test_samples/preprocessed_dtw_sequence.npy")