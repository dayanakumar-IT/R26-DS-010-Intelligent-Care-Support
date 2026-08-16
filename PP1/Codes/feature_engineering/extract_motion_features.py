import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Allow importing paths.py from Codes folder
sys.path.append(str(Path(__file__).resolve().parent.parent))

from paths import OUTPUTS


# =========================================================
# EXTRACT MOTION FEATURES
# Purpose:
# Create final feature dataset for ML model training
# =========================================================

COMMON_METADATA = OUTPUTS / "Common_Joint_Sequences" / "common_joint_metadata.csv"

FEATURE_OUTPUT = OUTPUTS / "Feature_Dataset"
FEATURE_DATASET_PATH = FEATURE_OUTPUT / "features_dataset.csv"


# Common joint indexes after mapping
HEAD = 0
LEFT_SHOULDER = 1
RIGHT_SHOULDER = 2
LEFT_HIP = 7
RIGHT_HIP = 8
LEFT_ANKLE = 11
RIGHT_ANKLE = 12
SPINE = 13


def euclidean_distance(a, b):
    return np.linalg.norm(a - b, axis=-1)


def extract_features(sequence):
    """
    Input shape:
        (100, 14, 3)

    Output:
        dictionary of motion features
    """

    # ---------------------------------------------
    # 1. Center body movement
    # ---------------------------------------------
    center_body = np.mean(sequence, axis=1)

    center_velocity = np.diff(center_body, axis=0)
    center_speed = np.linalg.norm(center_velocity, axis=1)

    center_acceleration = np.diff(center_velocity, axis=0)
    center_accel_mag = np.linalg.norm(center_acceleration, axis=1)

    # ---------------------------------------------
    # 2. Vertical movement
    # ---------------------------------------------
    y_positions = center_body[:, 1]

    vertical_range = np.max(y_positions) - np.min(y_positions)
    vertical_drop = y_positions[-1] - y_positions[0]

    sudden_vertical_change = np.max(np.abs(np.diff(y_positions)))

    # ---------------------------------------------
    # 3. Body tilt
    # ---------------------------------------------
    shoulder_center = (sequence[:, LEFT_SHOULDER, :] + sequence[:, RIGHT_SHOULDER, :]) / 2
    hip_center = (sequence[:, LEFT_HIP, :] + sequence[:, RIGHT_HIP, :]) / 2

    torso_vector = shoulder_center - hip_center

    torso_x = torso_vector[:, 0]
    torso_y = torso_vector[:, 1]

    torso_angle = np.degrees(np.arctan2(np.abs(torso_x), np.abs(torso_y) + 1e-6))

    # ---------------------------------------------
    # 4. Head-to-ankle height change
    # ---------------------------------------------
    ankle_center = (sequence[:, LEFT_ANKLE, :] + sequence[:, RIGHT_ANKLE, :]) / 2
    head = sequence[:, HEAD, :]

    body_height = euclidean_distance(head, ankle_center)

    height_change = body_height[-1] - body_height[0]
    height_range = np.max(body_height) - np.min(body_height)

    # ---------------------------------------------
    # 5. Instability / movement variation
    # ---------------------------------------------
    joint_velocity = np.diff(sequence, axis=0)
    joint_speed = np.linalg.norm(joint_velocity, axis=2)

    mean_joint_speed = np.mean(joint_speed)
    max_joint_speed = np.max(joint_speed)
    std_joint_speed = np.std(joint_speed)

    instability_score = std_joint_speed + np.std(center_speed)

    # ---------------------------------------------
    # 6. Final feature dictionary
    # ---------------------------------------------
    features = {
        "center_speed_mean": np.mean(center_speed),
        "center_speed_max": np.max(center_speed),
        "center_speed_std": np.std(center_speed),

        "center_acceleration_mean": np.mean(center_accel_mag),
        "center_acceleration_max": np.max(center_accel_mag),
        "center_acceleration_std": np.std(center_accel_mag),

        "vertical_range": vertical_range,
        "vertical_drop": vertical_drop,
        "sudden_vertical_change": sudden_vertical_change,

        "torso_angle_mean": np.mean(torso_angle),
        "torso_angle_max": np.max(torso_angle),
        "torso_angle_std": np.std(torso_angle),

        "body_height_change": height_change,
        "body_height_range": height_range,

        "mean_joint_speed": mean_joint_speed,
        "max_joint_speed": max_joint_speed,
        "std_joint_speed": std_joint_speed,

        "instability_score": instability_score
    }

    return features


def main():
    print("\nStarting motion feature extraction...")

    if not COMMON_METADATA.exists():
        print(f"Common metadata not found: {COMMON_METADATA}")
        return

    FEATURE_OUTPUT.mkdir(parents=True, exist_ok=True)

    metadata = pd.read_csv(COMMON_METADATA)

    feature_rows = []

    for _, row in metadata.iterrows():
        sequence_id = row["sequence_id"]
        dataset = row["dataset"]
        label = row["label"]
        risk_level = row["risk_level"]
        pose_path = Path(row["pose_array_path"])

        if not pose_path.exists():
            print(f"[SKIPPED] Missing file: {sequence_id}")
            continue

        try:
            sequence = np.load(pose_path)

            if sequence.shape != (100, 14, 3):
                print(f"[SKIPPED] Invalid shape {sequence_id}: {sequence.shape}")
                continue

            features = extract_features(sequence)

            feature_row = {
                "sequence_id": sequence_id,
                "dataset": dataset,
                "label": label,
                "risk_level": risk_level,
                "pose_array_path": str(pose_path)
            }

            feature_row.update(features)
            feature_rows.append(feature_row)

            print(f"[DONE] {sequence_id}")

        except Exception as e:
            print(f"[ERROR] {sequence_id}: {e}")

    feature_df = pd.DataFrame(feature_rows)
    feature_df.to_csv(FEATURE_DATASET_PATH, index=False)

    print("\nMotion feature extraction completed.")
    print(f"Total feature rows: {len(feature_df)}")
    print(f"Feature dataset saved at: {FEATURE_DATASET_PATH}")

    print("\n------------- DATASET DISTRIBUTION -------------")
    print(feature_df["dataset"].value_counts())

    print("\n------------- LABEL DISTRIBUTION -------------")
    print(feature_df["label"].value_counts())

    print("\n------------- FEATURES CREATED -------------")
    feature_columns = [
        col for col in feature_df.columns
        if col not in ["sequence_id", "dataset", "label", "risk_level", "pose_array_path"]
    ]

    for col in feature_columns:
        print(f"- {col}")


if __name__ == "__main__":
    main()