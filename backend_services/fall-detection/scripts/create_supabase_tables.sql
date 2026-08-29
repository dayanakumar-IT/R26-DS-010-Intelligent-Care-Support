-- Run this ONCE in Supabase SQL Editor to create tables for the
-- Fall Risk Detection component.
-- Other group project components can read from these tables.

CREATE TABLE IF NOT EXISTS patients (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    age         INTEGER,
    gender      TEXT,
    room_id     TEXT,
    bed         TEXT,
    notes       TEXT,
    created_at  DOUBLE PRECISION,
    component   TEXT DEFAULT 'fall_risk_detection'
);

CREATE TABLE IF NOT EXISTS fall_alerts (
    id           INTEGER PRIMARY KEY,
    patient_id   TEXT,
    room_id      TEXT,
    timestamp    DOUBLE PRECISION NOT NULL,
    risk_score   DOUBLE PRECISION NOT NULL,
    risk_level   TEXT NOT NULL,
    posture      TEXT,
    key_factors  TEXT,
    acknowledged INTEGER DEFAULT 0,
    ack_by       TEXT,
    ack_at       DOUBLE PRECISION,
    component    TEXT DEFAULT 'fall_risk_detection'
);

CREATE TABLE IF NOT EXISTS fall_events (
    id           INTEGER PRIMARY KEY,
    patient_id   TEXT,
    room_id      TEXT,
    timestamp    DOUBLE PRECISION NOT NULL,
    risk_score   DOUBLE PRECISION NOT NULL,
    risk_level   TEXT NOT NULL,
    posture      TEXT,
    confidence   DOUBLE PRECISION,
    key_factors  TEXT,
    component    TEXT DEFAULT 'fall_risk_detection'
);

-- Indexes for fast queries by other components
CREATE INDEX IF NOT EXISTS idx_fall_alerts_patient   ON fall_alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_fall_alerts_timestamp ON fall_alerts(timestamp);
CREATE INDEX IF NOT EXISTS idx_fall_events_patient   ON fall_events(patient_id);
CREATE INDEX IF NOT EXISTS idx_fall_events_timestamp ON fall_events(timestamp);
