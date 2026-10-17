"""Observation ingestion — pipeline, R2 upload, Supabase writes, idempotency.

A single recording can now yield multiple ADL records (Change 1 — one per
detected sentence/observation). All records from one recording share
client_recording_id, recorded_at and r2_audio_key, and are distinguished by
observation_index (0-based; see migration 0044). A single-observation
recording still produces exactly one row with observation_index = 0, same
as before this feature.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from app import config
from app.pipeline.runner import get_pipeline
from app.schemas import ObservationRecordSummary, ObservationResponse, PipelineResult
from app.services.supabase_queries import response_rows, supabase_execute
from r2_storage import audio_object_key, upload_file

logger = logging.getLogger(__name__)


def _get_patient_code(patient_id: int) -> str:
    result = supabase_execute(
        lambda sb: sb.table("patients")
        .select("patient_code")
        .eq("id", patient_id)
        .limit(1)
    )
    rows = response_rows(result)
    if not rows:
        raise ValueError(f"Patient {patient_id} not found")
    return rows[0]["patient_code"]


def _find_existing_records(client_recording_id: UUID) -> list[dict]:
    """All rows already saved for this recording, ordered by observation_index.
    A single-observation recording has exactly one row here, same as before."""
    result = supabase_execute(
        lambda sb: sb.table("adl_records")
        .select("*")
        .eq("client_recording_id", str(client_recording_id))
        .order("observation_index")
    )
    return response_rows(result)


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
        # Observations are already persisted — do not fail the API response for audit-only errors.
        logger.error(
            "audit_log insert failed (observation already saved): %s. "
            "Apply migration 0029_SCRIBE_audit_log_grants.sql if not yet pushed.",
            exc,
        )


def _response_from_rows(rows: list[dict], *, duplicate: bool) -> ObservationResponse:
    """Builds the API response from one recording's adl_records rows.
    Top-level fields mirror rows[0] (observation_index 0) for backward
    compatibility with the pre-Change-1 single-record response shape;
    alert_required at the top level is true if ANY row in the recording
    alerted, so a caller inspecting only the top-level field never misses
    an alert buried in a later observation.
    """
    primary = rows[0]
    return ObservationResponse(
        id=UUID(primary["id"]),
        patient_id=primary["patient_id"],
        caregiver_id=UUID(primary["caregiver_id"]),
        client_recording_id=UUID(primary["client_recording_id"]),
        category=primary["category"],
        alert_required=any(row["alert_required"] for row in rows),
        r2_audio_key=primary.get("r2_audio_key"),
        recorded_at=datetime.fromisoformat(primary["recorded_at"].replace("Z", "+00:00")),
        duplicate=duplicate,
        records=[
            ObservationRecordSummary(
                id=UUID(row["id"]),
                category=row["category"],
                alert_required=row["alert_required"],
                observation_index=row.get("observation_index", 0),
                cleaned_transcript=row.get("cleaned_transcript"),
                recorded_at=datetime.fromisoformat(row["recorded_at"].replace("Z", "+00:00")),
            )
            for row in rows
        ],
    )


def _create_alerts(rows: list[dict]) -> None:
    """One adl_alerts row per alerted observation (Change 3c), not one per
    recording — e.g. a 3-observation recording with one flagged symptom and
    one flagged meal gets exactly two adl_alerts rows. Only ever called
    right after a fresh insert (never on a duplicate/raced return), so this
    can't create duplicate alerts on upload retry."""
    alerted = [row for row in rows if row["alert_required"]]
    if not alerted:
        return
    supabase_execute(
        lambda sb: sb.table("adl_alerts").insert([
            {"adl_record_id": row["id"], "patient_id": row["patient_id"]}
            for row in alerted
        ])
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
    existing = _find_existing_records(client_recording_id)
    if existing:
        return _response_from_rows(existing, duplicate=True)

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

    patient_code = _get_patient_code(patient_id)
    suffix = audio_path.suffix or ".webm"
    # One audio file per recording, regardless of how many observations it
    # yields — keyed by a fresh marker rather than any single record's id.
    recording_marker = uuid4()
    r2_key = audio_object_key(patient_code, str(recording_marker), suffix=suffix)
    upload_file(audio_path, r2_key)

    timestamp = recorded_at or datetime.now(timezone.utc)
    rows: list[dict] = []
    for index, pipeline_record in enumerate(result.records):
        row = {
            "id": str(uuid4()),
            "patient_id": patient_id,
            "caregiver_id": str(caregiver_id),
            "client_recording_id": str(client_recording_id),
            "observation_index": index,
            "recorded_at": timestamp.isoformat(),
            "raw_transcript": pipeline_record.raw_segment,
            "cleaned_transcript": pipeline_record.cleaned_segment,
            "r2_audio_key": r2_key,
            **pipeline_record.extraction.to_db_row(),
        }
        if care_activity_id:
            row["care_activity_id"] = str(care_activity_id)
        rows.append(row)

    try:
        # One batch INSERT for the whole recording — Postgres applies a
        # multi-row INSERT atomically, so a conflict on any single
        # observation_index rolls back the entire statement (no partial
        # writes to race against on retry).
        insert_result = supabase_execute(lambda sb: sb.table("adl_records").insert(rows))
    except Exception as exc:
        logger.warning("Insert conflict for client_recording_id=%s: %s", client_recording_id, exc)
        raced = _find_existing_records(client_recording_id)
        if raced:
            return _response_from_rows(raced, duplicate=True)
        raise

    inserted_rows = response_rows(insert_result) or rows
    _create_alerts(inserted_rows)

    _write_audit_log(
        actor=str(caregiver_id),
        subject_ref=str(client_recording_id),
        detail={
            "patient_id": patient_id,
            "client_recording_id": str(client_recording_id),
            "record_count": len(rows),
            "categories": [row["category"] for row in rows],
            "alert_count": sum(1 for row in rows if row["alert_required"]),
        },
    )

    return _response_from_rows(inserted_rows, duplicate=False)
