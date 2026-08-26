# TODO: Load ST-GCN model
# Place your trained .pth weights file in the models/ folder
# then uncomment and configure below

# import torch
# from pathlib import Path
#
# MODEL_PATH = Path("models/stgcn_weights.pth")
#
# def load_model():
#     model = STGCN(...)   # define your ST-GCN architecture
#     model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
#     model.eval()
#     return model
#
# model = load_model()

def predict_risk(skeleton_frames):
    # TODO: run inference on skeleton_frames using loaded model
    # Returns: {"risk_level": "high"|"moderate"|"normal", "score": float, "contributing_joints": [...]}
    raise NotImplementedError("ST-GCN model not yet connected")
