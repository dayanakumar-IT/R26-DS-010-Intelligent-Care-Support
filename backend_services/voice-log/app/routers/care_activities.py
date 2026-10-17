from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.care_activities import complete_care_activity, get_care_activity, start_care_activity

router = APIRouter(prefix="/care-activities", tags=["care-activities"])


class StartCareActivityRequest(BaseModel):
    patient_id: int
    caregiver_id: UUID


class CareActivityResponse(BaseModel):
    id: UUID
    patient_id: int
    caregiver_id: UUID
    status: str
    started_at: str
    completed_at: str | None = None
    daily_summary_text: str | None = None


@router.post("/start", response_model=CareActivityResponse)
def start_activity(body: StartCareActivityRequest) -> CareActivityResponse:
    try:
        row = start_care_activity(
            patient_id=body.patient_id,
            caregiver_id=body.caregiver_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CareActivityResponse(
        id=UUID(row["id"]),
        patient_id=row["patient_id"],
        caregiver_id=UUID(row["caregiver_id"]),
        status=row["status"],
        started_at=row["started_at"],
        completed_at=row.get("completed_at"),
        daily_summary_text=row.get("daily_summary_text"),
    )


@router.post("/{activity_id}/complete", response_model=CareActivityResponse)
def complete_activity(activity_id: UUID) -> CareActivityResponse:
    try:
        row = complete_care_activity(activity_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return CareActivityResponse(
        id=UUID(row["id"]),
        patient_id=row["patient_id"],
        caregiver_id=UUID(row["caregiver_id"]),
        status=row["status"],
        started_at=row["started_at"],
        completed_at=row.get("completed_at"),
        daily_summary_text=row.get("daily_summary_text"),
    )


@router.get("/{activity_id}", response_model=CareActivityResponse)
def get_activity(activity_id: UUID) -> CareActivityResponse:
    row = get_care_activity(activity_id)
    if not row:
        raise HTTPException(status_code=404, detail="Care activity not found")
    return CareActivityResponse(
        id=UUID(row["id"]),
        patient_id=row["patient_id"],
        caregiver_id=UUID(row["caregiver_id"]),
        status=row["status"],
        started_at=row["started_at"],
        completed_at=row.get("completed_at"),
        daily_summary_text=row.get("daily_summary_text"),
    )
