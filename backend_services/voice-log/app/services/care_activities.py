"""Care activity session lifecycle."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from app.services.summary_builder import build_daily_activity_summary
from app.services.supabase_queries import response_first_row, response_rows, supabase_execute


def _caregiver_name(caregiver_id: UUID) -> str:
    result = supabase_execute(
        lambda sb: sb.table("caregiver_profiles")
        .select("display_name")
        .eq("id", str(caregiver_id))
        .limit(1)
    )
    row = response_first_row(result)
    return row["display_name"] if row else str(caregiver_id)


def start_care_activity(*, patient_id: int, caregiver_id: UUID) -> dict:
    assignment = supabase_execute(
        lambda sb: sb.table("scribe_patient_assignments")
        .select("id, caregiver_id")
        .eq("patient_id", patient_id)
        .is_("ended_at", "null")
        .limit(1)
    )
    assign_row = response_first_row(assignment)
    if not assign_row:
        raise ValueError(f"Patient {patient_id} has no current caregiver assignment.")
    if assign_row["caregiver_id"] != str(caregiver_id):
        raise ValueError("This patient is not assigned to you.")

    existing = supabase_execute(
        lambda sb: sb.table("scribe_care_activities")
        .select("*")
        .eq("patient_id", patient_id)
        .eq("caregiver_id", str(caregiver_id))
        .eq("status", "in_progress")
        .limit(1)
    )
    existing_row = response_first_row(existing)
    if existing_row:
        return existing_row

    result = supabase_execute(
        lambda sb: sb.table("scribe_care_activities").insert({
            "patient_id": patient_id,
            "caregiver_id": str(caregiver_id),
            "status": "in_progress",
        })
    )
    row = response_first_row(result)
    if not row:
        raise RuntimeError("Failed to create care activity.")
    return row


def get_care_activity(activity_id: UUID) -> dict | None:
    result = supabase_execute(
        lambda sb: sb.table("scribe_care_activities")
        .select("*")
        .eq("id", str(activity_id))
        .limit(1)
    )
    return response_first_row(result)


def complete_care_activity(activity_id: UUID) -> dict:
    activity = get_care_activity(activity_id)
    if not activity:
        raise ValueError(f"Care activity {activity_id} not found.")
    if activity["status"] == "completed":
        return activity

    completed_at = datetime.now(timezone.utc)
    records_result = supabase_execute(
        lambda sb: sb.table("adl_records")
        .select("*")
        .eq("care_activity_id", str(activity_id))
        .order("recorded_at")
    )
    records = response_rows(records_result)

    patient_result = supabase_execute(
        lambda sb: sb.table("patients")
        .select("patient_code")
        .eq("id", activity["patient_id"])
        .limit(1)
    )
    patient = response_first_row(patient_result)
    patient_code = patient["patient_code"] if patient else str(activity["patient_id"])

    alerts_result = supabase_execute(
        lambda sb: sb.table("adl_alerts")
        .select("*")
        .eq("patient_id", activity["patient_id"])
        .eq("acknowledged", False)
    )
    alerts = response_rows(alerts_result)

    summary_text = build_daily_activity_summary(
        patient_code=patient_code,
        caregiver_name=_caregiver_name(UUID(activity["caregiver_id"])),
        activity_started=datetime.fromisoformat(
            activity["started_at"].replace("Z", "+00:00"),
        ),
        activity_completed=completed_at,
        records=records,
        alerts=alerts,
    )

    update_result = supabase_execute(
        lambda sb: sb.table("scribe_care_activities")
        .update({
            "status": "completed",
            "completed_at": completed_at.isoformat(),
            "daily_summary_text": summary_text,
            "daily_summary_generated_at": completed_at.isoformat(),
        })
        .eq("id", str(activity_id))
    )
    updated = response_first_row(update_result)
    return updated or {**activity, "status": "completed", "daily_summary_text": summary_text}
