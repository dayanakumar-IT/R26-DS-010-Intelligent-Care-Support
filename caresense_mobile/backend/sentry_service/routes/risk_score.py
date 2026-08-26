# TODO: Risk score routes
# GET /sentry/risk/{patient_id}   — current live risk score + contributing factors
# POST /sentry/risk/frame         — receive skeletal frame, return risk score (from edge device)

from fastapi import APIRouter

router = APIRouter()

@router.get("/{patient_id}")
def get_risk_score(patient_id: str):
    # TODO: get latest risk score from Supabase or live inference
    return {"patient_id": patient_id, "risk_level": "normal", "score": 0.0}
