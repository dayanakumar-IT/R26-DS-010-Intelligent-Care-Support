"""Observation ingestion — pipeline, R2 upload, Supabase writes, idempotency."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from app import config
from app.pipeline.runner import get_pipeline
from app.schemas import ObservationResponse, PipelineResult
from app.services.supabase_queries import response_first_row, supabase_execute
from r2_storage import audio_object_key, upload_file

logger = logging.getLogger(__name__)


def _get_patient_code(patient_id: int) -> str:
    result = supabase_execute(
        lambda sb: sb.table("patients")
        .select("patient_code")
        .eq("id", patient_id)
        .limit(1)
    )
    row = response_first_row(result)
    if not row:
        raise ValueError(f"Patient {patient_id} not found")
    return row["patient_code"]


def _find_existing_record(client_recording_id: UUID) -> dict | None:
    result = supabase_execute(
        lambda sb: sb.table("adl_records")
        .select("*")
        .eq("client_recording_id", str(client_recording_id))
        .limit(1)
    )
    return response_first_row(result)


def _write_audit_log(*, actor: str, subject_ref: str, detail: dict) -> None:
    try:
        supabase_execute(
            lambda sb: sb.table("audit_log").insert({
                "component": config.COMPONENT,
                "event_type": "observation_processed",
                "actor": actor,
                "subject_ref": subject_ref,
                "detail": detail,
            })
        )
    except Exception as exc:
        # Observation is already persisted — do not fail the API response for audit-only errors.
        logger.error(
            "audit_log insert failed (observation already saved): %s. "
            "Apply migration 0029_SCRIBE_audit_log_grants.sql if not yet pushed.",
            exc,
        )


def process_observation(
    *,
    audio_path: Path,
    patient_id: int,
    caregiver_id: UUID,
    client_recording_id: UUID,
    recorded_at: datetime | None = None,
    care_activity_id: UUID | None = None,
) -> ObservationResponse:
    existing = _find_existing_record(client_recording_id)
    if existing:
        return ObservationResponse(
            id=UUID(existing["id"]),
            patient_id=existing["patient_id"],
            caregiver_id=UUID(existing["caregiver_id"]),
            client_recording_id=UUID(existing["client_recording_id"]),
            category=existing["category"],
            alert_required=existing["alert_required"],
            r2_audio_key=existing.get("r2_audio_key"),
            recorded_at=datetime.fromisoformat(existing["recorded_at"].replace("Z", "+00:00")),
            duplicate=True,
        )

    pipeline = get_pipeline()
    result: PipelineResult = pipeline.run(audio_path)

    if care_activity_id:
        from app.services.care_activities import get_care_activity

        activity = get_care_activity(care_activity_id)
        if not activity:
            raise ValueError(f"Care activity {care_activity_id} not found.")
        if activity["status"] != "in_progress":
            raise ValueError("Care activity is not in progress.")
        if activity["patient_id"] != patient_id or activity["caregiver_id"] != str(caregiver_id):
            raise ValueError("Care activity does not match patient/caregiver.")

    record_id = uuid4()
    patient_code = _get_patient_code(patient_id)
    suffix = audio_path.suffix or ".webm"
    r2_key = audio_object_key(patient_code, str(record_id), suffix=suffix)

    upload_file(audio_path, r2_key)

    timestamp = recorded_at or datetime.now(timezone.utc)
    row = {
        "id": str(record_id),
        "patient_id": patient_id,
        "caregiver_id": str(caregiver_id),
        "client_recording_id": str(client_recording_id),
        "recorded_at": timestamp.isoformat(),
        "raw_transcript": result.raw_transcript,
        "cleaned_transcript": result.cleaned_transcript,
        "r2_audio_key": r2_key,
        **result.extraction.to_db_row(),
    }
    if care_activity_id:
        row["care_activity_id"] = str(care_activity_id)

    try:
        supabase_execute(lambda sb: sb.table("adl_records").insert(row))
    except Exception as exc:
        # Race on duplicate client_recording_id — return existing row
        logger.warning("Insert conflict for client_recording_id=%s: %s", client_recording_id, exc)
        raced = _find_existing_record(client_recording_id)
        if raced:
            return ObservationResponse(
                id=UUID(raced["id"]),
                patient_id=raced["patient_id"],
                caregiver_id=UUID(raced["caregiver_id"]),
                client_recording_id=UUID(raced["client_recording_id"]),
                category=raced["category"],
                alert_required=raced["alert_required"],
                r2_audio_key=raced.get("r2_audio_key"),
                recorded_at=datetime.fromisoformat(raced["recorded_at"].replace("Z", "+00:00")),
                duplicate=True,
            )
        raise

    if result.extraction.alert_required and result.extraction.category == "symptom":
        supabase_execute(
            lambda sb: sb.table("adl_alerts").insert({
                "adl_record_id": str(record_id),
                "patient_id": patient_id,
            })
        )

    _write_audit_log(
        actor=str(caregiver_id),
        subject_ref=str(record_id),
        detail={
            "patient_id": patient_id,
            "client_recording_id": str(client_recording_id),
            "category": result.extraction.category,
            "alert_required": result.extraction.alert_required,
        },
    )

    return ObservationResponse(
        id=record_id,
        patient_id=patient_id,
        caregiver_id=caregiver_id,
        client_recording_id=client_recording_id,
        category=result.extraction.category,
        alert_required=result.extraction.alert_required,
        r2_audio_key=r2_key,
        recorded_at=timestamp,
        duplicate=False,
    )
