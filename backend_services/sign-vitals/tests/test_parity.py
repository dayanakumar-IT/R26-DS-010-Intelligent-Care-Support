"""
tests/test_parity.py
GLOSS component — recogniser parity check against the training notebook.

Loads gloss_assets/parity_check.npz (10 normalized, 60-frame test
sequences plus the ensemble's expected output from the notebook), runs
each one through the app's OWN preprocessing
(preprocessing.features_from_normalized) and the app's OWN model
loader/predict (recogniser.load_ensemble / predict_probs), and asserts:

  - the predicted class equals expected_class;
  - the probabilities match expected_probs within 1e-4.

Also asserts that the SHA-256 fingerprint (first 12 hex chars) of EVERY
file listed in gloss_assets/manifest.json that exists in gloss_assets/
equals the manifest's value.

Run with .venv's python, from anywhere:
    python tests/test_parity.py
(also collectable by pytest).
"""

import hashlib
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from preprocessing import features_from_normalized  # noqa: E402
from recogniser import ASSETS_DIR, MODEL_FILENAME, MODEL_PATH, load_ensemble, predict_probs  # noqa: E402

TOLERANCE = 1e-4


def _fingerprint(path: str) -> str:
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:12]


def test_manifest_fingerprints():
    """Every file listed in manifest.json that exists in gloss_assets/
    must match its fingerprint. (The two member models of the ensemble
    are listed but deliberately not shipped.)"""
    with open(os.path.join(ASSETS_DIR, "manifest.json")) as f:
        manifest = json.load(f)
    assert MODEL_FILENAME in manifest and os.path.exists(MODEL_PATH)

    mismatches = []
    for name, entry in manifest.items():
        path = os.path.join(ASSETS_DIR, name)
        if not os.path.exists(path):
            print(f"fingerprint {name:<28} not in gloss_assets/ (skipped)")
            continue
        actual = _fingerprint(path)
        ok = actual == entry["fingerprint"]
        print(f"fingerprint {name:<28} actual={actual} manifest={entry['fingerprint']} {'OK' if ok else 'FAIL'}")
        if not ok:
            mismatches.append(name)

    assert not mismatches, f"fingerprint mismatch: {mismatches}"


def test_recogniser_parity():
    parity = np.load(os.path.join(ASSETS_DIR, "parity_check.npz"))
    landmarks = parity["landmarks"]            # (10, 60, 49, 3)
    expected_probs = parity["expected_probs"]  # (10, 59)
    expected_class = parity["expected_class"]  # (10,)
    assert landmarks.shape == (10, 60, 49, 3), landmarks.shape

    scaler = np.load(os.path.join(ASSETS_DIR, "feature_scaler.npz"))
    mean, std = scaler["mean"], scaler["std"]
    assert mean.shape == (441,) and std.shape == (441,), (mean.shape, std.shape)

    with open(os.path.join(ASSETS_DIR, "class_names.json")) as f:
        class_names = json.load(f)

    model = load_ensemble()

    failures = []
    for i in range(landmarks.shape[0]):
        tensor = features_from_normalized(landmarks[i], mean, std)
        assert tensor.shape == (1, 60, 441), tensor.shape
        probs = predict_probs(model, tensor)
        predicted = class_names[int(np.argmax(probs))]
        max_diff = float(np.abs(probs - expected_probs[i]).max())
        ok = predicted == str(expected_class[i]) and max_diff <= TOLERANCE
        print(
            f"[{i}] expected={str(expected_class[i]):<12} predicted={predicted:<12} "
            f"max_abs_prob_diff={max_diff:.2e} {'OK' if ok else 'FAIL'}"
        )
        if not ok:
            failures.append(i)

    assert not failures, f"parity failed for sequences {failures}"


if __name__ == "__main__":
    test_manifest_fingerprints()
    test_recogniser_parity()
    print("PARITY TEST PASSED (10/10)")
