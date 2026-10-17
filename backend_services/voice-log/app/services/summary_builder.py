"""Structured summary templates built from live database records."""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import date, datetime
from typing import Any


def _format_time(value: Any) -> str:
    if isinstance(value, datetime):
        return value.strftime("%H:%M")
    if isinstance(value, str) and "T" in value:
        return value.split("T")[1][:5]
    return str(value)


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


def _observation_line(row: dict[str, Any], *, synthesized: bool = False) -> str:
    text = _synthesize_highlight(row) if synthesized else (
        row.get("cleaned_transcript") or row.get("raw_transcript") or "(no transcript)"
    )
    alert = " [ALERT]" if row.get("alert_required") else ""
    category = (row.get("category") or "unknown").replace("_", " ").title()
    return f"  • {_format_time(row.get('recorded_at'))} [{category}] {text}{alert}"


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


def build_period_summary_text(
    *,
    patient_code: str,
    start_date: date,
    end_date: date,
    records: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    current_caregiver: str | None = None,
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

    display_categories: Counter[str] = Counter()
    for row in records:
        cat = row.get("category", "unknown")
        text = (row.get("cleaned_transcript") or row.get("raw_transcript") or "").lower()
        if cat == "symptom" and any(w in text for w in ("water", "ml", "glass", "juice", "drank", "gave")):
            if not any(w in text for w in ("pain", "fever", "cough", "bleeding", "fall")):
                display_categories["fluid_intake"] += 1
                continue
        display_categories[cat] += 1

    lines = [
        f"═══ Period Summary — {patient_code} ═══",
        f"Date range: {start_date.isoformat()} to {end_date.isoformat()}",
        f"Current caregiver: {current_caregiver or 'Unassigned'}",
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
            lines.append(_observation_line(row, synthesized=True))

    flagged_rows = [r for r in records if r.get("alert_required")]
    if flagged_rows:
        lines.append("\n── Flagged items ──")
        for row in flagged_rows[-5:]:
            lines.append(_observation_line(row, synthesized=True))

    lines.append("\n── Recent highlights ──")
    for row in records[-8:]:
        lines.append(_observation_line(row, synthesized=True))

    lines.append("\n── End of period summary ──")
    return "\n".join(lines)


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
        f"Handover date: {handover_at.strftime('%Y-%m-%d %H:%M')}",
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
            lines.append(_observation_line(row, synthesized=True))

    if open_alerts:
        lines.append("\n── Open alerts (requires attention) ──")
        for alert in open_alerts:
            lines.append(f"  • Alert raised {alert.get('created_at', 'unknown')}")

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
