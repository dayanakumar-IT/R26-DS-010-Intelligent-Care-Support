-- ============================================================
-- 0019_gloss_caregiver_accounts.sql
-- GLOSS component — Personalised Sign Language Tutoring for Caregivers
-- Owner: Kaushalya (R26-DS-010)
--
-- Table: gloss_caregiver_accounts
-- One row per caregiver who can log in and practice signs.
-- Links their login (profiles.id, role='caregiver') to their
-- existing identity (caregiver_profile_id) in caregiver_profiles.
-- References profiles(id) rather than auth.users(id) directly,
-- matching the existing supervisor_id convention in
-- caregiver_profiles. Created by an admin only (service_role) —
-- same admin-only pattern used for profiles itself, no self-signup.
--
-- Depends on: profiles (0002), caregiver_profiles (0006)
-- ============================================================

create table gloss_caregiver_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  caregiver_profile_id uuid not null unique references caregiver_profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table gloss_caregiver_accounts is
  'Links a caregiver''s login (profiles.id, expected role=caregiver)
  to their existing caregiver_profiles row. Lets caregivers
  authenticate directly without any change to caregiver_profiles
  or profiles. Row is created by an admin only.';

alter table gloss_caregiver_accounts enable row level security;

create policy "Caregiver sees own gloss account"
  on gloss_caregiver_accounts for select
  using (auth.uid() = user_id);

create policy "Admins manage gloss accounts"
  on gloss_caregiver_accounts for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on gloss_caregiver_accounts to authenticated;
grant select, insert, update, delete on gloss_caregiver_accounts to service_role;
