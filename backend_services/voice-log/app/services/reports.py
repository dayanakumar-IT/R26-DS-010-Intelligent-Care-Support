"""Stage 6 — template daily report generation."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any

from app.config import to_colombo


def build_daily_report(
    *,
    patient_code: str,
    report_date: date,
    records: list[dict[str, Any]],
) -> str:
    if not records:
        return f"Daily ADL report for {patient_code} on {report_date.isoformat()}: no observations recorded."

    by_category: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in records:
        by_category[row.get("category", "unknown")].append(row)

    lines = [f"Daily ADL report for {patient_code} — {report_date.isoformat()}", ""]
    for category in sorted(by_category):
        lines.append(f"## {category.replace('_', ' ').title()}")
        for row in by_category[category]:
            ts = row.get("recorded_at") or row.get("created_at")
            time_label = _format_time(ts)
            summary = row.get("cleaned_transcript") or row.get("raw_transcript") or "(no transcript)"
            alert = " [ALERT]" if row.get("alert_required") else ""
            lines.append(f"- {time_label}: {summary}{alert}")
        lines.append("")
    return "\n".join(lines).strip()


def _format_time(value: Any) -> str:
    """HH:MM in Sri Lanka time — see app.config.to_colombo. Records are
    stored/queried in UTC; this converts only for display."""
    dt = to_colombo(value)
    if dt is None:
        return str(value)
    return dt.strftime("%H:%M")
