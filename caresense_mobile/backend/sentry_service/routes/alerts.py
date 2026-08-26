# TODO: Alert routes
# GET  /sentry/alerts              — all active alerts
# POST /sentry/alerts/{id}/resolve — caregiver marks alert resolved

from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_alerts():
    # TODO: query Supabase alerts table
    return {"alerts": []}

@router.post("/{alert_id}/resolve")
def resolve_alert(alert_id: str):
    # TODO: update Supabase alerts row resolved=true
    return {"alert_id": alert_id, "resolved": True}
