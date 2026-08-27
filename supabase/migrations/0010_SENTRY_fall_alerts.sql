-- ============================================================
-- 0010_SENTRY_fall_alerts.sql
-- SENTRY Component — Fall Risk Detection (Component 2)
-- One row per fired alert (HIGH or MODERATE after dwell timer).
-- Skeleton replay blobs are stored in Cloudflare R2 (NOT here).
-- ============================================================

create table fall_alerts (
  id           bigserial primary key,
  patient_id   text references patients(id) on delete set null,
  room_id      text references rooms(id) on delete set null,
  timestamp    timestamptz not null default now(),
  risk_score   real not null check (risk_score >= 0 and risk_score <= 100),
  risk_level   text not null check (risk_level in ('MODERATE', 'HIGH')),
  posture      text,
  key_factors  jsonb default '[]',
  acknowledged boolean not null default false,
  ack_by       text,
  ack_at       timestamptz,
  r2_replay_key text
);

comment on table fall_alerts is
  'One row per fired SENTRY alert (MODERATE or HIGH risk level).
  acknowledged=true when a caregiver has dismissed the alert.
  r2_replay_key is the Cloudflare R2 object key for the skeleton
  replay blob (e.g. replays/alert_123.json) — only set for HIGH alerts.
  Raw video is NEVER stored — only skeletal joint coordinates.';

create index idx_fall_alerts_patient on fall_alerts(patient_id, timestamp desc);
create index idx_fall_alerts_unacked on fall_alerts(acknowledged) where acknowledged = false;
create index idx_fall_alerts_timestamp on fall_alerts(timestamp desc);

alter table fall_alerts enable row level security;

create policy "Authenticated users can read fall alerts"
  on fall_alerts for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can acknowledge alerts"
  on fall_alerts for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Service role can manage fall alerts"
  on fall_alerts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

grant select, update on fall_alerts to authenticated;
grant select, insert, update, delete on fall_alerts to service_role;
grant usage, select on sequence fall_alerts_id_seq to service_role;
