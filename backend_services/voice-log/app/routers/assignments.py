from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.assignments import (
    get_assignment_history,
    get_current_assignment,
    get_latest_handover_summary,
    perform_handover,
)

router = APIRouter(prefix="/assignments", tags=["assignments"])


class HandoverRequest(BaseModel):
    to_caregiver_id: UUID
    assigned_by: UUID | None = None
    handover_notes: str | None = None


class AssignmentResponse(BaseModel):
    id: UUID
    patient_id: int
    caregiver_id: UUID
    caregiver_name: str | None = None
    assigned_at: str
    ended_at: str | None = None
    handover_notes: str | None = None


class HandoverResponse(BaseModel):
    assignment: AssignmentResponse
    summary_text: str
    handover_id: UUID | None = None


def _map_assignment(row: dict) -> AssignmentResponse:
    caregiver = row.get("caregiver_profiles") or {}
    name = caregiver.get("display_name") if isinstance(caregiver, dict) else None
    return AssignmentResponse(
        id=UUID(row["id"]),
        patient_id=row["patient_id"],
        caregiver_id=UUID(row["caregiver_id"]),
        caregiver_name=name,
        assigned_at=row["assigned_at"],
        ended_at=row.get("ended_at"),
        handover_notes=row.get("handover_notes"),
    )


@router.get("/patients/{patient_id}/current", response_model=AssignmentResponse | None)
def current_assignment(patient_id: int) -> AssignmentResponse | None:
    row = get_current_assignment(patient_id)
    if not row:
        return None
    return _map_assignment(row)


@router.get("/patients/{patient_id}/history", response_model=list[AssignmentResponse])
def assignment_history(patient_id: int) -> list[AssignmentResponse]:
    rows = get_assignment_history(patient_id)
    return [_map_assignment(row) for row in rows]


@router.post("/patients/{patient_id}/handover", response_model=HandoverResponse)
def handover_patient(patient_id: int, body: HandoverRequest) -> HandoverResponse:
    try:
        result = perform_handover(
            patient_id=patient_id,
            to_caregiver_id=body.to_caregiver_id,
            assigned_by=body.assigned_by,
            handover_notes=body.handover_notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    handover = result.get("handover_summary") or {}
    return HandoverResponse(
        assignment=_map_assignment(result["assignment"]),
        summary_text=result["summary_text"],
        handover_id=UUID(handover["id"]) if handover.get("id") else None,
    )


@router.get("/patients/{patient_id}/handover-summary")
def patient_handover_summary(patient_id: int, caregiver_id: UUID | None = None) -> dict:
    row = get_latest_handover_summary(patient_id, caregiver_id)
    if not row:
        raise HTTPException(status_code=404, detail="No handover summary found")
    return {
        "patient_id": patient_id,
        "summary_text": row.get("summary_text", ""),
        "handover_at": row.get("handover_at"),
        "from_caregiver_id": row.get("from_caregiver_id"),
        "to_caregiver_id": row.get("to_caregiver_id"),
    }
