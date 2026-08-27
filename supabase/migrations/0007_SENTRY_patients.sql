-- ============================================================
-- 0007_SENTRY_patients.sql
-- SENTRY Component — Fall Risk Detection (Component 2)
-- Stores patient records monitored by the SENTRY system.
-- ============================================================

create table patients (
  id          text primary key,
  name        text not null,
  age         integer,
  gender      text check (gender in ('M', 'F', 'Other')),
  room_id     text,
  bed         text,
  notes       text,
  created_at  timestamptz not null default now()
);

comment on table patients is
  'Static patient records for SENTRY fall risk monitoring.
  Each patient is assigned to a room and monitored via USB camera.';

alter table patients enable row level security;

create policy "Authenticated users can read patients"
  on patients for select
  using (auth.role() = 'authenticated');

create policy "Service role can manage patients"
  on patients for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

grant select on patients to authenticated;
grant select, insert, update, delete on patients to service_role;
