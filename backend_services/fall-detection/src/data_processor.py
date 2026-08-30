# backend/src/data_processor.py
"""
Data preprocessing utilities. The canonical sequence tensor is
(T, 14, C) where C == 4:
    columns 0..2 = xyz
    column   3   = visibility ∈ [0, 1]

For NTU (Kinect) visibility is synthesised as 1.0 for joints present
in the source frame. For MediaPipe (UR + live inference) visibility
is the real per-joint confidence.
"""
import numpy as np

from config.settings import (
    TARGET_FRAMES,
    MEDIAPIPE_JOINT_MAP,
    NUM_JOINTS,
    JOINT,
    LR_FLIP_PAIRS,
)


NUM_CHANNELS = 4       # x, y, z, visibility
XYZ = slice(0, 3)


class DataProcessor:
    # ---------------------------------------------------------------
    # MediaPipe (33 landmarks) -> our 14-joint layout (14, 4)
    # ---------------------------------------------------------------
    @staticmethod
    def extract_mediapipe_14_joints(mp_results):
        matrix = np.zeros((NUM_JOINTS, NUM_CHANNELS), dtype=np.float32)
        lms = mp_results.pose_landmarks.landmark

        for our_idx, mp_idx in MEDIAPIPE_JOINT_MAP.items():
            lm = lms[mp_idx]
            matrix[our_idx] = (lm.x, lm.y, lm.z, lm.visibility)

        ls = matrix[JOINT["l_shoulder"]]
        rs = matrix[JOINT["r_shoulder"]]
        matrix[JOINT["neck"], :3] = (ls[:3] + rs[:3]) / 2.0
        matrix[JOINT["neck"], 3] = min(ls[3], rs[3])
        return matrix

    # ---------------------------------------------------------------
    # Spatial normalisation
    #
    # `apply_clip_normalization` anchors the entire clip to the
    # patient's pose at the start of the sequence:
    #   * origin = median hip-midpoint over the first 5 frames
    #   * scale  = median torso length over the first 5 frames
    #
    # Taking a median rather than the frame-0 value protects against
    # a single bad first frame (a MediaPipe glitch with torso ~= 0
    # would otherwise blow the entire clip up by 1e6).  This is B7.
    #
    # Only the xyz channels are normalised; visibility is passed
    # through unchanged.
    # ---------------------------------------------------------------
    @staticmethod
    def apply_clip_normalization(sequence_tensor):
        seq = np.asarray(sequence_tensor, dtype=np.float32).copy()
        if seq.ndim != 3 or seq.shape[1] != NUM_JOINTS:
            raise ValueError(f"expected (T, 14, C), got {seq.shape}")
        C = seq.shape[-1]
        # Promote a legacy (T,14,3) tensor to (T,14,4) with visibility=1.
        if C == 3:
            vis = np.ones(seq.shape[:2] + (1,), dtype=np.float32)
            seq = np.concatenate([seq, vis], axis=-1)
            C = 4

        l_hip, r_hip, neck = JOINT["l_hip"], JOINT["r_hip"], JOINT["neck"]
        head = min(5, seq.shape[0])

        hip_head = (seq[:head, l_hip, :3] + seq[:head, r_hip, :3]) / 2.0
        hip_origin = np.median(hip_head, axis=0)              # (3,)
        seq[:, :, :3] -= hip_origin

        neck_dist_head = np.linalg.norm(seq[:head, neck, :3], axis=1)
        torso_scale = float(np.median(neck_dist_head))
        if torso_scale > 1e-3:
            seq[:, :, :3] /= torso_scale
        return seq

    @staticmethod
    def apply_spatial_normalization(sequence_tensor):
        """Per-frame hip-centred normalisation (ablation only)."""
        seq = np.asarray(sequence_tensor, dtype=np.float32).copy()
        if seq.shape[-1] == 3:
            vis = np.ones(seq.shape[:2] + (1,), dtype=np.float32)
            seq = np.concatenate([seq, vis], axis=-1)
        l_hip, r_hip, neck = JOINT["l_hip"], JOINT["r_hip"], JOINT["neck"]
        out = seq.copy()
        for f in range(seq.shape[0]):
            frame = seq[f]
            origin = (frame[l_hip, :3] + frame[r_hip, :3]) / 2.0
            frame_xyz = frame[:, :3] - origin
            scale = float(np.linalg.norm(frame_xyz[neck]))
            if scale > 1e-3:
                frame_xyz /= scale
            out[f, :, :3] = frame_xyz
        return out

    # ---------------------------------------------------------------
    # Temporal alignment: uniform 90-frame window
    # ---------------------------------------------------------------
    @staticmethod
    def enforce_temporal_uniformity(sequence_data, target_frames=TARGET_FRAMES):
        seq = np.asarray(sequence_data, dtype=np.float32)
        t = len(seq)
        if t == target_frames:
            return seq
        if t < 2:
            return np.repeat(seq, target_frames, axis=0)
        src_idx = np.linspace(0.0, t - 1.0, num=target_frames)
        floor = np.floor(src_idx).astype(np.int64)
        ceil = np.minimum(floor + 1, t - 1)
        frac = (src_idx - floor).astype(np.float32)[:, None, None]
        return ((1.0 - frac) * seq[floor] + frac * seq[ceil]).astype(np.float32)

    # ---------------------------------------------------------------
    # Augmentations (training only)
    #
    # All augmentations act on xyz only; visibility passes through.
    # ---------------------------------------------------------------
    @staticmethod
    def random_lr_flip(seq, rng):
        out = seq.copy()
        for a, b in LR_FLIP_PAIRS:
            out[:, a], out[:, b] = seq[:, b].copy(), seq[:, a].copy()
        out[:, :, 0] = -out[:, :, 0]
        return out

    @staticmethod
    def gaussian_joint_noise(seq, rng, sigma=0.01):
        noise = rng.standard_normal(seq.shape).astype(np.float32) * sigma
        noise[..., 3] = 0.0     # do not perturb visibility
        return seq + noise

    @staticmethod
    def random_yaw_rotation(seq, rng, max_deg=10.0):
        theta = float(rng.uniform(-max_deg, max_deg)) * np.pi / 180.0
        c, s = np.cos(theta), np.sin(theta)
        R = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=np.float32)
        out = seq.copy()
        out[..., :3] = seq[..., :3] @ R.T
        return out

    @staticmethod
    def random_temporal_jitter(seq, rng, max_pct=0.1):
        t = seq.shape[0]
        scale = float(rng.uniform(1.0 - max_pct, 1.0 + max_pct))
        new_len = max(2, int(round(t * scale)))
        idx = np.linspace(0.0, t - 1.0, num=new_len)
        floor = np.floor(idx).astype(np.int64)
        ceil = np.minimum(floor + 1, t - 1)
        frac = (idx - floor).astype(np.float32)[:, None, None]
        stretched = (1.0 - frac) * seq[floor] + frac * seq[ceil]
        return DataProcessor.enforce_temporal_uniformity(stretched.astype(np.float32))

    # ---- A1: force the model to work on 2D-projectable signal -----
    @staticmethod
    def random_drop_z(seq, rng, p=0.5, xy_jitter=0.02):
        """With probability p, zero the z-axis and add small planar
        jitter. Simulates the NTU 3D → MediaPipe 2D transition."""
        if rng.random() >= p:
            return seq
        out = seq.copy()
        out[..., 2] = 0.0
        out[..., :2] += rng.standard_normal(out[..., :2].shape).astype(np.float32) * xy_jitter
        return out

    # ---- A2: weak perspective + image-plane roll -----------------
    @staticmethod
    def random_camera_projection(seq, rng, focal_jitter=0.15, roll_deg=10.0):
        """Apply a random weak-perspective projection followed by a
        small image-plane roll. Preserves 3D structure but shifts the
        pixel-space geometry, which is what MediaPipe sees."""
        out = seq.copy()
        f = 1.0 + float(rng.uniform(-focal_jitter, focal_jitter))
        z = out[..., 2]
        # weak perspective: divide xy by (f - z*0.5)  (guard denominator)
        denom = np.clip(f - 0.5 * z, 0.5, 3.0)[..., None]
        xy = out[..., :2] / denom
        out[..., :2] = xy
        # image-plane roll
        theta = float(rng.uniform(-roll_deg, roll_deg)) * np.pi / 180.0
        c, s = np.cos(theta), np.sin(theta)
        R2 = np.array([[c, -s], [s, c]], dtype=np.float32)
        out[..., :2] = out[..., :2] @ R2.T
        return out

    # ---- B6: temporal random sub-window crop ---------------------
    @staticmethod
    def random_subwindow_crop(seq, rng, crop_frames=60):
        """Uniformly sample a `crop_frames` sub-window from `seq`,
        then re-interpolate back up to the full length. Breaks any
        clip-length shortcut."""
        t = seq.shape[0]
        if t <= crop_frames + 1:
            return seq
        start = int(rng.integers(0, t - crop_frames))
        cropped = seq[start : start + crop_frames]
        return DataProcessor.enforce_temporal_uniformity(cropped, target_frames=t)

    @staticmethod
    def training_augment(seq, rng):
        """Full augmentation chain used during training."""
        out = DataProcessor.random_temporal_jitter(seq, rng)
        out = DataProcessor.random_subwindow_crop(out, rng)
        if rng.random() < 0.5:
            out = DataProcessor.random_lr_flip(out, rng)
        out = DataProcessor.random_yaw_rotation(out, rng)
        out = DataProcessor.random_camera_projection(out, rng)
        out = DataProcessor.random_drop_z(out, rng, p=0.5)
        out = DataProcessor.gaussian_joint_noise(out, rng)
        return out
