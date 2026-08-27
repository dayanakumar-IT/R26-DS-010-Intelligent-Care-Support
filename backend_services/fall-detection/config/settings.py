# backend/config/settings.py
import os

# ---------------------------------------------------------------------------
# Filesystem layout
# ---------------------------------------------------------------------------
# Resolve project root dynamically — works from any drive or folder location
BASE_PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATASET_DIR = os.path.join(BASE_PROJECT_DIR, "Datasets")

NTU_SOURCE_DIR = os.path.join(DATASET_DIR, "Action Recognition Dataset NTU (Rose)")
UR_ADL_SOURCE_DIR = os.path.join(DATASET_DIR, "UR Fall Detection Dataset", "adl")
UR_FALL_SOURCE_DIR = os.path.join(DATASET_DIR, "UR Fall Detection Dataset", "fall")
UR_ADL_CAM0_DIR   = os.path.join(DATASET_DIR, "UR Fall Detection Dataset", "adl_cam0")
UR_FALL_CAM0_DIR  = os.path.join(DATASET_DIR, "UR Fall Detection Dataset", "fall_cam0")

BACKEND_DIR = os.path.join(BASE_PROJECT_DIR, "backend")
PROCESSED_DATA_DIR = os.path.join(BACKEND_DIR, "data", "processed")
MODELS_DIR = os.path.join(BACKEND_DIR, "models", "saved")

# ---------------------------------------------------------------------------
# Temporal contract
# ---------------------------------------------------------------------------
TARGET_FRAMES = 90          # 3 s of buffer at 30 FPS
FRAME_RATE = 30

# ---------------------------------------------------------------------------
# Classes
# ---------------------------------------------------------------------------
# NTU action codes used. A043 = falling; the rest are deliberate hard
# negatives that involve large vertical or fast motion.
NTU_TARGET_CLASSES = ["A043", "A008", "A009", "A027"]

CLASS_MAPPING = {
    "NORMAL": 0,
    "FALL": 1,
}

CLASS_NAMES = ["NORMAL", "FALL"]

# ---------------------------------------------------------------------------
# Canonical 14-joint layout (source of truth for the entire codebase)
#
# Order:
#   0 Head    1 Neck   2 LSh  3 RSh   4 LElb  5 RElb
#   6 LWri    7 RWri   8 LHip 9 RHip 10 LKnee 11 RKnee
#  12 LAnk   13 RAnk
#
# Neck is a derived joint computed as the midpoint of L/R shoulder.
# Torso centre is NOT a joint here; it is computed on demand from
# shoulders+hips wherever needed (features, posture classifier).
# ---------------------------------------------------------------------------
JOINT_NAMES = [
    "head",      # 0
    "neck",      # 1   (midpoint of L/R shoulder)
    "l_shoulder",  # 2
    "r_shoulder",  # 3
    "l_elbow",   # 4
    "r_elbow",   # 5
    "l_wrist",   # 6
    "r_wrist",   # 7
    "l_hip",     # 8
    "r_hip",     # 9
    "l_knee",    # 10
    "r_knee",    # 11
    "l_ankle",   # 12
    "r_ankle",   # 13
]
NUM_JOINTS = len(JOINT_NAMES)

# Index aliases used across the codebase; reading code stays readable
# even when the layout changes again later.
JOINT = {name: idx for idx, name in enumerate(JOINT_NAMES)}

# Bone (edge) list for the ST-GCN graph. Undirected; self-loops are added
# inside stgcn.py.
SKELETON_EDGES = [
    (JOINT["head"],       JOINT["neck"]),
    (JOINT["neck"],       JOINT["l_shoulder"]),
    (JOINT["neck"],       JOINT["r_shoulder"]),
    (JOINT["l_shoulder"], JOINT["l_elbow"]),
    (JOINT["r_shoulder"], JOINT["r_elbow"]),
    (JOINT["l_elbow"],    JOINT["l_wrist"]),
    (JOINT["r_elbow"],    JOINT["r_wrist"]),
    # virtual torso edges (no torso-centre joint, so connect neck to hips)
    (JOINT["neck"],       JOINT["l_hip"]),
    (JOINT["neck"],       JOINT["r_hip"]),
    (JOINT["l_hip"],      JOINT["r_hip"]),
    (JOINT["l_hip"],      JOINT["l_knee"]),
    (JOINT["r_hip"],      JOINT["r_knee"]),
    (JOINT["l_knee"],     JOINT["l_ankle"]),
    (JOINT["r_knee"],     JOINT["r_ankle"]),
]

# Left/right pairs for horizontal-flip augmentation
LR_FLIP_PAIRS = [
    (JOINT["l_shoulder"], JOINT["r_shoulder"]),
    (JOINT["l_elbow"],    JOINT["r_elbow"]),
    (JOINT["l_wrist"],    JOINT["r_wrist"]),
    (JOINT["l_hip"],      JOINT["r_hip"]),
    (JOINT["l_knee"],     JOINT["r_knee"]),
    (JOINT["l_ankle"],    JOINT["r_ankle"]),
]

# ---------------------------------------------------------------------------
# MediaPipe Pose (33 landmarks) -> our 14-joint layout
#
# Used at inference time only (extract_mediapipe_14_joints).
# Index 1 (Neck) is computed as midpoint(L_shoulder, R_shoulder) — the
# value below is just a placeholder source for the visibility field.
# ---------------------------------------------------------------------------
MEDIAPIPE_JOINT_MAP = {
    JOINT["head"]:       0,    # nose
    JOINT["neck"]:       11,   # placeholder; recomputed as midpoint
    JOINT["l_shoulder"]: 11,
    JOINT["r_shoulder"]: 12,
    JOINT["l_elbow"]:    13,
    JOINT["r_elbow"]:    14,
    JOINT["l_wrist"]:    15,
    JOINT["r_wrist"]:    16,
    JOINT["l_hip"]:      23,
    JOINT["r_hip"]:      24,
    JOINT["l_knee"]:     25,
    JOINT["r_knee"]:     26,
    JOINT["l_ankle"]:    27,
    JOINT["r_ankle"]:    28,
}

# ---------------------------------------------------------------------------
# NTU 25-joint Kinect-v2 -> our 14-joint layout
#
# NTU joint indices (per official spec):
#   0 SpineBase   1 SpineMid    2 Neck       3 Head
#   4 ShoulderL   5 ElbowL      6 WristL     7 HandL
#   8 ShoulderR  9 ElbowR     10 WristR    11 HandR
#  12 HipL      13 KneeL      14 AnkleL    15 FootL
#  16 HipR      17 KneeR      18 AnkleR    19 FootR
#  20 SpineShoulder ...
# ---------------------------------------------------------------------------
NTU_JOINT_MAP = {
    JOINT["head"]:        3,
    JOINT["neck"]:        2,
    JOINT["l_shoulder"]:  4,
    JOINT["r_shoulder"]:  8,
    JOINT["l_elbow"]:     5,
    JOINT["r_elbow"]:     9,
    JOINT["l_wrist"]:     6,
    JOINT["r_wrist"]:    10,
    JOINT["l_hip"]:      12,
    JOINT["r_hip"]:      16,
    JOINT["l_knee"]:     13,
    JOINT["r_knee"]:     17,
    JOINT["l_ankle"]:    14,
    JOINT["r_ankle"]:    18,
}

# ---------------------------------------------------------------------------
# Handcrafted feature names (must match the order in features.py)
# Used by the contributing-feature attribution and the dashboard.
# ---------------------------------------------------------------------------
FEATURE_NAMES = [
    "mean_vy_hip",         # F1
    "max_vy_hip",          # F2
    "mean_vx_hip",         # F3
    "mean_vy_head",        # F4
    "max_ay_hip",          # F5
    "kinetic_proxy",       # F6
    "max_kinetic_spike",   # F7
    "mean_torso_angle",    # F8
    "max_torso_angle",     # F9
    "mean_angular_vel",    # F10
    "mean_aspect_ratio",   # F11
    "max_aspect_ratio",    # F12
    "std_torso_sway",      # F13
    "std_hip_lateral",     # F14
    "std_hip_vertical",    # F15
    "hip_path_length",     # F16
    "min_hip_height_ratio",# F17
    "gait_dispersion",     # F18
]
NUM_FEATURES = len(FEATURE_NAMES)

# Human-readable labels for the dashboard / mobile app
FEATURE_DISPLAY_NAMES = {
    "mean_vy_hip":         "mean vertical drop velocity",
    "max_vy_hip":          "max vertical drop velocity",
    "mean_vx_hip":         "mean horizontal velocity",
    "mean_vy_head":        "mean head drop velocity",
    "max_ay_hip":          "peak vertical acceleration",
    "kinetic_proxy":       "kinetic energy proxy",
    "max_kinetic_spike":   "kinetic energy spike",
    "mean_torso_angle":    "mean torso inclination",
    "max_torso_angle":     "max torso lean angle",
    "mean_angular_vel":    "torso angular velocity",
    "mean_aspect_ratio":   "body aspect ratio",
    "max_aspect_ratio":    "max body spread",
    "std_torso_sway":      "torso sway",
    "std_hip_lateral":     "lateral hip balance",
    "std_hip_vertical":    "vertical hip bobbing",
    "hip_path_length":     "hip trajectory length",
    "min_hip_height_ratio":"ground proximity",
    "gait_dispersion":     "gait dispersion",
}

# ---------------------------------------------------------------------------
# Risk-level thresholds (see backend/docs/risk_levels.md)
# Tuned later on val set; these are sensible defaults.
# ---------------------------------------------------------------------------
RISK_TAU_LOW = 0.35
RISK_TAU_HIGH = 0.65
RISK_EMA_ALPHA = 0.4
DWELL_S = {
    "to_moderate": 1.5,
    "to_high":     0.5,
    "to_moderate_from_high": 3.0,
    "to_normal":   3.0,
}
ALERT_COOLDOWN_S = 30.0
ALERT_HIGH_DWELL_S = 0.5

# ---------------------------------------------------------------------------
# Training hyperparameters
# ---------------------------------------------------------------------------
SEED = 42
BATCH_SIZE = 32
LEARNING_RATE = 3e-4
WEIGHT_DECAY = 1e-4
MAX_EPOCHS = 60
EARLY_STOPPING_PATIENCE = 10
TRAIN_VAL_TEST_SPLIT = (0.70, 0.15, 0.15)
