-- ============================================================
-- 0032_SCRIBE_care_activities_and_assignments.sql
-- SCRIBE Component — care activity sessions, patient–caregiver
-- assignment history (handover), and handover summaries.
--
-- Design:
--   scribe_patient_assignments — one row per assignment period.
--     ended_at IS NULL means the current caregiver for that patient.
--     Handover ends the current row and inserts a new one (never overwrites).
--   scribe_care_activities — one row per care session (in_progress → completed).
--     Daily summary is generated only when status becomes completed.
--   scribe_handover_summaries — cached summary when a handover occurs.
--   adl_records.care_activity_id — links observations to a care session.
-- ============================================================

-- ------------------------------------------------------------------
-- Patient ↔ caregiver assignment history (supports handover)
-- ------------------------------------------------------------------
create table scribe_patient_assignments (
  id              uuid primary key default gen_random_uuid(),
  patient_id      bigint not null references patients(id),
  caregiver_id    uuid not null references caregiver_profiles(id),
  assigned_at     timestamptz not null default now(),
  ended_at        timestamptz,
  assigned_by     uuid references profiles(id),
  handover_notes  text,
  created_at      timestamptz not null default now()
);

comment on table scribe_patient_assignments is
  'SCRIBE: patient–caregiver assignment periods. Only one row per patient
  may have ended_at IS NULL (current assignment). Handover closes the prior
  row and opens a new one — previous caregivers are retained in history.';

create unique index idx_scribe_assignments_current_patient
  on scribe_patient_assignments (patient_id)
  where ended_at is null;

create index idx_scribe_assignments_caregiver_current
  on scribe_patient_assignments (caregiver_id)
  where ended_at is null;

create index idx_scribe_assignments_patient_history
  on scribe_patient_assignments (patient_id, assigned_at desc);

-- ------------------------------------------------------------------
-- Care activity sessions (start → record → finish → process)
-- ------------------------------------------------------------------
create table scribe_care_activities (
  id                          uuid primary key default gen_random_uuid(),
  patient_id                  bigint not null references patients(id),
  caregiver_id                uuid not null references caregiver_profiles(id),
  status                      text not null default 'in_progress'
                                check (status in ('in_progress', 'completed')),
  started_at                  timestamptz not null default now(),
  completed_at                timestamptz,
  daily_summary_text          text,
  daily_summary_generated_at  timestamptz,
  created_at                  timestamptz not null default now()
);

comment on table scribe_care_activities is
  'SCRIBE: a single care activity session. Observations recorded during the
  session link via adl_records.care_activity_id. Daily summary is generated
  when the caregiver explicitly completes the activity — not while recording.';

create index idx_scribe_care_activities_patient_day
  on scribe_care_activities (patient_id, started_at desc);

create index idx_scribe_care_activities_caregiver_day
  on scribe_care_activities (caregiver_id, started_at desc);

-- ------------------------------------------------------------------
-- Handover summaries (generated when supervisor transfers a patient)
-- ------------------------------------------------------------------
create table scribe_handover_summaries (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          bigint not null references patients(id),
  assignment_id       uuid not null references scribe_patient_assignments(id),
  from_caregiver_id   uuid references caregiver_profiles(id),
  to_caregiver_id     uuid not null references caregiver_profiles(id),
  handover_at         timestamptz not null default now(),
  summary_text        text not null,
  generated_at        timestamptz not null default now()
);

comment on table scribe_handover_summaries is
  'SCRIBE: dynamically generated handover brief for the incoming caregiver.
  Linked to the new assignment row created during handover.';

create index idx_scribe_handover_summaries_patient
  on scribe_handover_summaries (patient_id, handover_at desc);

-- ------------------------------------------------------------------
-- Link observations to care activities
-- ------------------------------------------------------------------
alter table adl_records
  add column if not exists care_activity_id uuid
    references scribe_care_activities(id) on delete set null;

comment on column adl_records.care_activity_id is
  'SCRIBE: care activity session this observation belongs to (set when
  upload occurs after the caregiver finishes a care activity).';

create index idx_adl_records_care_activity
  on adl_records (care_activity_id)
  where care_activity_id is not null;

-- ------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------
alter table scribe_patient_assignments enable row level security;
alter table scribe_care_activities enable row level security;
alter table scribe_handover_summaries enable row level security;

create policy "Admins manage scribe patient assignments"
  on scribe_patient_assignments for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Supervisors read scribe patient assignments"
  on scribe_patient_assignments for select
  using (public.is_supervisor());

create policy "Caregivers read their scribe patient assignments"
  on scribe_patient_assignments for select
  using (caregiver_id = public.scribe_caregiver_profile_id());

create policy "Admins manage scribe care activities"
  on scribe_care_activities for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Supervisors read scribe care activities"
  on scribe_care_activities for select
  using (public.is_supervisor());

create policy "Caregivers read their scribe care activities"
  on scribe_care_activities for select
  using (caregiver_id = public.scribe_caregiver_profile_id());

create policy "Admins manage scribe handover summaries"
  on scribe_handover_summaries for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Supervisors read scribe handover summaries"
  on scribe_handover_summaries for select
  using (public.is_supervisor());

create policy "Caregivers read handover summaries for their patients"
  on scribe_handover_summaries for select
  using (
    to_caregiver_id = public.scribe_caregiver_profile_id()
    or from_caregiver_id = public.scribe_caregiver_profile_id()
  );

grant select on scribe_patient_assignments to authenticated;
grant select on scribe_care_activities to authenticated;
grant select on scribe_handover_summaries to authenticated;
grant select, insert, update, delete on scribe_patient_assignments to service_role;
grant select, insert, update, delete on scribe_care_activities to service_role;
grant select, insert, update, delete on scribe_handover_summaries to service_role;
