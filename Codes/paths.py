from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DATASETS = ROOT / "datasets"
OUTPUTS = ROOT / "outputs"
DOCS = ROOT / "docs"

UR_DATASET = DATASETS / "UR Dataset"
NTU_DATASET = DATASETS / "NTU_Fall_Detection_Subset"

UR_POSE_OUTPUT = OUTPUTS / "UR_Pose_Output"
NTU_POSE_OUTPUT = OUTPUTS / "NTU_Pose_Output"
