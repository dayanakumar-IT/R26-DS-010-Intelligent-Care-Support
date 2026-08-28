-- ============================================================
-- 0014_SCRIBE_adl_alerts.sql
-- SCRIBE Component — Voice ADL Logging (Component 4)
-- One row per clinically flagged observation (alert_required=true).
-- Supervisors acknowledge alerts; Realtime pushes live updates.
--
-- Depends on: public.is_admin() (0002_profiles.sql),
--             public.is_supervisor() (0013_SCRIBE_adl_records.sql)
--
-- Write path: inserts are backend-only (service_role). Supervisors
-- may UPDATE acknowledged/ack_by/ack_at via the authenticated client.
-- ============================================================

create table adl_alerts (
  id              uuid primary key default gen_random_uuid(),
  adl_record_id   uuid not null references adl_records(id) on delete cascade,
  patient_id      bigint not null references patients(id),
  created_at      timestamptz not null default now(),
  acknowledged    boolean not null default false,
  ack_by          uuid references profiles(id),
  ack_at          timestamptz
);

comment on table adl_alerts is
  'SCRIBE: one row per flagged ADL observation.
  Created by the backend when adl_records.alert_required is true.
  Supervisors acknowledge via the Alerts page; ack_by references
  the supervisor profiles row.';

create index idx_adl_alerts_unresolved
  on adl_alerts (acknowledged, created_at desc);

create index idx_adl_alerts_patient
  on adl_alerts (patient_id, created_at desc);

create index idx_adl_alerts_adl_record
  on adl_alerts (adl_record_id);

alter table adl_alerts enable row level security;

create policy "Admins can manage adl alerts"
  on adl_alerts for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Supervisors can read adl alerts"
  on adl_alerts for select
  using (public.is_supervisor());

create policy "Supervisors can acknowledge adl alerts"
  on adl_alerts for update
  using (public.is_supervisor())
  with check (public.is_supervisor());

grant select, update on adl_alerts to authenticated;
grant select, insert, update, delete on adl_alerts to service_role;
