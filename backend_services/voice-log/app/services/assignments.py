"""Patient–caregiver assignments and handover."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from app.services.summary_builder import build_handover_summary
from app.services.supabase_queries import response_first_row, response_rows, supabase_execute


def _caregiver_name(caregiver_id: str | UUID) -> str:
    result = supabase_execute(
        lambda sb: sb.table("caregiver_profiles")
        .select("display_name")
        .eq("id", str(caregiver_id))
        .limit(1)
    )
    row = response_first_row(result)
    return row["display_name"] if row else str(caregiver_id)


def get_current_assignment(patient_id: int) -> dict | None:
    result = supabase_execute(
        lambda sb: sb.table("scribe_patient_assignments")
        .select("*, caregiver_profiles(display_name)")
        .eq("patient_id", patient_id)
        .is_("ended_at", "null")
        .limit(1)
    )
    return response_first_row(result)


def get_assignment_history(patient_id: int) -> list[dict]:
    result = supabase_execute(
        lambda sb: sb.table("scribe_patient_assignments")
        .select("*, caregiver_profiles(display_name)")
        .eq("patient_id", patient_id)
        .order("assigned_at", desc=True)
    )
    return response_rows(result)


def get_caregiver_patients(caregiver_id: UUID) -> list[int]:
    result = supabase_execute(
        lambda sb: sb.table("scribe_patient_assignments")
        .select("patient_id")
        .eq("caregiver_id", str(caregiver_id))
        .is_("ended_at", "null")
    )
    return [row["patient_id"] for row in response_rows(result)]


def perform_handover(
    *,
    patient_id: int,
    to_caregiver_id: UUID,
    assigned_by: UUID | None = None,
    handover_notes: str | None = None,
) -> dict:
    now = datetime.now(timezone.utc)

    current = get_current_assignment(patient_id)
    from_caregiver_id = current["caregiver_id"] if current else None

    if current and current["caregiver_id"] == str(to_caregiver_id):
        raise ValueError("Patient is already assigned to this caregiver.")

    if current:
        supabase_execute(
            lambda sb: sb.table("scribe_patient_assignments")
            .update({"ended_at": now.isoformat()})
            .eq("id", current["id"])
        )

    insert_payload: dict = {
        "patient_id": patient_id,
        "caregiver_id": str(to_caregiver_id),
        "assigned_at": now.isoformat(),
        "handover_notes": handover_notes,
    }
    if assigned_by:
        insert_payload["assigned_by"] = str(assigned_by)

    new_assignment_result = supabase_execute(
        lambda sb: sb.table("scribe_patient_assignments").insert(insert_payload)
    )
    new_assignment = response_first_row(new_assignment_result)
    if not new_assignment:
        raise RuntimeError("Failed to create new assignment.")

    patient_result = supabase_execute(
        lambda sb: sb.table("patients")
        .select("patient_code")
        .eq("id", patient_id)
        .limit(1)
    )
    patient = response_first_row(patient_result)
    patient_code = patient["patient_code"] if patient else str(patient_id)

    recent_records_result = supabase_execute(
        lambda sb: sb.table("adl_records")
        .select("*")
        .eq("patient_id", patient_id)
        .order("recorded_at", desc=True)
        .limit(15)
    )
    recent_records = response_rows(recent_records_result)

    alerts_result = supabase_execute(
        lambda sb: sb.table("adl_alerts")
        .select("*")
        .eq("patient_id", patient_id)
        .eq("acknowledged", False)
    )
    open_alerts = response_rows(alerts_result)

    period_result = supabase_execute(
        lambda sb: sb.table("period_summaries")
        .select("summary_text")
        .eq("patient_id", patient_id)
        .order("generated_at", desc=True)
        .limit(1)
    )
    period_row = response_first_row(period_result)
    last_period = period_row.get("summary_text") if period_row else None

    summary_text = build_handover_summary(
        patient_code=patient_code,
        from_caregiver=_caregiver_name(from_caregiver_id) if from_caregiver_id else None,
        to_caregiver=_caregiver_name(to_caregiver_id),
        handover_at=now,
        recent_records=recent_records,
        open_alerts=open_alerts,
        last_period_summary=last_period,
    )

    handover_result = supabase_execute(
        lambda sb: sb.table("scribe_handover_summaries").insert({
            "patient_id": patient_id,
            "assignment_id": new_assignment["id"],
            "from_caregiver_id": from_caregiver_id,
            "to_caregiver_id": str(to_caregiver_id),
            "handover_at": now.isoformat(),
            "summary_text": summary_text,
        })
    )
    handover_row = response_first_row(handover_result)

    return {
        "assignment": new_assignment,
        "handover_summary": handover_row,
        "summary_text": summary_text,
    }


def get_latest_handover_summary(patient_id: int, caregiver_id: UUID | None = None) -> dict | None:
    def build(sb):
        query = (
            sb.table("scribe_handover_summaries")
            .select("*")
            .eq("patient_id", patient_id)
            .order("handover_at", desc=True)
            .limit(1)
        )
        if caregiver_id:
            query = query.eq("to_caregiver_id", str(caregiver_id))
        return query

    result = supabase_execute(build)
    return response_first_row(result)
