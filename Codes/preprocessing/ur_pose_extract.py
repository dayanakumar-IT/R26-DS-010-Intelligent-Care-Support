import os
import sys
import cv2
import csv
import numpy as np
import mediapipe as mp
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import UR_DATASET, UR_POSE_OUTPUT

# =========================================================
# UR POSE EXTRACTION SCRIPT
# Purpose:
# Extract skeletal pose landmarks from UR Dataset image frames
# and save model-ready .npy files with metadata.csv
# =========================================================

base_dir = str(UR_DATASET)
output_base = str(UR_POSE_OUTPUT)

input_folders = {
    "adl": {
        "path": os.path.join(base_dir, "adl"),
        "label": "normal",
        "risk_level": "low_risk",
        "camera": "cam0"
    },
    "fall_cam0": {
        "path": os.path.join(base_dir, "falls", "cam0"),
        "label": "fall",
        "risk_level": "high_risk",
        "camera": "cam0"
    },
    "fall_cam1": {
        "path": os.path.join(base_dir, "falls", "cam1"),
        "label": "fall",
        "risk_level": "high_risk",
        "camera": "cam1"
    }
}

# Create output folder
os.makedirs(output_base, exist_ok=True)

# Metadata file path
metadata_path = os.path.join(output_base, "metadata.csv")

# MediaPipe Pose setup
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(
    static_image_mode=True,
    model_complexity=1,
    enable_segmentation=False,
    min_detection_confidence=0.5
)


def extract_pose_from_sequence(sequence_folder):
    png_files = sorted([
        file for file in os.listdir(sequence_folder)
        if file.lower().endswith(".png")
    ])

    sequence_data = []
    detected_frames = 0
    missing_frames = 0

    # Carry-forward fallback for failed detections. Starts as zeros, but
    # as soon as the first valid frame arrives, every subsequent failed
    # frame inherits the last seen pose. This avoids "all-zero frame"
    # artifacts that the model could otherwise learn to detect as a
    # missing-detection signal correlated with high-motion (fall) clips.
    last_valid = [[0.0, 0.0, 0.0, 0.0] for _ in range(33)]

    for png_file in png_files:
        img_path = os.path.join(sequence_folder, png_file)
        image = cv2.imread(img_path)

        if image is None:
            missing_frames += 1
            continue

        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = pose.process(image_rgb)

        if results.pose_landmarks:
            detected_frames += 1
            frame_landmarks = [
                [lm.x, lm.y, lm.z, lm.visibility]
                for lm in results.pose_landmarks.landmark
            ]
            last_valid = frame_landmarks
        else:
            missing_frames += 1
            # Carry forward the last valid pose instead of zero-filling.
            frame_landmarks = last_valid

        sequence_data.append(frame_landmarks)

    return np.array(sequence_data, dtype=np.float32), detected_frames, missing_frames


metadata_rows = []

print("\nStarting UR pose extraction...")

for category_name, info in input_folders.items():

    parent_folder = info["path"]
    label = info["label"]
    risk_level = info["risk_level"]
    camera = info["camera"]

    save_folder = os.path.join(output_base, category_name)
    os.makedirs(save_folder, exist_ok=True)

    print("\n================================================")
    print(f"Processing Category: {category_name}")
    print("================================================")

    if not os.path.exists(parent_folder):
        print(f"Folder not found: {parent_folder}")
        continue

    for sequence_name in sorted(os.listdir(parent_folder)):

        sequence_path = os.path.join(parent_folder, sequence_name)

        if not os.path.isdir(sequence_path):
            continue

        print(f"Extracting: {sequence_name}")

        sequence_array, detected_frames, missing_frames = extract_pose_from_sequence(sequence_path)

        if sequence_array.shape[0] == 0:
            print(f"Skipped: {sequence_name} has no valid frames")
            continue

        save_path = os.path.join(save_folder, sequence_name + ".npy")
        np.save(save_path, sequence_array)

        metadata_rows.append({
            "sequence_id": sequence_name,
            "dataset": "UR",
            "category": category_name,
            "camera": camera,
            "label": label,
            "risk_level": risk_level,
            "frame_count": sequence_array.shape[0],
            "detected_frames": detected_frames,
            "missing_frames": missing_frames,
            "pose_shape": str(sequence_array.shape),
            "pose_array_path": save_path
        })

        print(f"Saved: {save_path}")
        print(f"Shape: {sequence_array.shape}")
        print(f"Detected Frames: {detected_frames}, Missing Frames: {missing_frames}")


# Save metadata.csv
with open(metadata_path, mode="w", newline="", encoding="utf-8") as csv_file:
    fieldnames = [
        "sequence_id",
        "dataset",
        "category",
        "camera",
        "label",
        "risk_level",
        "frame_count",
        "detected_frames",
        "missing_frames",
        "pose_shape",
        "pose_array_path"
    ]

    writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(metadata_rows)

pose.close()

print("\nUR pose extraction completed.")
print(f"Metadata saved at: {metadata_path}")
print(f"Total sequences processed: {len(metadata_rows)}")