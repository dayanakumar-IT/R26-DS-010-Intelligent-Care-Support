# TODO: Patient routes
# GET /sentry/patients           — list all patients with current risk level
# GET /sentry/patients/{id}      — single patient detail + today's risk timeline
# GET /sentry/patients/{id}/replay/{event_id} — skeletal frame data for event replay

from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_patients():
    # TODO: query Supabase patients table
    return {"patients": []}

@router.get("/{patient_id}")
def get_patient(patient_id: str):
    # TODO: query Supabase for patient + risk score
    return {"patient_id": patient_id}
