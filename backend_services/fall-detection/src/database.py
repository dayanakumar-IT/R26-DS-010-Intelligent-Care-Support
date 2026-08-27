"""
SQLite event database.

Schema
------
patients        — static patient records
rooms           — static room records
events          — one row per inference window (risk_score, level, posture …)
alerts          — one row per fired HIGH alert, with acknowledgement flag
skeleton_replay — 5-second skeleton buffer saved on each HIGH event

Raw video frames are NEVER stored. Only skeletal coordinates.
"""
from __future__ import annotations

import json
import os
import sqlite3
import time
from contextlib import contextmanager
from typing import List, Optional

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "fallrisk.db"
)

_SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS patients (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    age         INTEGER,
    gender      TEXT,
    room_id     TEXT,
    bed         TEXT,
    notes       TEXT,
    created_at  REAL DEFAULT (unixepoch('now'))
);

CREATE TABLE IF NOT EXISTS rooms (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    ward         TEXT,
    camera_src   TEXT,
    camera_suffix TEXT DEFAULT '',
    caregiver_id TEXT,
    zone_config  TEXT
);

CREATE TABLE IF NOT EXISTS caregivers (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    role       TEXT DEFAULT 'Nurse',
    phone      TEXT,
    email      TEXT,
    created_at REAL DEFAULT (unixepoch('now'))
);

CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id   TEXT,
    room_id      TEXT,
    timestamp    REAL NOT NULL,
    risk_score   REAL NOT NULL,
    risk_level   TEXT NOT NULL,
    posture      TEXT,
    zone         TEXT,
    pose_quality TEXT,
    confidence   REAL,
    key_factors  TEXT,   -- JSON list of strings
    alert_id     INTEGER
);

CREATE TABLE IF NOT EXISTS alerts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id   TEXT,
    room_id      TEXT,
    timestamp    REAL NOT NULL,
    risk_score   REAL NOT NULL,
    risk_level   TEXT NOT NULL,
    posture      TEXT,
    key_factors  TEXT,   -- JSON list of strings
    acknowledged INTEGER DEFAULT 0,
    ack_by       TEXT,
    ack_at       REAL
);

CREATE TABLE IF NOT EXISTS skeleton_replay (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id    INTEGER NOT NULL REFERENCES alerts(id),
    frame_index INTEGER NOT NULL,
    timestamp   REAL NOT NULL,
    skeleton    TEXT NOT NULL    -- JSON (14, 4) array
);

CREATE INDEX IF NOT EXISTS idx_events_patient   ON events(patient_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_room      ON events(room_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_patient   ON alerts(patient_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_ack       ON alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_replay_alert     ON skeleton_replay(alert_id, frame_index);
"""


@contextmanager
def _conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def init_db():
    with _conn() as con:
        con.executescript(_SCHEMA)


# ── Patients ────────────────────────────────────────────────────────────────

def upsert_patient(id: str, name: str, age: int = None, gender: str = None,
                   room_id: str = None, bed: str = None, notes: str = None):
    with _conn() as con:
        con.execute("""
            INSERT INTO patients (id, name, age, gender, room_id, bed, notes)
            VALUES (?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, age=excluded.age, gender=excluded.gender,
                room_id=excluded.room_id, bed=excluded.bed, notes=excluded.notes
        """, (id, name, age, gender, room_id, bed, notes))
    try:
        from src.supabase_sync import sync_patient
        sync_patient({"id": id, "name": name, "age": age, "gender": gender,
                      "room_id": room_id, "bed": bed, "notes": notes})
    except Exception:
        pass


def get_patients() -> List[dict]:
    with _conn() as con:
        rows = con.execute("SELECT * FROM patients ORDER BY id").fetchall()
    return [dict(r) for r in rows]


def get_patient(patient_id: str) -> Optional[dict]:
    with _conn() as con:
        row = con.execute("SELECT * FROM patients WHERE id=?",
                          (patient_id,)).fetchone()
    return dict(row) if row else None


# ── Rooms ───────────────────────────────────────────────────────────────────

def upsert_room(id: str, name: str, ward: str = None,
                camera_src: str = None, camera_suffix: str = "",
                zone_config: dict = None):
    with _conn() as con:
        con.execute("""
            INSERT INTO rooms (id, name, ward, camera_src, camera_suffix, zone_config)
            VALUES (?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, ward=excluded.ward,
                camera_src=excluded.camera_src,
                camera_suffix=excluded.camera_suffix,
                zone_config=excluded.zone_config
        """, (id, name, ward, camera_src, camera_suffix or "",
               json.dumps(zone_config) if zone_config else None))


def get_rooms() -> List[dict]:
    with _conn() as con:
        rows = con.execute("SELECT * FROM rooms ORDER BY id").fetchall()
    return [dict(r) for r in rows]


def get_rooms_with_camera() -> List[dict]:
    """Return only rooms that have a camera configured — used for auto-start on server boot."""
    with _conn() as con:
        rows = con.execute(
            "SELECT * FROM rooms WHERE camera_src IS NOT NULL AND camera_src != '' ORDER BY id"
        ).fetchall()
    return [dict(r) for r in rows]


def update_room_camera(room_id: str, camera_src: str, camera_suffix: str = ""):
    """Set or update the camera source for a room. Persists across server restarts."""
    with _conn() as con:
        con.execute(
            "UPDATE rooms SET camera_src=?, camera_suffix=? WHERE id=?",
            (camera_src, camera_suffix or "", room_id)
        )


def assign_caregiver_to_room(room_id: str, caregiver_id: str):
    with _conn() as con:
        con.execute("UPDATE rooms SET caregiver_id=? WHERE id=?",
                    (caregiver_id, room_id))


# ── Caregivers ───────────────────────────────────────────────────────────────

def upsert_caregiver(id: str, name: str, role: str = "Nurse",
                     phone: str = None, email: str = None):
    with _conn() as con:
        con.execute("""
            INSERT INTO caregivers (id, name, role, phone, email)
            VALUES (?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, role=excluded.role,
                phone=excluded.phone, email=excluded.email
        """, (id, name, role, phone, email))


def get_caregivers() -> List[dict]:
    with _conn() as con:
        rows = con.execute("SELECT * FROM caregivers ORDER BY name").fetchall()
    return [dict(r) for r in rows]


def get_caregiver(caregiver_id: str) -> Optional[dict]:
    with _conn() as con:
        row = con.execute("SELECT * FROM caregivers WHERE id=?",
                          (caregiver_id,)).fetchone()
    return dict(row) if row else None


def get_room_zones(room_id: str) -> dict:
    """Return zone polygon map for a room, or empty dict if not configured."""
    with _conn() as con:
        row = con.execute("SELECT zone_config FROM rooms WHERE id=?",
                          (room_id,)).fetchone()
    if row and row["zone_config"]:
        return json.loads(row["zone_config"])
    return {}


def set_room_zones(room_id: str, zones: dict):
    """Save zone polygon map for a room."""
    with _conn() as con:
        con.execute("UPDATE rooms SET zone_config=? WHERE id=?",
                    (json.dumps(zones), room_id))


# ── Events ──────────────────────────────────────────────────────────────────

def insert_event(patient_id: str, room_id: str, timestamp: float,
                 risk_score: float, risk_level: str, posture: str = None,
                 zone: str = None, pose_quality: str = None,
                 confidence: float = None, key_factors: List[str] = None,
                 alert_id: int = None) -> int:
    with _conn() as con:
        cur = con.execute("""
            INSERT INTO events
              (patient_id, room_id, timestamp, risk_score, risk_level,
               posture, zone, pose_quality, confidence, key_factors, alert_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (patient_id, room_id, timestamp, risk_score, risk_level,
               posture, zone, pose_quality, confidence,
               json.dumps(key_factors or []), alert_id))
        return cur.lastrowid


def get_patient_history(patient_id: str, limit: int = 200) -> List[dict]:
    with _conn() as con:
        rows = con.execute("""
            SELECT * FROM events WHERE patient_id=?
            ORDER BY timestamp DESC LIMIT ?
        """, (patient_id, limit)).fetchall()
    return [dict(r) for r in rows]


# ── Alerts ──────────────────────────────────────────────────────────────────

def insert_alert(patient_id: str, room_id: str, timestamp: float,
                 risk_score: float, risk_level: str, posture: str = None,
                 key_factors: List[str] = None) -> int:
    with _conn() as con:
        cur = con.execute("""
            INSERT INTO alerts
              (patient_id, room_id, timestamp, risk_score, risk_level,
               posture, key_factors)
            VALUES (?,?,?,?,?,?,?)
        """, (patient_id, room_id, timestamp, risk_score, risk_level,
               posture, json.dumps(key_factors or [])))
        alert_id = cur.lastrowid
    try:
        from src.supabase_sync import sync_alert
        sync_alert({"id": alert_id, "patient_id": patient_id, "room_id": room_id,
                    "timestamp": timestamp, "risk_score": risk_score,
                    "risk_level": risk_level, "posture": posture,
                    "key_factors": key_factors or []})
    except Exception:
        pass
    return alert_id


def acknowledge_alert(alert_id: int, ack_by: str = "caregiver") -> bool:
    with _conn() as con:
        cur = con.execute("""
            UPDATE alerts SET acknowledged=1, ack_by=?, ack_at=?
            WHERE id=? AND acknowledged=0
        """, (ack_by, time.time(), alert_id))
        return cur.rowcount > 0


def get_alerts(unacked_only: bool = False, limit: int = 100) -> List[dict]:
    where = "WHERE acknowledged=0" if unacked_only else ""
    with _conn() as con:
        rows = con.execute(f"""
            SELECT * FROM alerts {where}
            ORDER BY timestamp DESC LIMIT ?
        """, (limit,)).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["key_factors"] = json.loads(d.get("key_factors") or "[]")
        result.append(d)
    return result


# ── Skeleton replay ─────────────────────────────────────────────────────────

def save_replay_frames(alert_id: int,
                       frames: List[tuple]):
    """
    frames: list of (frame_index, timestamp, skeleton_array)
    skeleton_array: np.ndarray (14, 4)
    """
    import numpy as np
    with _conn() as con:
        con.executemany("""
            INSERT INTO skeleton_replay (alert_id, frame_index, timestamp, skeleton)
            VALUES (?,?,?,?)
        """, [
            (alert_id, idx, ts, json.dumps(sk.tolist() if hasattr(sk, "tolist") else sk))
            for idx, ts, sk in frames
        ])


def get_replay(alert_id: int) -> List[dict]:
    with _conn() as con:
        rows = con.execute("""
            SELECT frame_index, timestamp, skeleton
            FROM skeleton_replay WHERE alert_id=?
            ORDER BY frame_index
        """, (alert_id,)).fetchall()
    return [{"frame_index": r["frame_index"],
             "timestamp":   r["timestamp"],
             "skeleton":    json.loads(r["skeleton"])} for r in rows]


# ── Analytics ───────────────────────────────────────────────────────────────

def get_dashboard_summary() -> dict:
    with _conn() as con:
        total_patients = con.execute("SELECT COUNT(*) FROM patients").fetchone()[0]
        total_alerts   = con.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
        unacked        = con.execute(
            "SELECT COUNT(*) FROM alerts WHERE acknowledged=0").fetchone()[0]
        high_today     = con.execute("""
            SELECT COUNT(*) FROM alerts
            WHERE risk_level='HIGH'
              AND timestamp > unixepoch('now','-1 day')
        """).fetchone()[0]
        # Latest risk level per patient
        levels = con.execute("""
            SELECT risk_level, COUNT(*) as cnt FROM (
                SELECT patient_id, risk_level,
                       ROW_NUMBER() OVER (PARTITION BY patient_id
                                          ORDER BY timestamp DESC) rn
                FROM events
            ) WHERE rn=1
            GROUP BY risk_level
        """).fetchall()
    level_counts = {r["risk_level"]: r["cnt"] for r in levels}
    return {
        "total_patients": total_patients,
        "total_alerts":   total_alerts,
        "unacknowledged_alerts": unacked,
        "high_alerts_today": high_today,
        "patients_by_level": level_counts,
    }


# ── Seed demo data ──────────────────────────────────────────────────────────

def seed_demo_data():
    """Insert demo rooms, patients, and caregivers on first run.
    Camera sources are NOT seeded — supervisor configures them once via the portal.
    On every server restart, rooms with camera_src already saved in DB auto-start.
    """
    # Rooms — camera_src left None until supervisor configures via portal
    rooms = [
        ("ROOM_01", "Ward A - Room 1", "Ward A"),
        ("ROOM_02", "Ward A - Room 2", "Ward A"),
        ("ROOM_03", "Ward B - Room 1", "Ward B"),
    ]
    for r in rooms:
        upsert_room(r[0], r[1], ward=r[2])

    # Patients
    patients = [
        ("P001", "Patient 01", 72, "M", "ROOM_01", "Bed A1"),
        ("P002", "Patient 02", 68, "F", "ROOM_02", "Bed A2"),
        ("P003", "Patient 03", 80, "M", "ROOM_03", "Bed B1"),
    ]
    for p in patients:
        upsert_patient(p[0], p[1], age=p[2], gender=p[3],
                       room_id=p[4], bed=p[5])

    # Demo caregivers
    caregivers = [
        ("C001", "Nurse Sarah",  "Nurse",   "+94771234567"),
        ("C002", "Nurse James",  "Nurse",   "+94779876543"),
        ("C003", "Dr. Perera",   "Doctor",  "+94770001111"),
    ]
    for c in caregivers:
        upsert_caregiver(c[0], c[1], role=c[2], phone=c[3])


if __name__ == "__main__":
    init_db()
    seed_demo_data()
    print(f"Database initialised at: {DB_PATH}")
    print("Summary:", get_dashboard_summary())
