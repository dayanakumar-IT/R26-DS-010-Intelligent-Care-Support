"""
Supabase database layer — SENTRY Fall Risk Detection (Component 2).

Replaces the previous SQLite implementation.
All structured data goes to Supabase; skeleton replay blobs go to Cloudflare R2.

Tables (defined in supabase/migrations/):
    0007_SENTRY_patients.sql    — patients
    0008_SENTRY_rooms.sql       — rooms
    0009_SENTRY_fall_events.sql — fall_events
    0010_SENTRY_fall_alerts.sql — fall_alerts

Skeleton replay:
    NOT stored in Supabase. HIGH alert replays go to Cloudflare R2
    via src/r2_storage.py. The r2_replay_key column in fall_alerts
    stores the R2 object key for lookup.

Caregivers:
    Read-only from PULSE component's caregiver_profiles table.
    SENTRY never writes to it.

Setup (.env):
    SUPABASE_URL=https://mxxpfvxpbktlturlrrae.supabase.co
    SUPABASE_KEY=<service_role_key>
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from typing import List, Optional

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

_client: Optional[Client] = None


def _get_client() -> Client:
    global _client
    if _client is not None:
        return _client
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_KEY must be set in your .env file."
        )
    _client = create_client(url, key)
    print("[db] Connected to Supabase.")
    return _client


def init_db():
    """Verify Supabase connection on startup. Tables are created via migrations."""
    client = _get_client()
    # Quick connectivity check
    client.table("patients").select("id").limit(1).execute()
    print("[db] Supabase connection verified.")


# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------

def upsert_patient(patient_code: str, gender: str = None, room_id: str = None):
    """Insert or update a patient by patient_code. id is auto-generated."""
    _get_client().table("patients").upsert({
        "patient_code": patient_code,
        "gender":       gender,
        "room_id":      room_id,
    }, on_conflict="patient_code").execute()


def get_patients() -> List[dict]:
    res = _get_client().table("patients").select("*").order("id").execute()
    return res.data or []


def get_patient(patient_id: str) -> Optional[dict]:
    res = _get_client().table("patients").select("*").eq("id", patient_id).limit(1).execute()
    return res.data[0] if res.data else None


# ---------------------------------------------------------------------------
# Rooms
# ---------------------------------------------------------------------------

def upsert_room(room_code: str, ward: str = None,
                camera_src: str = None,
                zone_config: dict = None):
    """Insert or update a room by room_code. id is auto-generated."""
    _get_client().table("rooms").upsert({
        "room_code":   room_code,
        "ward":        ward,
        "camera_src":  camera_src,
        "zone_config": zone_config,
    }, on_conflict="room_code").execute()


def get_rooms() -> List[dict]:
    res = _get_client().table("rooms").select("*").order("id").execute()
    return res.data or []


def get_rooms_with_camera() -> List[dict]:
    """Return only rooms that have a camera configured — used for auto-start on server boot."""
    res = (
        _get_client().table("rooms")
        .select("*")
        .not_.is_("camera_src", "null")
        .neq("camera_src", "")
        .order("id")
        .execute()
    )
    return res.data or []


def update_room_camera(room_id: str, camera_src: str):
    """Set or update the camera source for a room."""
    _get_client().table("rooms").update({
        "camera_src": camera_src,
    }).eq("id", room_id).execute()


def assign_caregiver_to_room(room_id: str, caregiver_id: str):
    """Link a caregiver (from PULSE's caregiver_profiles) to a room."""
    _get_client().table("rooms").update({
        "caregiver_id": caregiver_id,
    }).eq("id", room_id).execute()


def get_room_zones(room_id: str) -> dict:
    """Return zone polygon map for a room, or empty dict if not configured."""
    res = _get_client().table("rooms").select("zone_config").eq("id", room_id).limit(1).execute()
    if res.data and res.data[0].get("zone_config"):
        return res.data[0]["zone_config"]
    return {}


def set_room_zones(room_id: str, zones: dict):
    """Save zone polygon map for a room."""
    _get_client().table("rooms").update({
        "zone_config": zones,
    }).eq("id", room_id).execute()


# ---------------------------------------------------------------------------
# Caregivers — READ ONLY from PULSE's caregiver_profiles table
# ---------------------------------------------------------------------------

def get_caregivers() -> List[dict]:
    """Read caregivers from PULSE's shared caregiver_profiles table. Never write here."""
    res = _get_client().table("caregiver_profiles").select("id, display_name, ward").order("display_name").execute()
    return res.data or []


def get_caregiver(caregiver_id: str) -> Optional[dict]:
    res = (
        _get_client().table("caregiver_profiles")
        .select("id, display_name, ward")
        .eq("id", caregiver_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


# ---------------------------------------------------------------------------
# Fall Events (one row per inference window)
# ---------------------------------------------------------------------------

def insert_event(patient_id: str, room_id: str, timestamp: float,
                 risk_score: float, risk_level: str, posture: str = None,
                 zone: str = None, pose_quality: str = None,
                 confidence: float = None, key_factors: List[str] = None,
                 alert_id: int = None) -> int:
    res = _get_client().table("fall_events").insert({
        "patient_id":   patient_id,
        "room_id":      room_id,
        "timestamp":    _unix_to_iso(timestamp),
        "risk_score":   risk_score,
        "risk_level":   risk_level,
        "posture":      posture,
        "zone":         zone,
        "pose_quality": pose_quality,
        "confidence":   confidence,
        "key_factors":  key_factors or [],
        "alert_id":     alert_id,
    }).execute()
    return res.data[0]["id"] if res.data else None


def get_patient_history(patient_id: str, limit: int = 200) -> List[dict]:
    res = (
        _get_client().table("fall_events")
        .select("*")
        .eq("patient_id", patient_id)
        .order("timestamp", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data or []


# ---------------------------------------------------------------------------
# Fall Alerts
# ---------------------------------------------------------------------------

def insert_alert(patient_id: str, room_id: str, timestamp: float,
                 risk_score: float, risk_level: str, posture: str = None,
                 key_factors: List[str] = None) -> int:
    res = _get_client().table("fall_alerts").insert({
        "patient_id":  patient_id,
        "room_id":     room_id,
        "timestamp":   _unix_to_iso(timestamp),
        "risk_score":  risk_score,
        "risk_level":  risk_level,
        "posture":     posture,
        "key_factors": key_factors or [],
    }).execute()
    return res.data[0]["id"] if res.data else None


def acknowledge_alert(alert_id: int, ack_by: str = "caregiver") -> bool:
    res = (
        _get_client().table("fall_alerts")
        .update({
            "acknowledged": True,
            "ack_by":       ack_by,
            "ack_at":       datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", alert_id)
        .eq("acknowledged", False)
        .execute()
    )
    return len(res.data) > 0


def get_alerts(unacked_only: bool = False, limit: int = 100) -> List[dict]:
    query = _get_client().table("fall_alerts").select("*").order("timestamp", desc=True).limit(limit)
    if unacked_only:
        query = query.eq("acknowledged", False)
    res = query.execute()
    return res.data or []


def set_alert_r2_key(alert_id: int, r2_key: str):
    """Store the Cloudflare R2 object key for a HIGH alert's skeleton replay."""
    _get_client().table("fall_alerts").update({
        "r2_replay_key": r2_key,
    }).eq("id", alert_id).execute()


# ---------------------------------------------------------------------------
# Skeleton Replay — Cloudflare R2 (NOT Supabase)
# ---------------------------------------------------------------------------

def save_replay_frames(alert_id: int, frames: list):
    """
    Save skeleton replay to Cloudflare R2.
    frames: list of (frame_index, timestamp, skeleton_array)
    """
    try:
        from src.r2_storage import save_replay_to_r2
        save_replay_to_r2(alert_id, frames)
        r2_key = f"replays/alert_{alert_id}.json"
        set_alert_r2_key(alert_id, r2_key)
    except Exception as e:
        print(f"[db] save_replay_frames failed: {e}")


def get_replay(alert_id: int) -> List[dict]:
    """Fetch skeleton replay from Cloudflare R2."""
    try:
        from src.r2_storage import get_replay_from_r2
        return get_replay_from_r2(alert_id)
    except Exception as e:
        print(f"[db] get_replay failed: {e}")
        return []


# ---------------------------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------------------------

def get_dashboard_summary() -> dict:
    client = _get_client()

    total_patients = len(client.table("patients").select("id").execute().data or [])
    all_alerts     = client.table("fall_alerts").select("id, acknowledged, risk_level, timestamp").execute().data or []

    total_alerts = len(all_alerts)
    unacked      = sum(1 for a in all_alerts if not a.get("acknowledged"))

    # HIGH alerts in last 24h
    cutoff = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    high_today = sum(
        1 for a in all_alerts
        if a.get("risk_level") == "HIGH" and (a.get("timestamp") or "") >= cutoff
    )

    # Latest risk level per patient from fall_events
    events = (
        client.table("fall_events")
        .select("patient_id, risk_level, timestamp")
        .order("timestamp", desc=True)
        .limit(500)
        .execute()
        .data or []
    )
    seen = set()
    level_counts: dict = {}
    for e in events:
        pid = e.get("patient_id")
        if pid and pid not in seen:
            seen.add(pid)
            lvl = e.get("risk_level", "NORMAL")
            level_counts[lvl] = level_counts.get(lvl, 0) + 1

    return {
        "total_patients":        total_patients,
        "total_alerts":          total_alerts,
        "unacknowledged_alerts": unacked,
        "high_alerts_today":     high_today,
        "patients_by_level":     level_counts,
    }


# ---------------------------------------------------------------------------
# Seed demo data
# ---------------------------------------------------------------------------

def seed_demo_data():
    """Insert demo rooms and patients. Camera sources configured via portal."""
    rooms = [
        ("ROOM_01", "Ward A"),
        ("ROOM_02", "Ward A"),
        ("ROOM_03", "Ward B"),
    ]
    for r in rooms:
        upsert_room(r[0], ward=r[1])

    patients = [
        ("P01", "M"),
        ("P02", "F"),
        ("P03", "M"),
    ]
    for p in patients:
        upsert_patient(p[0], gender=p[1])

    print("[db] Demo data seeded.")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _unix_to_iso(ts: float) -> str:
    """Convert a Unix timestamp (float) to ISO 8601 string for Supabase."""
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


if __name__ == "__main__":
    init_db()
    seed_demo_data()
    print("Summary:", get_dashboard_summary())
