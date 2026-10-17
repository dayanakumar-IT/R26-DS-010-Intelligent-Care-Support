# backend/src/features.py
import os
import numpy as np

from config.settings import (
    FRAME_RATE,
    PROCESSED_DATA_DIR,
    JOINT,
    FEATURE_NAMES,
    NUM_FEATURES,
)


class FeatureExtractor:
    """
    Extracts 18 hand-crafted kinematic / postural features from a single
    (T, 14, 3) skeleton sequence after spatial normalisation.

    Conventions (after `apply_spatial_normalization`):
      - hip-midpoint is at origin
      - +y is "up" (neck above hip in normalised coords)
      - distances are expressed in torso-lengths
    """

    def __init__(self, fps=FRAME_RATE):
        self.dt = 1.0 / fps

    def extract_sequence_features(self, sequence_tensor):
        # Accept (T, 14, 3) or (T, 14, 4); features are computed on xyz only.
        seq = np.asarray(sequence_tensor, dtype=np.float32)
        if seq.shape[-1] == 4:
            seq = seq[..., :3]
        head = seq[:, JOINT["head"], :]
        neck = seq[:, JOINT["neck"], :]
        l_hip = seq[:, JOINT["l_hip"], :]
        r_hip = seq[:, JOINT["r_hip"], :]
        hip_centre = (l_hip + r_hip) / 2.0

        # Frame-to-frame derivatives
        v_hip = (hip_centre[1:] - hip_centre[:-1]) / self.dt          # (T-1, 3)
        v_head = (head[1:] - head[:-1]) / self.dt
        a_hip = (v_hip[1:] - v_hip[:-1]) / self.dt                    # (T-2, 3)

        # Note: vertical drop is a DECREASE in y. We report the *signed
        # downward* component (negate y) so that a fall produces large
        # positive values for these features.
        vy_hip_down = -v_hip[:, 1]
        vy_head_down = -v_head[:, 1]
        ay_hip = a_hip[:, 1]

        # ----- Category 1: velocities (F1..F4) ------------------------
        f1 = float(np.mean(vy_hip_down))
        f2 = float(np.max(vy_hip_down))
        f3 = float(np.mean(np.abs(v_hip[:, 0])))
        f4 = float(np.mean(vy_head_down))

        # ----- Category 2: acceleration & kinetic energy (F5..F7) -----
        f5 = float(np.max(np.abs(ay_hip))) if len(ay_hip) > 0 else 0.0

        frame_diffs = sequence_tensor[1:] - sequence_tensor[:-1]
        kinetic_per_frame = np.sum(frame_diffs ** 2, axis=(1, 2)) / self.dt
        f6 = float(np.mean(kinetic_per_frame))
        f7 = float(np.max(kinetic_per_frame))

        # ----- Category 3: posture / orientation (F8..F12) ------------
        torso_vec = neck - hip_centre
        torso_norm = np.linalg.norm(torso_vec, axis=1, keepdims=True)
        torso_norm[torso_norm < 1e-6] = 1e-6
        unit_torso = torso_vec / torso_norm
        # Angle from the vertical (+y) axis
        cos_theta = np.clip(unit_torso[:, 1], -1.0, 1.0)
        torso_angle = np.arccos(cos_theta)                           # (T,)
        f8 = float(np.mean(torso_angle))
        f9 = float(np.max(torso_angle))
        omega = (torso_angle[1:] - torso_angle[:-1]) / self.dt
        f10 = float(np.mean(np.abs(omega)))

        widths = sequence_tensor[:, :, 0].max(axis=1) - sequence_tensor[:, :, 0].min(axis=1)
        heights = sequence_tensor[:, :, 1].max(axis=1) - sequence_tensor[:, :, 1].min(axis=1)
        heights_safe = np.where(heights < 1e-6, 1e-6, heights)
        aspect = widths / heights_safe
        f11 = float(np.mean(aspect))
        f12 = float(np.max(aspect))

        # ----- Category 4: micro-instability (F13..F18) ---------------
        std_sway = float(np.std(torso_angle))
        # Oscillation count: times torso angle crosses its mean (normalised by length)
        angle_centered = torso_angle - float(np.mean(torso_angle))
        osc_count = float(np.sum(np.diff(np.sign(angle_centered)) != 0))
        osc_norm = osc_count / max(len(torso_angle) - 1, 1)
        # F13 blends sway std + oscillation rate for richer micro-instability signal
        f13 = 0.6 * std_sway + 0.4 * osc_norm
        f14 = float(np.std(hip_centre[:, 0]))
        f15 = float(np.std(hip_centre[:, 1]))
        f16 = float(np.sum(np.linalg.norm(hip_centre[1:] - hip_centre[:-1], axis=1)))
        f17 = float(np.min(heights_safe) / (np.max(heights_safe) + 1e-6))
        centroids = sequence_tensor.mean(axis=1, keepdims=True)
        dispersion = np.linalg.norm(sequence_tensor - centroids, axis=2)
        f18 = float(np.mean(dispersion))

        vec = np.array(
            [f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11, f12, f13, f14, f15, f16, f17, f18],
            dtype=np.float32,
        )
        assert vec.shape == (NUM_FEATURES,) and len(FEATURE_NAMES) == NUM_FEATURES
        # Guard against any NaN/Inf from degenerate inputs.
        vec = np.nan_to_num(vec, nan=0.0, posinf=0.0, neginf=0.0)
        return vec

    def batch_compile_features(self, data_npy_path, out_npy_path):
        sequences = np.load(data_npy_path)
        print(f"[features] extracting {NUM_FEATURES} features from {sequences.shape[0]} sequences ...")
        out = np.zeros((sequences.shape[0], NUM_FEATURES), dtype=np.float32)
        for i in range(sequences.shape[0]):
            out[i] = self.extract_sequence_features(sequences[i])
        np.save(out_npy_path, out)
        print(f"[features] wrote {out.shape} -> {out_npy_path}")
        return out


if __name__ == "__main__":
    extractor = FeatureExtractor()
    for stem in ("ntu", "ur"):
        in_path = os.path.join(PROCESSED_DATA_DIR, f"{stem}_data.npy")
        out_path = os.path.join(PROCESSED_DATA_DIR, f"{stem}_features.npy")
        if os.path.exists(in_path):
            extractor.batch_compile_features(in_path, out_path)
        else:
            print(f"[features] skipping {stem}: {in_path} missing")
