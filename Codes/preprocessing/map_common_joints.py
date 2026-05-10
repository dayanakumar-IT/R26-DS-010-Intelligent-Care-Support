import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Allow importing paths.py from Codes folder
sys.path.append(str(Path(__file__).resolve().parent.parent))

from paths import OUTPUTS


# =========================================================
# MAP COMMON JOINTS
# Purpose:
# Convert UR and NTU skeletons into a common joint format
# =========================================================

NORMALIZED_METADATA = OUTPUTS / "Normalized_Sequences" / "combined_normalized_metadata.csv"

COMMON_OUTPUT = OUTPUTS / "Common_Joint_Sequences"
COMMON_METADATA_PATH = COMMON_OUTPUT / "common_joint_metadata.csv"

# Common 14 joints:
COMMON_JOINT_NAMES = [
    "head",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
    "spine"
]

# MediaPipe 33 landmark index mapping
# UR shape: (100, 33, 4)
UR_COMMON_INDEXES = [
    0,   # head / nose
    11,  # left shoulder
    12,  # right shoulder
    13,  # left elbow
    14,  # right elbow
    15,  # left wrist
    16,  # right wrist
    23,  # left hip
    24,  # right hip
    25,  # left knee
    26,  # right knee
    27,  # left ankle
    28,  # right ankle
]

# NTU 25 joint index mapping
# NTU shape: (100, 25, 3)
# Converted to 0-based indexing
NTU_COMMON_INDEXES = [
    3,   # head
    4,   # left shoulder
    8,   # right shoulder
    5,   # left elbow
    9,   # right elbow
    6,   # left wrist
    10,  # right wrist
    12,  # left hip
    16,  # right hip
    13,  # left knee
    17,  # right knee
    14,  # left ankle
    18,  # right ankle
]


def add_spine_joint(common_joints):
    """
    Adds spine joint by averaging left/right shoulder and left/right hip.
    Input shape: (frames, 13, 3)
    Output shape: (frames, 14, 3)
    """

    left_shoulder = common_joints[:, 1, :]
    right_shoulder = common_joints[:, 2, :]
    left_hip = common_joints[:, 7, :]
    right_hip = common_joints[:, 8, :]

    spine = (left_shoulder + right_shoulder + left_hip + right_hip) / 4.0
    spine = spine[:, np.newaxis, :]

    return np.concatenate([common_joints, spine], axis=1)


def normalize_skeleton(common_seq):
    """Spine-centered, torso-scaled normalization.

    Removes coordinate-system dependence between datasets and viewpoints:
        1. Translate origin to the spine joint (index 13) per frame, so
           absolute world position is no longer a feature.
        2. Scale by torso length (spine -> midpoint of shoulders), averaged
           over the sequence, so absolute body size and camera-zoom are
           no longer features.

    After this, two skeletons performing the same action — one captured by
    NTU's mocap rig and one captured by UR's webcam at a different distance
    — produce roughly the same numbers. This is the standard preprocessing
    step used in every published ST-GCN paper.

    Input  : (T, 14, 3)
    Output : (T, 14, 3)  float32
    """
    spine = common_seq[:, 13:14, :]               # (T, 1, 3)
    centered = common_seq - spine                  # translate origin to spine

    left_sh = centered[:, 1, :]                    # left shoulder
    right_sh = centered[:, 2, :]                   # right shoulder
    shoulder_mid = (left_sh + right_sh) / 2.0      # (T, 3)
    torso_len = float(np.linalg.norm(shoulder_mid, axis=1).mean())
    if torso_len < 1e-6:
        torso_len = 1.0
    return (centered / torso_len).astype(np.float32)


def map_ur_sequence(sequence):
    """
    UR input shape: (100, 33, 4)
    Use only x,y,z and selected common joints. Apply spatial normalization
    (spine-centered, torso-scaled) so UR and NTU live in a common
    coordinate frame.
    Output shape: (100, 14, 3)
    """

    xyz_sequence = sequence[:, :, :3]
    common = xyz_sequence[:, UR_COMMON_INDEXES, :]
    common = add_spine_joint(common)
    common = normalize_skeleton(common)

    return common.astype(np.float32)


def map_ntu_sequence(sequence):
    """
    NTU input shape: (100, 25, 3)
    Select common joints. Apply spatial normalization (spine-centered,
    torso-scaled) so UR and NTU live in a common coordinate frame.
    Output shape: (100, 14, 3)
    """

    common = sequence[:, NTU_COMMON_INDEXES, :]
    common = add_spine_joint(common)
    common = normalize_skeleton(common)

    return common.astype(np.float32)


def main():
    print("\nStarting common joint mapping...")

    if not NORMALIZED_METADATA.exists():
        print(f"Metadata not found: {NORMALIZED_METADATA}")
        return

    metadata = pd.read_csv(NORMALIZED_METADATA)
    COMMON_OUTPUT.mkdir(parents=True, exist_ok=True)

    common_rows = []

    for _, row in metadata.iterrows():
        sequence_id = row["sequence_id"]
        dataset = row["dataset"]
        label = row["label"]
        risk_level = row["risk_level"]
        pose_path = Path(row["pose_array_path"])

        if not pose_path.exists():
            print(f"[SKIPPED] File not found: {sequence_id}")
            continue

        try:
            sequence = np.load(pose_path)

            if dataset == "UR":
                common_sequence = map_ur_sequence(sequence)
            elif dataset == "NTU":
                common_sequence = map_ntu_sequence(sequence)
            else:
                print(f"[SKIPPED] Unknown dataset: {dataset}")
                continue

            save_folder = COMMON_OUTPUT / dataset / label
            save_folder.mkdir(parents=True, exist_ok=True)

            save_path = save_folder / f"{sequence_id}.npy"
            np.save(save_path, common_sequence)

            common_rows.append({
                "sequence_id": sequence_id,
                "dataset": dataset,
                "label": label,
                "risk_level": risk_level,
                "original_shape": str(sequence.shape),
                "common_shape": str(common_sequence.shape),
                "common_joint_count": 14,
                "common_joint_names": ",".join(COMMON_JOINT_NAMES),
                "pose_array_path": str(save_path)
            })

            print(f"[DONE] {sequence_id} -> {common_sequence.shape}")

        except Exception as e:
            print(f"[ERROR] {sequence_id}: {e}")

    common_df = pd.DataFrame(common_rows)
    common_df.to_csv(COMMON_METADATA_PATH, index=False)

    print("\nCommon joint mapping completed.")
    print(f"Total mapped sequences: {len(common_df)}")
    print(f"Common metadata saved at: {COMMON_METADATA_PATH}")

    print("\n------------- DATASET DISTRIBUTION -------------")
    print(common_df["dataset"].value_counts())

    print("\n------------- LABEL DISTRIBUTION -------------")
    print(common_df["label"].value_counts())


if __name__ == "__main__":
    main()