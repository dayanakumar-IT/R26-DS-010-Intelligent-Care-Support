-- ============================================================
-- 0006_caregiver_profiles.sql
-- Shared across all 4 components. Represents a caregiver being
-- monitored — NOT a login account (caregivers never authenticate;
-- only admin/supervisor profiles do). Each row links a synthetic
-- display identity to one real, anonymized TILES-2018 participant,
-- whose actual recorded data powers whatever this caregiver "shows."
-- ============================================================

create table caregiver_profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  ward text,
  institution text default 'National Hospital of Sri Lanka',
  participant_id uuid not null unique references participants(participant_id),
  data_mode text not null check (data_mode in ('historical', 'replay')),
  supervisor_id uuid references profiles(id),
  is_synthetic boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table caregiver_profiles is
  'Synthetic caregiver identities for demo purposes. is_synthetic is
  always true here — this table exists to make the UI show something
  human-readable while the underlying data is real, anonymized
  TILES-2018 participant data. data_mode=historical means static
  display of past values (used for the 25 test-set participants);
  data_mode=replay means timestamp-ordered playback simulating live
  incoming data (used for the 15 held-out demo-pool participants).';

create table device_registrations (
  id uuid primary key default gen_random_uuid(),
  caregiver_profile_id uuid not null references caregiver_profiles(id) on delete cascade,
  device_id text not null unique,
  device_type text not null default 'Simulated Fitbit — TILES-2018 replay',
  registered_at timestamptz not null default now()
);

alter table caregiver_profiles enable row level security;
alter table device_registrations enable row level security;

create policy "Admins see all caregiver profiles"
  on caregiver_profiles for select
  using (public.is_admin());

create policy "Supervisors see their assigned caregivers"
  on caregiver_profiles for select
  using (auth.uid() = supervisor_id);

create policy "Admins can manage caregiver profiles"
  on caregiver_profiles for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Users see devices for caregivers they can see"
  on device_registrations for select
  using (
    exists (
      select 1 from caregiver_profiles cp
      where cp.id = device_registrations.caregiver_profile_id
      and (public.is_admin() or cp.supervisor_id = auth.uid())
    )
  );

create policy "Admins can manage device registrations"
  on device_registrations for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on caregiver_profiles to authenticated;
grant select, insert, update, delete on caregiver_profiles to service_role;
grant select on device_registrations to authenticated;
grant select, insert, update, delete on device_registrations to service_role;
