import os
import sys
import csv
from pathlib import Path
import numpy as np

# Allow importing paths.py from Codes folder
sys.path.append(str(Path(__file__).resolve().parent.parent))

from paths import NTU_DATASET, NTU_POSE_OUTPUT


# =========================================================
# NTU SKELETON EXTRACTION SCRIPT
# Purpose:
# Convert NTU .skeleton files into .npy pose sequence files
# and generate metadata.csv
# =========================================================

# NTU action class mapping
CLASS_MAP = {
    "A008": {
        "label": "sit_down",
        "risk_level": "low_risk"
    },
    "A009": {
        "label": "stand_up",
        "risk_level": "low_risk"
    },
    "A042": {
        "label": "staggering",
        "risk_level": "moderate_risk"
    },
    "A043": {
        "label": "falling_down",
        "risk_level": "high_risk"
    },
    "A080": {
        "label": "squat_down",
        "risk_level": "moderate_risk"
    }
}


def get_action_code(filename):
    for action_code in CLASS_MAP.keys():
        if action_code in filename:
            return action_code
    return None


def read_ntu_skeleton_file(file_path):
    """
    Reads one NTU .skeleton file and extracts joint x, y, z values.

    Output shape:
    (number_of_frames, 25, 3)
    """

    sequence_data = []

    with open(file_path, "r") as file:
        lines = file.readlines()

    current_line = 0

    if len(lines) == 0:
        return np.array(sequence_data, dtype=np.float32)

    total_frames = int(lines[current_line].strip())
    current_line += 1

    for frame_index in range(total_frames):

        if current_line >= len(lines):
            break

        body_count = int(lines[current_line].strip())
        current_line += 1

        # If no body detected in this frame
        if body_count == 0:
            sequence_data.append([[0.0, 0.0, 0.0] for _ in range(25)])
            continue

        bodies_in_frame = []

        for body_index in range(body_count):

            # Skip body information line
            current_line += 1

            joint_count = int(lines[current_line].strip())
            current_line += 1

            joints = []

            for joint_index in range(joint_count):
                joint_values = lines[current_line].strip().split()
                current_line += 1

                # NTU joint format starts with x, y, z
                x = float(joint_values[0])
                y = float(joint_values[1])
                z = float(joint_values[2])

                joints.append([x, y, z])

            bodies_in_frame.append(joints)

        # Use first detected body only
        if len(bodies_in_frame) > 0:
            first_body = bodies_in_frame[0]

            # Ensure exactly 25 joints
            if len(first_body) == 25:
                sequence_data.append(first_body)
            else:
                sequence_data.append([[0.0, 0.0, 0.0] for _ in range(25)])

    return np.array(sequence_data, dtype=np.float32)


def main():

    print("\nStarting NTU skeleton extraction...")

    os.makedirs(NTU_POSE_OUTPUT, exist_ok=True)

    metadata_path = NTU_POSE_OUTPUT / "metadata.csv"
    metadata_rows = []

    skeleton_files = [
        file for file in os.listdir(NTU_DATASET)
        if file.lower().endswith(".skeleton")
    ]

    print(f"Total skeleton files found: {len(skeleton_files)}")

    for filename in sorted(skeleton_files):

        action_code = get_action_code(filename)

        if action_code is None:
            print(f"[SKIPPED] Unknown class: {filename}")
            continue

        label = CLASS_MAP[action_code]["label"]
        risk_level = CLASS_MAP[action_code]["risk_level"]

        input_path = NTU_DATASET / filename

        class_output_folder = NTU_POSE_OUTPUT / action_code
        os.makedirs(class_output_folder, exist_ok=True)

        output_filename = filename.replace(".skeleton", ".npy")
        output_path = class_output_folder / output_filename

        try:
            sequence_array = read_ntu_skeleton_file(input_path)

            if sequence_array.shape[0] == 0:
                print(f"[SKIPPED] Empty sequence: {filename}")
                continue

            np.save(output_path, sequence_array)

            metadata_rows.append({
                "sequence_id": filename.replace(".skeleton", ""),
                "dataset": "NTU",
                "action_code": action_code,
                "label": label,
                "risk_level": risk_level,
                "frame_count": sequence_array.shape[0],
                "joint_count": sequence_array.shape[1],
                "coordinate_count": sequence_array.shape[2],
                "pose_shape": str(sequence_array.shape),
                "pose_array_path": str(output_path)
            })

            print(f"[DONE] {filename} -> Shape: {sequence_array.shape}")

        except Exception as e:
            print(f"[ERROR] {filename}")
            print(f"Reason: {e}")

    # Save metadata.csv
    with open(metadata_path, mode="w", newline="", encoding="utf-8") as csv_file:
        fieldnames = [
            "sequence_id",
            "dataset",
            "action_code",
            "label",
            "risk_level",
            "frame_count",
            "joint_count",
            "coordinate_count",
            "pose_shape",
            "pose_array_path"
        ]

        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(metadata_rows)

    print("\nNTU skeleton extraction completed.")
    print(f"Metadata saved at: {metadata_path}")
    print(f"Total sequences processed: {len(metadata_rows)}")


if __name__ == "__main__":
    main()