-- ============================================================
-- 0013_SCRIBE_adl_records.sql
-- SCRIBE Component — Voice ADL Logging (Component 4)
-- One row per voice observation. One recording = one record.
-- Audio path stored in r2_audio_key (Cloudflare R2, private).
--
-- Depends on: public.is_admin() defined in 0002_profiles.sql
--
-- Write path: caregivers and supervisors have SELECT only on this
-- table. All inserts/updates go through the backend API using the
-- service_role key (after the AI pipeline runs). See 0017 for
-- updated_at and client_recording_id columns.
-- ============================================================

-- Link login accounts (profiles) to caregiver identities so SCRIBE
-- can resolve caregiver_id after a caregiver authenticates.
alter table caregiver_profiles
  add column if not exists profile_id uuid unique references profiles(id) on delete set null;

comment on column caregiver_profiles.profile_id is
  'SCRIBE: links a profiles login row to this caregiver identity.
  Used to resolve caregiver_profiles.id after caregiver auth.';

create policy "Caregivers can read their own caregiver profile"
  on caregiver_profiles for select
  using (profile_id = auth.uid());

-- SCRIBE RLS helpers
create or replace function public.is_supervisor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'supervisor'
  );
$$;

create or replace function public.scribe_caregiver_profile_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select cp.id
  from caregiver_profiles cp
  where cp.profile_id = auth.uid();
$$;

create table adl_records (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          bigint not null references patients(id),
  caregiver_id        uuid not null references caregiver_profiles(id),
  recorded_at         timestamptz not null default now(),
  category            text not null check (category in (
                        'medication', 'meal', 'fluid_intake', 'hygiene',
                        'mobility', 'symptom', 'mood', 'nurse_check',
                        'family_visit'
                      )),
  medication_name     text,
  dosage              text,
  food_item           text,
  meal_type           text,
  intake_level        text check (
                        intake_level is null
                        or intake_level in ('full', 'partial', 'refused')
                      ),
  fluid_type          text,
  fluid_amount        text,
  hygiene_activity    text,
  mobility_type       text,
  destination         text,
  symptom_type        text,
  vital_type          text,
  vital_reading       text,
  vital_status        text,
  visitor_type        text,
  visit_reason        text,
  time_of_day         text,
  alert_required      boolean not null default false,
  raw_transcript      text,
  cleaned_transcript  text,
  r2_audio_key        text,
  model_registry_id   uuid references model_registry(id),
  created_at          timestamptz not null default now()
);

comment on table adl_records is
  'SCRIBE: one row per processed voice observation.
  Structured fields are populated by the T5 extraction pipeline (Stage 5).
  r2_audio_key is the private R2 object key (e.g. scribe/audio/P01/{id}.opus);
  set to null when raw audio is purged after retention. Never store real
  patient names — use patients.patient_code for display only.';

create index idx_adl_records_patient_time
  on adl_records (patient_id, recorded_at desc);

create index idx_adl_records_caregiver_time
  on adl_records (caregiver_id, recorded_at desc);

create index idx_adl_records_alert_required
  on adl_records (alert_required)
  where alert_required = true;

alter table adl_records enable row level security;

create policy "Admins can manage adl records"
  on adl_records for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Supervisors can read adl records"
  on adl_records for select
  using (public.is_supervisor());

create policy "Caregivers can read their own adl records"
  on adl_records for select
  using (caregiver_id = public.scribe_caregiver_profile_id());

grant select on adl_records to authenticated;
grant select, insert, update, delete on adl_records to service_role;
