"""
supabase_sync.py — DEPRECATED (kept for import compatibility).

Previously synced SQLite → Supabase.
Now Supabase IS the primary database (database.py writes directly).
This module is a no-op stub so existing imports don't break.
"""


def sync_patient(patient: dict):
    pass


def sync_alert(alert: dict):
    pass


def sync_event(event: dict):
    pass


def bulk_sync_on_startup():
    pass


def is_enabled() -> bool:
    return True
