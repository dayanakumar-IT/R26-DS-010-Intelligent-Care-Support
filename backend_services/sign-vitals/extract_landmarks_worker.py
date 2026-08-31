"""
extract_landmarks_worker.py
GLOSS component — standalone MediaPipe extraction worker.

Meant to be invoked as a subprocess from the main .venv (which cannot
import mediapipe), running under .venv_mediapipe instead. Its only job:

    input:  a video file path
    output: the raw (T, 49, 3) landmark array, NaN where a landmark
            was not detected, saved to a .npy file

No interpolation, normalization, resampling, kinematic features, or
standardization happens here — see landmark_extraction.py for the
extraction logic itself (reused unchanged) and preprocessing.py for
everything downstream.

Usage:
    python extract_landmarks_worker.py <video_path> <output_npy_path>

Exit codes:
    0  success — output_npy_path now contains the (T, 49, 3) array
    1  bad arguments
    2  no landmarks could be extracted from the video
"""

import sys

import numpy as np

from landmark_extraction import extract_landmarks_from_video, make_holistic


def main():
    if len(sys.argv) != 3:
        print(
            "Usage: python extract_landmarks_worker.py <video_path> <output_npy_path>",
            file=sys.stderr,
        )
        sys.exit(1)

    video_path, output_path = sys.argv[1], sys.argv[2]

    holistic = make_holistic()
    try:
        raw = extract_landmarks_from_video(video_path, holistic)
    finally:
        holistic.close()

    if raw is None:
        print(f"No frames/landmarks could be extracted from: {video_path}", file=sys.stderr)
        sys.exit(2)

    np.save(output_path, raw)
    print(f"Extracted raw landmarks with shape {raw.shape} -> {output_path}")


if __name__ == "__main__":
    main()
