"""
capture_gates.py
GLOSS component — capture-quality gates that run BEFORE the recogniser.

The model has 59 outputs and no "no sign" class, so softmax always picks
a sign, even for an empty chair or a clip where the hands were never in
frame. These two checks stop such clips before inference and give the
learner a camera message instead of a wrong sign name:

  1. hand presence — share of frames where MediaPipe found at least one
     hand. Below MIN_HAND_PRESENCE: "I couldn't see your hands".
  2. movement — how far the wrists / hands travelled over the clip, in
     shoulder widths (the normalized space). Below MIN_MOTION_EXTENT:
     "No sign detected".

Both cut-offs are calibrated with scripts/calibrate_capture_gates.py on
the fluent-signer data shipped in gloss_assets/ (the 59 reference
exemplars and the 10 pipeline-parity attempts), and set well below the
lowest value any real sign there produced, so a genuine sign is not
rejected. They are deliberately conservative: they catch "nothing
happened" and "hands out of frame", not every non-sign (waving or
scratching still reaches the model — see the confidence gate in
attempt_submission.py).

Pure numpy, no I/O — testable directly.
"""

import numpy as np

from preprocessing import N_HAND_LANDMARKS, N_POSE_LANDMARKS, POSE_ORDER

LEFT_WRIST_IDX = POSE_ORDER.index("left_wrist")
RIGHT_WRIST_IDX = POSE_ORDER.index("right_wrist")
FIRST_HAND_IDX = N_POSE_LANDMARKS
HAND_A = slice(FIRST_HAND_IDX, FIRST_HAND_IDX + N_HAND_LANDMARKS)
HAND_B = slice(FIRST_HAND_IDX + N_HAND_LANDMARKS, FIRST_HAND_IDX + 2 * N_HAND_LANDMARKS)

# Calibrated cut-offs — scripts/calibrate_capture_gates.py (14 Oct 2026):
#   hand presence, 10 fluent test attempts: min 0.324, median 0.512
#     (hands rest out of frame at the start/end of dataset clips, so
#     "half the frames" would reject half of the real signs);
#   motion extent, 59 reference signs: min 1.367 (stomach), median 1.796;
#     10 test attempts: min 1.491.
# Each cut-off is under half the lowest real value. Validate against the
# non-sign clips (audit tests T04/T05/T13) before quoting a rejection rate.
MIN_HAND_PRESENCE = 0.15
MIN_MOTION_EXTENT = 0.30

HANDS_NOT_VISIBLE = (
    "I couldn't see your hands clearly. Keep both hands and your upper body "
    "inside the camera frame, check the lighting, and try again."
)
NO_MOVEMENT = (
    "No sign was detected — there was almost no hand movement in the clip. "
    "Start signing after recording begins, then try again."
)


def hand_presence_fraction(raw: np.ndarray) -> float:
    """raw: (T, 49, 3) MediaPipe output, NaN where not detected. Share of
    frames in which at least one hand landmark was detected."""
    hands = raw[:, FIRST_HAND_IDX:, :]
    detected = ~np.isnan(hands).all(axis=(1, 2))
    return float(detected.mean()) if len(detected) else 0.0


def _xy_range(track: np.ndarray) -> float:
    """track: (T, 2). Diagonal of the bounding box the point travelled."""
    return float(np.linalg.norm(track.max(axis=0) - track.min(axis=0)))


def motion_extent(normalized: np.ndarray) -> float:
    """normalized: (T, 49, 3) — normalize_raw_landmarks() output
    (shoulder-centred, shoulder width = 1). Largest distance travelled by
    either wrist or either hand's centre, in shoulder widths."""
    xy = normalized[:, :, :2]
    tracks = [
        xy[:, LEFT_WRIST_IDX],
        xy[:, RIGHT_WRIST_IDX],
        xy[:, HAND_A].mean(axis=1),
        xy[:, HAND_B].mean(axis=1),
    ]
    return max(_xy_range(t) for t in tracks)


def check_capture(raw: np.ndarray, normalized: np.ndarray) -> dict:
    """Runs both gates. Returns
      {"passed": bool, "reason": None | "hands_not_visible" | "no_movement",
       "message": str | None, "hand_presence": float, "motion_extent": float}
    """
    presence = hand_presence_fraction(raw)
    motion = motion_extent(normalized)
    result = {
        "passed": True,
        "reason": None,
        "message": None,
        "hand_presence": round(presence, 4),
        "motion_extent": round(motion, 4),
    }
    if presence < MIN_HAND_PRESENCE:
        result.update(passed=False, reason="hands_not_visible", message=HANDS_NOT_VISIBLE)
    elif motion < MIN_MOTION_EXTENT:
        result.update(passed=False, reason="no_movement", message=NO_MOVEMENT)
    return result
