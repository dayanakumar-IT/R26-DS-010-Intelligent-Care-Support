"""Structured summary templates built from live database records."""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import date, datetime
from typing import Any

from app.config import to_colombo


def _format_time(value: Any) -> str:
    """HH:MM in Sri Lanka time. Records are stored/queried in UTC — this
    converts only for display, via the shared to_colombo() helper, so every
    formatter in the app shifts timestamps the same way."""
    dt = to_colombo(value)
    if dt is None:
        return str(value)
    return dt.strftime("%H:%M")


def _format_date_time(value: Any) -> str:
    """Readable Sri Lanka date + time, e.g. '29 Aug 2026, 5:32 PM' — used
    anywhere a summary can span multiple days (period summaries, handover
    briefs), so the day is never ambiguous. Falls back to the raw value if
    it can't be parsed as a date, rather than hiding data."""
    dt = to_colombo(value)
    if dt is None:
        return str(value)
    hour = dt.strftime("%I").lstrip("0") or "12"
    return f"{dt.day} {dt.strftime('%b %Y')}, {hour}:{dt.strftime('%M %p')}"


def _polish_transcript(text: str | None) -> str:
    """Resolve self-corrections into a single clean sentence for summaries."""
    if not text:
        return ""
    t = text.strip()

    wait_match = re.search(r"\bwait[,.]?\s*(?:it was\s+)?(.+)$", t, re.IGNORECASE)
    if wait_match:
        before = t[: wait_match.start()].strip().rstrip("., ")
        correction = wait_match.group(1).strip().rstrip(".")
        meal = next((m for m in ("breakfast", "lunch", "dinner") if m in before.lower()), None)
        if meal and correction:
            return f"Patient had {correction.rstrip('.')} for {meal}."
        if before and correction:
            return f"{before.rstrip('.')}. {correction[0].upper()}{correction[1:]}."

    not_match = re.search(r",\s*not\s+[^,]+,\s*(.+)$", t, re.IGNORECASE)
    if not_match:
        lead = t[: not_match.start()].strip().rstrip("., ")
        final = not_match.group(1).strip().rstrip(".")
        if lead and final:
            return f"{lead}; served {final}."

    return t


def _synthesize_highlight(row: dict[str, Any]) -> str:
    """Build a spoken-style one-liner from structured fields, not raw transcript."""
    category = row.get("category")
    polished = _polish_transcript(row.get("cleaned_transcript") or row.get("raw_transcript"))

    if category == "fluid_intake":
        amount = row.get("fluid_amount") or ""
        fluid = row.get("fluid_type") or "water"
        tod = row.get("time_of_day") or ""
        base = f"Gave {amount} {fluid}".strip() if amount else f"Gave {fluid}"
        return f"{base}{f' {tod}' if tod else ''}.".replace("  ", " ")

    if category == "meal":
        food = row.get("food_item") or polished
        meal = row.get("meal_type") or ""
        intake = row.get("intake_level")
        line = f"Patient had {food}" if food else polished
        if meal:
            line = f"{line.rstrip('.')} for {meal}"
        if intake:
            line = f"{line} ({intake} intake)"
        return f"{line.rstrip('.')}."

    if category == "medication":
        med = row.get("medication_name") or ""
        dose = row.get("dosage") or ""
        tod = row.get("time_of_day") or ""
        if med:
            parts = [f"Gave {med}"]
            if dose:
                parts.append(dose)
            if tod:
                parts.append(tod)
            return " ".join(parts) + "."
        return polished

    if category == "symptom" and row.get("symptom_type"):
        return f"Reported {row['symptom_type']}."

    if category == "hygiene" and row.get("hygiene_activity"):
        return f"Hygiene: {row['hygiene_activity']}."

    if category == "mobility":
        parts = [row.get("mobility_type"), row.get("destination")]
        joined = " → ".join(p for p in parts if p)
        if joined:
            return f"Mobility: {joined}."

    if category == "nurse_check":
        parts = [row.get("vital_type"), row.get("vital_reading"), row.get("vital_status")]
        joined = ", ".join(p for p in parts if p)
        if joined:
            return f"Vitals: {joined}."

    if category == "family_visit":
        parts = [row.get("visitor_type"), row.get("visit_reason")]
        joined = " — ".join(p for p in parts if p)
        if joined:
            return f"Visit: {joined}."

    details = _structured_fields(row)
    if details:
        return "; ".join(details) + "."

    return polished


def _observation_line(row: dict[str, Any], *, synthesized: bool = False, with_date: bool = False) -> str:
    """with_date=True uses the full readable date+time ('29 Aug 2026, 5:32 PM')
    instead of a bare 'HH:MM' — needed wherever a summary can span more than
    one day (period summaries, handover briefs) so the day is never
    ambiguous. Defaults to the original bare-time behaviour so callers that
    are always scoped to a single day/activity (e.g. the daily care-activity
    summary) are unaffected."""
    text = _synthesize_highlight(row) if synthesized else (
        row.get("cleaned_transcript") or row.get("raw_transcript") or "(no transcript)"
    )
    alert = " [ALERT]" if row.get("alert_required") else ""
    category = (row.get("category") or "unknown").replace("_", " ").title()
    timestamp = _format_date_time(row.get("recorded_at")) if with_date else _format_time(row.get("recorded_at"))
    return f"  • {timestamp} [{category}] {text}{alert}"


def _structured_fields(row: dict[str, Any]) -> list[str]:
    category = row.get("category", "")
    by_category: dict[str, list[tuple[str, str]]] = {
        "medication": [
            ("medication_name", "Medication"),
            ("dosage", "Dosage"),
            ("time_of_day", "Time of day"),
        ],
        "meal": [
            ("food_item", "Food"),
            ("meal_type", "Meal type"),
            ("intake_level", "Intake"),
        ],
        "fluid_intake": [
            ("fluid_type", "Fluid"),
            ("fluid_amount", "Amount"),
            ("time_of_day", "Time of day"),
        ],
        "hygiene": [("hygiene_activity", "Hygiene"), ("time_of_day", "Time of day")],
        "mobility": [
            ("mobility_type", "Mobility"),
            ("destination", "Destination"),
            ("time_of_day", "Time of day"),
        ],
        "symptom": [("symptom_type", "Symptom"), ("time_of_day", "Time of day")],
        "mood": [("time_of_day", "Time of day")],
        "nurse_check": [
            ("vital_type", "Vital"),
            ("vital_reading", "Reading"),
            ("vital_status", "Status"),
        ],
        "family_visit": [("visitor_type", "Visitor"), ("visit_reason", "Reason")],
    }
    pairs = by_category.get(category, [])
    fields: list[str] = []
    for key, label in pairs:
        value = row.get(key)
        if value:
            fields.append(f"{label}: {value}")
    return fields


def build_daily_activity_summary(
    *,
    patient_code: str,
    caregiver_name: str,
    activity_started: datetime,
    activity_completed: datetime,
    records: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
) -> str:
    lines = [
        f"═══ Daily Care Activity Summary ═══",
        f"Patient: {patient_code}",
        f"Caregiver: {caregiver_name}",
        f"Activity: {_format_time(activity_started)} – {_format_time(activity_completed)}",
        f"Observations recorded: {len(records)}",
        f"Alerts raised: {len(alerts)}",
        "",
    ]

    if not records:
        lines.append("No observations were recorded during this care activity.")
        return "\n".join(lines)

    by_category: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in records:
        by_category[row.get("category", "unknown")].append(row)

    lines.append("── Observations by category ──")
    for category in sorted(by_category):
        label = category.replace("_", " ").title()
        lines.append(f"\n{label}:")
        for row in by_category[category]:
            lines.append(_observation_line(row, synthesized=True))
            extras = _structured_fields(row)
            for extra in extras:
                lines.append(f"    {extra}")

    if alerts:
        lines.append("\n── Alerts ──")
        for alert in alerts:
            lines.append(f"  • Alert at {alert.get('created_at', 'unknown')}")

    lines.append("\n── End of summary ──")
    return "\n".join(lines)


def _format_date_only(value: Any) -> str:
    dt = to_colombo(value)
    if dt is None:
        return str(value)
    return f"{dt.day} {dt.strftime('%b %Y')}"


def _format_caregiver_entry(caregiver: dict[str, Any]) -> str:
    name = caregiver.get("name") or "Unknown"
    assigned_at = caregiver.get("assigned_at")
    if not assigned_at:
        return name
    start_label = _format_date_only(assigned_at)
    ended_at = caregiver.get("ended_at")
    end_label = _format_date_only(ended_at) if ended_at else "present"
    return f"{name} ({start_label} – {end_label})"


def _format_caregiver_list(caregivers: list[dict[str, Any]] | None) -> str:
    """Renders every caregiver assignment overlapping the period (Change:
    previously only the current caregiver was shown, even for a range where
    the patient had been handed over between several caregivers)."""
    if not caregivers:
        return "Unassigned"
    return ", ".join(_format_caregiver_entry(c) for c in caregivers)


def build_period_summary_text(
    *,
    patient_code: str,
    start_date: date,
    end_date: date,
    records: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    caregivers: list[dict[str, Any]] | None = None,
    completed_activities: int = 0,
) -> str:
    if not records:
        return (
            f"Period Summary — {patient_code}\n"
            f"Date range: {start_date.isoformat()} to {end_date.isoformat()}\n\n"
            "No observations were recorded during this period."
        )

    alert_count = sum(1 for row in records if row.get("alert_required"))
    unacked = sum(1 for a in alerts if not a.get("acknowledged"))

    # Always the real stored category — no display-only reclassification.
    display_categories: Counter[str] = Counter(
        row.get("category", "unknown") for row in records
    )

    lines = [
        f"═══ Period Summary — {patient_code} ═══",
        f"Date range: {start_date.isoformat()} to {end_date.isoformat()}",
        f"Caregivers: {_format_caregiver_list(caregivers)}",
        "",
        "── Overview ──",
        f"Total observations: {len(records)}",
        f"Completed care activities: {completed_activities}",
        f"Observations flagged for alert: {alert_count}",
        f"Open alerts in period: {unacked}",
        "",
        "── Category breakdown ──",
    ]
    for category, count in display_categories.most_common():
        lines.append(f"  • {category.replace('_', ' ').title()}: {count}")

    medication_rows = [r for r in records if r.get("category") == "medication"]
    if medication_rows:
        lines.append("\n── Medication observations ──")
        for row in medication_rows[-5:]:
            lines.append(_observation_line(row, synthesized=True, with_date=True))

    flagged_rows = [r for r in records if r.get("alert_required")]
    if flagged_rows:
        lines.append("\n── Flagged items ──")
        for row in flagged_rows[-5:]:
            lines.append(_observation_line(row, synthesized=True, with_date=True))

    lines.append("\n── Recent highlights ──")
    for row in records[-8:]:
        lines.append(_observation_line(row, synthesized=True, with_date=True))

    lines.append("\n── End of period summary ──")
    return "\n".join(lines)


def _spoken_date(value: date) -> str:
    return f"{value.day} {value.strftime('%B %Y')}"


def build_spoken_period_summary(
    *,
    patient_code: str,
    start_date: date,
    end_date: date,
    caregivers: list[dict[str, Any]] | None,
    records: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
) -> str:
    """Short gTTS script (Change: separate from summary_text, which stays
    the full written report for "View full text" and exports). Every open
    alert is included in full — completeness there matters more than
    hitting a 20-40s target, so a patient with many open alerts will run
    longer. Routine items are counts only; no category labels or banners.
    """
    caregiver_names: list[str] = []
    for caregiver in caregivers or []:
        name = caregiver.get("name")
        if name and name not in caregiver_names:
            caregiver_names.append(name)
    caregiver_text = ", ".join(caregiver_names) if caregiver_names else "unassigned"

    sentences = [
        f"Period summary for patient {patient_code}, "
        f"{_spoken_date(start_date)} to {_spoken_date(end_date)}. "
        f"Caregiver: {caregiver_text}."
    ]

    open_alerts = [a for a in alerts if not a.get("acknowledged")]
    acknowledged_alerts = [a for a in alerts if a.get("acknowledged")]

    if open_alerts:
        sentences.append(
            f"{len(open_alerts)} open alert{'s' if len(open_alerts) != 1 else ''} requiring attention."
        )
        for alert in open_alerts:
            record = alert.get("adl_records") or {}
            detail = _synthesize_highlight(record) if record else "details unavailable."
            sentences.append(f"Alert on {_format_date_time(alert.get('created_at'))}: {detail}")
    else:
        sentences.append("No open alerts.")

    if acknowledged_alerts:
        sentences.append(
            f"{len(acknowledged_alerts)} alert"
            f"{'s' if len(acknowledged_alerts) != 1 else ''} already acknowledged."
        )

    medication_rows = [r for r in records if r.get("category") == "medication"]
    if medication_rows:
        descriptions: list[str] = []
        for row in medication_rows:
            name = row.get("medication_name")
            dosage = row.get("dosage")
            if name and dosage:
                descriptions.append(f"{name} {dosage}")
            elif name:
                descriptions.append(name)
        unique_descriptions = list(dict.fromkeys(descriptions))
        detail = f": {', '.join(unique_descriptions)}" if unique_descriptions else ""
        sentences.append(
            f"{len(medication_rows)} medication observation"
            f"{'s' if len(medication_rows) != 1 else ''}{detail}."
        )

    sentences.append(f"{len(records)} total observation{'s' if len(records) != 1 else ''} recorded.")
    sentences.append("End of summary.")

    return " ".join(sentences)


def build_handover_summary(
    *,
    patient_code: str,
    from_caregiver: str | None,
    to_caregiver: str,
    handover_at: datetime,
    recent_records: list[dict[str, Any]],
    open_alerts: list[dict[str, Any]],
    last_period_summary: str | None = None,
) -> str:
    lines = [
        f"═══ Patient Handover Summary ═══",
        f"Patient: {patient_code}",
        f"Handover date: {_format_date_time(handover_at)}",
        f"Previous caregiver: {from_caregiver or 'None (first assignment)'}",
        f"New caregiver: {to_caregiver}",
        "",
        "── Patient overview ──",
        f"Recent observations (last {min(len(recent_records), 10)}):",
    ]

    if not recent_records:
        lines.append("  No recent observations on record.")
    else:
        for row in recent_records[:10]:
            lines.append(_observation_line(row, synthesized=True, with_date=True))

    if open_alerts:
        lines.append("\n── Open alerts (requires attention) ──")
        for alert in open_alerts:
            # adl_records is the joined ADL record (see assignments.py's
            # perform_handover query) — without it we only have a bare
            # timestamp and no way to say what the alert actually is.
            record = alert.get("adl_records") or {}
            category = (record.get("category") or "unknown").replace("_", " ").title()
            detail = _synthesize_highlight(record) if record else "Alert details unavailable."
            lines.append(f"  • {_format_date_time(alert.get('created_at'))} [{category}] {detail} [ALERT]")

    categories = Counter(r.get("category") for r in recent_records)
    if categories:
        lines.append("\n── Recent ADL breakdown ──")
        for cat, count in categories.most_common():
            lines.append(f"  • {cat.replace('_', ' ').title()}: {count}")

    if last_period_summary:
        lines.append("\n── Recent period summary excerpt ──")
        excerpt = last_period_summary[:600]
        lines.append(excerpt + ("…" if len(last_period_summary) > 600 else ""))

    lines.append("\n── End of handover summary ──")
    return "\n".join(lines)
