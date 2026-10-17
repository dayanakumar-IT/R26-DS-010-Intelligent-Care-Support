from __future__ import annotations

from datetime import date, datetime, time, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.schemas import (
    AvailableDatesResponse,
    CaregiverSummary,
    DailyReportResponse,
    PatientSummary,
    PeriodSummaryResponse,
)
from app.services.assignments import get_current_assignment
from app.services.exports import build_excel_report, build_pdf_report
from app.services.reports import build_daily_report
from app.services.summary_builder import build_period_summary_text
from app.services.summaries import cache_period_summary_audio
from app.services.supabase_queries import response_first_row, response_rows, supabase_execute
from r2_storage import presigned_url

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("", response_model=list[PatientSummary])
def list_patients(
    caregiver_id: UUID | None = Query(None, description="Filter to patients assigned to this caregiver"),
) -> list[PatientSummary]:
    if caregiver_id:
        assignment_result = supabase_execute(
            lambda sb: sb.table("scribe_patient_assignments")
            .select("patient_id")
            .eq("caregiver_id", str(caregiver_id))
            .is_("ended_at", "null")
        )
        patient_ids = [row["patient_id"] for row in response_rows(assignment_result)]
        if not patient_ids:
            return []
        result = supabase_execute(
            lambda sb: sb.table("patients")
            .select("id, patient_code, gender, room_id")
            .in_("id", patient_ids)
            .order("patient_code")
        )
    else:
        result = supabase_execute(
            lambda sb: sb.table("patients")
            .select("id, patient_code, gender, room_id")
            .order("patient_code")
        )

    return [PatientSummary(**row) for row in response_rows(result)]


@router.get("/caregivers", response_model=list[CaregiverSummary])
def list_caregivers() -> list[CaregiverSummary]:
    result = supabase_execute(
        lambda sb: sb.table("caregiver_profiles")
        .select("id, display_name, ward")
        .order("display_name")
    )
    return [CaregiverSummary(**row) for row in response_rows(result)]


def _get_patient(patient_id: int) -> dict:
    result = supabase_execute(
        lambda sb: sb.table("patients")
        .select("id, patient_code")
        .eq("id", patient_id)
        .limit(1)
    )
    row = response_first_row(result)
    if not row:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return row


def _fetch_records_for_range(patient_id: int, start_date: date, end_date: date) -> list[dict]:
    start_dt = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(end_date, time.max, tzinfo=timezone.utc)
    result = supabase_execute(
        lambda sb: sb.table("adl_records")
        .select("*")
        .eq("patient_id", patient_id)
        .gte("recorded_at", start_dt.isoformat())
        .lte("recorded_at", end_dt.isoformat())
        .order("recorded_at")
    )
    return response_rows(result)


def _fetch_available_dates(
    patient_id: int,
    caregiver_id: UUID | None = None,
) -> list[date]:
    def build(sb):
        query = (
            sb.table("adl_records")
            .select("recorded_at")
            .eq("patient_id", patient_id)
            .order("recorded_at")
        )
        if caregiver_id is not None:
            query = query.eq("caregiver_id", str(caregiver_id))
        return query

    result = supabase_execute(build)
    seen: set[date] = set()
    ordered: list[date] = []
    for row in response_rows(result):
        recorded_at = row.get("recorded_at")
        if not recorded_at:
            continue
        if isinstance(recorded_at, str):
            day = date.fromisoformat(recorded_at[:10])
        else:
            day = recorded_at.date()
        if day not in seen:
            seen.add(day)
            ordered.append(day)
    return ordered


@router.get("/{patient_id}/available-dates", response_model=AvailableDatesResponse)
def available_dates(
    patient_id: int,
    caregiver_id: UUID | None = Query(None),
) -> AvailableDatesResponse:
    patient = _get_patient(patient_id)
    dates = _fetch_available_dates(patient_id, caregiver_id)
    return AvailableDatesResponse(
        patient_id=patient_id,
        patient_code=patient["patient_code"],
        dates=dates,
    )


@router.get("/{patient_id}/daily-report", response_model=DailyReportResponse)
def daily_report(patient_id: int, report_date: date = Query(default_factory=date.today)) -> DailyReportResponse:
    patient = _get_patient(patient_id)
    records = _fetch_records_for_range(patient_id, report_date, report_date)
    report_text = build_daily_report(
        patient_code=patient["patient_code"],
        report_date=report_date,
        records=records,
    )
    return DailyReportResponse(
        patient_id=patient_id,
        patient_code=patient["patient_code"],
        report_date=report_date,
        report_text=report_text,
        records=records,
    )


@router.get("/{patient_id}/period-summary", response_model=PeriodSummaryResponse)
def period_summary(
    patient_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
    regenerate: bool = Query(False),
) -> PeriodSummaryResponse:
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")

    patient = _get_patient(patient_id)
    cached = supabase_execute(
        lambda sb: sb.table("period_summaries")
        .select("*")
        .eq("patient_id", patient_id)
        .eq("start_date", start_date.isoformat())
        .eq("end_date", end_date.isoformat())
        .limit(1)
    )
    cached_row = response_first_row(cached)

    if cached_row and not regenerate:
        audio_url = None
        if cached_row.get("r2_audio_key"):
            audio_url = presigned_url(cached_row["r2_audio_key"])
        return PeriodSummaryResponse(
            patient_id=patient_id,
            patient_code=patient["patient_code"],
            start_date=start_date,
            end_date=end_date,
            summary_text=cached_row.get("summary_text") or "",
            audio_url=audio_url,
            cached=True,
        )

    records = _fetch_records_for_range(patient_id, start_date, end_date)
    start_dt = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(end_date, time.max, tzinfo=timezone.utc)

    alerts_result = supabase_execute(
        lambda sb: sb.table("adl_alerts")
        .select("*")
        .eq("patient_id", patient_id)
        .gte("created_at", start_dt.isoformat())
        .lte("created_at", end_dt.isoformat())
    )
    alerts = response_rows(alerts_result)

    activities_result = supabase_execute(
        lambda sb: sb.table("scribe_care_activities")
        .select("id")
        .eq("patient_id", patient_id)
        .eq("status", "completed")
        .gte("completed_at", start_dt.isoformat())
        .lte("completed_at", end_dt.isoformat())
    )
    completed_activities = len(response_rows(activities_result))

    assignment = get_current_assignment(patient_id)
    caregiver_name = None
    if assignment:
        caregiver = assignment.get("caregiver_profiles") or {}
        if isinstance(caregiver, dict):
            caregiver_name = caregiver.get("display_name")

    summary_text = build_period_summary_text(
        patient_code=patient["patient_code"],
        start_date=start_date,
        end_date=end_date,
        records=records,
        alerts=alerts,
        current_caregiver=caregiver_name,
        completed_activities=completed_activities,
    )
    r2_key = cache_period_summary_audio(
        patient_code=patient["patient_code"],
        start_date=start_date,
        end_date=end_date,
        summary_text=summary_text,
    )
    supabase_execute(
        lambda sb: sb.table("period_summaries").upsert(
            {
                "patient_id": patient_id,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "summary_text": summary_text,
                "r2_audio_key": r2_key,
            },
            on_conflict="patient_id,start_date,end_date",
        )
    )

    return PeriodSummaryResponse(
        patient_id=patient_id,
        patient_code=patient["patient_code"],
        start_date=start_date,
        end_date=end_date,
        summary_text=summary_text,
        audio_url=presigned_url(r2_key),
        cached=False,
    )


@router.get("/{patient_id}/export/excel")
def export_excel(
    patient_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
) -> Response:
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")
    patient = _get_patient(patient_id)
    records = _fetch_records_for_range(patient_id, start_date, end_date)
    summary = period_summary(patient_id, start_date, end_date, regenerate=False)
    content = build_excel_report(
        patient_code=patient["patient_code"],
        start_date=start_date,
        end_date=end_date,
        records=records,
        summary_text=summary.summary_text,
    )
    filename = f"{patient['patient_code']}_{start_date}_{end_date}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{patient_id}/export/pdf")
def export_pdf(
    patient_id: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
) -> Response:
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")
    patient = _get_patient(patient_id)
    records = _fetch_records_for_range(patient_id, start_date, end_date)
    summary = period_summary(patient_id, start_date, end_date, regenerate=False)
    content = build_pdf_report(
        patient_code=patient["patient_code"],
        start_date=start_date,
        end_date=end_date,
        records=records,
        summary_text=summary.summary_text,
        generated_at=datetime.now(timezone.utc),
    )
    filename = f"{patient['patient_code']}_{start_date}_{end_date}.pdf"
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{patient_id}/audio/{recording_id}")
def get_audio_url(patient_id: int, recording_id: UUID) -> dict[str, str]:
    result = supabase_execute(
        lambda sb: sb.table("adl_records")
        .select("id, patient_id, r2_audio_key")
        .eq("id", str(recording_id))
        .eq("patient_id", patient_id)
        .limit(1)
    )
    row = response_first_row(result)
    if not row:
        raise HTTPException(status_code=404, detail="Recording not found")
    key = row.get("r2_audio_key")
    if not key:
        raise HTTPException(status_code=410, detail="Audio has been purged per retention policy")
    return {"url": presigned_url(key)}
