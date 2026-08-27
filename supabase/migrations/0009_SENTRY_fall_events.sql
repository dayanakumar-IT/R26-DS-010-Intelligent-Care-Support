-- ============================================================
-- 0009_SENTRY_fall_events.sql
-- SENTRY Component — Fall Risk Detection (Component 2)
-- One row per inference window (every ~3 seconds per camera).
-- High-frequency table — keep only recent windows for performance.
-- ============================================================

create table fall_events (
  id           bigserial primary key,
  patient_id   text references patients(id) on delete set null,
  room_id      text references rooms(id) on delete set null,
  timestamp    timestamptz not null default now(),
  risk_score   real not null check (risk_score >= 0 and risk_score <= 100),
  risk_level   text not null check (risk_level in ('NORMAL', 'MODERATE', 'HIGH')),
  posture      text,
  zone         text,
  pose_quality text,
  confidence   real,
  key_factors  jsonb default '[]',
  alert_id     bigint
);

comment on table fall_events is
  'One row per ST-GCN + Late Fusion inference window (~3s at 30 FPS).
  risk_score is 0-100 (100 = highest fall risk).
  key_factors is a JSON list of contributing biomechanical features.
  alert_id links to fall_alerts when this window triggered an alert.';

create index idx_fall_events_patient   on fall_events(patient_id, timestamp desc);
create index idx_fall_events_room      on fall_events(room_id, timestamp desc);
create index idx_fall_events_timestamp on fall_events(timestamp desc);

alter table fall_events enable row level security;

create policy "Authenticated users can read fall events"
  on fall_events for select
  using (auth.role() = 'authenticated');

create policy "Service role can manage fall events"
  on fall_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

grant select on fall_events to authenticated;
grant select, insert, update, delete on fall_events to service_role;
grant usage, select on sequence fall_events_id_seq to service_role;
