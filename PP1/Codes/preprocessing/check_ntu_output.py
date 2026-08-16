import sys
import pandas as pd
import numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import NTU_POSE_OUTPUT

print("\nStarting NTU output validation...\n")

# ---------------------------------------------------
# LOAD METADATA
# ---------------------------------------------------

metadata_path = NTU_POSE_OUTPUT / "metadata.csv"

if not metadata_path.exists():
    print("Metadata file not found!")
    exit()

metadata = pd.read_csv(metadata_path)

print("Metadata loaded successfully.")
print(f"Total sequences in metadata: {len(metadata)}")

# ---------------------------------------------------
# CHECK NPY FILES
# ---------------------------------------------------

missing_files = []
invalid_shapes = []
short_sequences = []

frame_counts = []

for idx, row in metadata.iterrows():

    npy_path = Path(row["pose_array_path"])

    if not npy_path.exists():
        missing_files.append(row["sequence_id"])
        continue

    try:
        pose_data = np.load(npy_path)

        shape = pose_data.shape

        # Expected shape: (frames, 25, 3)
        if len(shape) != 3 or shape[1] != 25 or shape[2] != 3:
            invalid_shapes.append({
                "sequence_id": row["sequence_id"],
                "shape": shape
            })

        frames = shape[0]
        frame_counts.append(frames)

        # Detect short sequences
        if frames < 20:
            short_sequences.append({
                "sequence_id": row["sequence_id"],
                "frames": frames
            })

    except Exception as e:
        print(f"Error loading {row['sequence_id']}: {e}")

# ---------------------------------------------------
# SUMMARY
# ---------------------------------------------------

print("\n------------- SUMMARY -------------")

print(f"Missing files: {len(missing_files)}")
print(f"Invalid shapes: {len(invalid_shapes)}")
print(f"Short sequences (<20 frames): {len(short_sequences)}")

if len(frame_counts) > 0:
    print(f"\nMin frames: {min(frame_counts)}")
    print(f"Max frames: {max(frame_counts)}")
    print(f"Average frames: {round(np.mean(frame_counts), 2)}")

# ---------------------------------------------------
# LABEL DISTRIBUTION
# ---------------------------------------------------

print("\n------------- LABEL DISTRIBUTION -------------")

print(metadata["label"].value_counts())

# ---------------------------------------------------
# SHOW SHORT SEQUENCES
# ---------------------------------------------------

if len(short_sequences) > 0:

    print("\n------------- SHORT SEQUENCES -------------")

    short_df = pd.DataFrame(short_sequences)

    print(short_df.head(20))

# ---------------------------------------------------
# SAVE REPORTS
# ---------------------------------------------------

if len(short_sequences) > 0:
    short_df.to_csv(
        NTU_POSE_OUTPUT / "short_sequences_report.csv",
        index=False
    )

if len(invalid_shapes) > 0:
    invalid_df = pd.DataFrame(invalid_shapes)

    invalid_df.to_csv(
        NTU_POSE_OUTPUT / "invalid_shapes_report.csv",
        index=False
    )

print("\nNTU validation completed.")