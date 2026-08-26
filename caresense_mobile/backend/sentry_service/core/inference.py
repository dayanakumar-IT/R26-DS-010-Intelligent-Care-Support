# TODO: Inference pipeline
# 1. Receive skeletal joint coordinates (14-joint representation)
# 2. Apply temporal sliding window (last N frames)
# 3. Run ST-GCN model
# 4. Run feature-based classifier (18 hand-crafted features)
# 5. Late fusion → final risk score
# 6. Return risk_level + contributing factors for explainability

def run_inference(skeleton_sequence: list) -> dict:
    # TODO: implement full inference pipeline
    raise NotImplementedError("Inference pipeline not yet implemented")
