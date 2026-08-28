-- ============================================================
-- 0007_SENTRY_patients.sql
-- SENTRY Component — Fall Risk Detection (Component 2)
-- Patients monitored by the SENTRY fall detection system.
-- patient_code (e.g. P01, P02) shown in UI — no real names stored.
-- Teammates reference id (PK) and read patient_code + gender.
-- ============================================================

drop table if exists patients cascade;

create table patients (
  id            bigint generated always as identity primary key,
  patient_code  text not null unique,
  gender        text check (gender in ('M', 'F', 'Other')),
  room_id       text,
  created_at    timestamptz not null default now()
);

comment on table patients is
  'SENTRY patient registry. patient_code (e.g. P01) is the display
  identifier — no real names stored. room_id links the patient to
  the monitored room. Teammates use id as FK and read patient_code
  and gender.';

alter table patients enable row level security;

create policy "Admins can manage patients"
  on patients for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Supervisors can read patients"
  on patients for select
  using (auth.role() = 'authenticated');

grant select on patients to authenticated;
grant select, insert, update, delete on patients to service_role;
