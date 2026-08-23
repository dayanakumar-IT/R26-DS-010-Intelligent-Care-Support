"""
Supabase sync — pushes local SQLite data to shared Supabase PostgreSQL.

Architecture:
    SQLite (local, real-time) → background thread → Supabase (cloud, shared)

If Supabase is unreachable, local SQLite continues working unaffected.
Other group project components can read fall_events and patients from Supabase.

Setup:
    Set environment variables (or .env file):
        SUPABASE_URL=https://xxxx.supabase.co
        SUPABASE_KEY=your-anon-or-service-role-key

Supabase tables needed (run once in Supabase SQL editor):
    See create_supabase_tables.sql next to this file.
"""
from __future__ import annotations

import json
import os
import threading
import time
from typing import Optional

_client = None
_enabled = False


def _get_client():
    global _client, _enabled
    if _client is not None:
        return _client
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        return None
    try:
        from supabase import create_client
        _client = create_client(url, key)
        _enabled = True
        print("[supabase] Connected to Supabase.")
    except Exception as e:
        print(f"[supabase] Connection failed: {e}")
        _client = None
    return _client


def is_enabled() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_KEY"))


# ---------------------------------------------------------------------------
# Sync functions — each wraps a Supabase upsert, fails silently
# ---------------------------------------------------------------------------

def sync_patient(patient: dict):
    """Push one patient record to Supabase patients table."""
    client = _get_client()
    if not client:
        return
    try:
        client.table("patients").upsert({
            "id":         patient["id"],
            "name":       patient["name"],
            "age":        patient.get("age"),
            "gender":     patient.get("gender"),
            "room_id":    patient.get("room_id"),
            "bed":        patient.get("bed"),
            "notes":      patient.get("notes"),
            "created_at": patient.get("created_at"),
            "component":  "fall_risk_detection",
        }).execute()
    except Exception as e:
        print(f"[supabase] sync_patient failed: {e}")


def sync_alert(alert: dict):
    """Push one fall alert to Supabase fall_alerts table."""
    client = _get_client()
    if not client:
        return
    try:
        client.table("fall_alerts").upsert({
            "id":           alert["id"],
            "patient_id":   alert.get("patient_id"),
            "room_id":      alert.get("room_id"),
            "timestamp":    alert.get("timestamp"),
            "risk_score":   alert.get("risk_score"),
            "risk_level":   alert.get("risk_level"),
            "posture":      alert.get("posture"),
            "key_factors":  json.dumps(alert.get("key_factors", [])),
            "acknowledged": alert.get("acknowledged", 0),
            "ack_by":       alert.get("ack_by"),
            "ack_at":       alert.get("ack_at"),
            "component":    "fall_risk_detection",
        }).execute()
    except Exception as e:
        print(f"[supabase] sync_alert failed: {e}")


def sync_event(event: dict):
    """Push one inference event to Supabase fall_events table."""
    client = _get_client()
    if not client:
        return
    try:
        client.table("fall_events").upsert({
            "id":           event["id"],
            "patient_id":   event.get("patient_id"),
            "room_id":      event.get("room_id"),
            "timestamp":    event.get("timestamp"),
            "risk_score":   event.get("risk_score"),
            "risk_level":   event.get("risk_level"),
            "posture":      event.get("posture"),
            "confidence":   event.get("confidence"),
            "key_factors":  json.dumps(event.get("key_factors", [])),
            "component":    "fall_risk_detection",
        }).execute()
    except Exception as e:
        print(f"[supabase] sync_event failed: {e}")


# ---------------------------------------------------------------------------
# Background bulk sync — runs on startup to push any unsynced local records
# ---------------------------------------------------------------------------

def bulk_sync_on_startup():
    """
    Called once at app startup in a background thread.
    Pushes all existing SQLite patients + alerts to Supabase.
    """
    if not is_enabled():
        return

    def _run():
        time.sleep(3)  # wait for app to fully start
        try:
            from src.database import get_patients, get_alerts
            patients = get_patients()
            alerts   = get_alerts(unacked_only=False, limit=1000)
            print(f"[supabase] Bulk sync: {len(patients)} patients, {len(alerts)} alerts")
            for p in patients:
                sync_patient(p)
            for a in alerts:
                sync_alert(a)
            print("[supabase] Bulk sync complete.")
        except Exception as e:
            print(f"[supabase] Bulk sync failed: {e}")

    threading.Thread(target=_run, daemon=True).start()
