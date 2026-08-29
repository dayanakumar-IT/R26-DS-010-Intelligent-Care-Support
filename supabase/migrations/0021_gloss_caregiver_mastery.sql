-- ============================================================
-- 0021_gloss_caregiver_mastery.sql
-- GLOSS component — Personalised Sign Language Tutoring for Caregivers
-- Owner: Kaushalya (R26-DS-010)
--
-- Table: gloss_caregiver_mastery
-- One row per caregiver+sign combination. This is what makes
-- the tutoring personalised — it remembers how each caregiver
-- is doing on each individual sign. Read by the adaptive lesson
-- selector to decide what to teach next.
--
-- Depends on: caregiver_profiles (0006), gloss_signs (0020),
-- gloss_caregiver_accounts (0019)
-- ============================================================

create table gloss_caregiver_mastery (
  id uuid primary key default gen_random_uuid(),
  caregiver_profile_id uuid not null references caregiver_profiles(id) on delete cascade,
  sign_id text not null references gloss_signs(id),
  attempts int not null default 0,
  consecutive_strong_streak int not null default 0,
  mastery_status text not null default 'new'
    check (mastery_status in ('new', 'learning', 'weak', 'improving', 'mastered', 'needs_revision')),
  recognition_mismatch_count int not null default 0,
  best_score numeric,
  last_score numeric,
  last_practiced_at timestamptz,
  unique (caregiver_profile_id, sign_id)
);

comment on table gloss_caregiver_mastery is
  'One row per caregiver per sign. Updated after every attempt.
  This is the table the adaptive lesson selector reads to decide
  what to teach next.';

alter table gloss_caregiver_mastery enable row level security;

create policy "Caregiver sees own mastery"
  on gloss_caregiver_mastery for select
  using (
    exists (
      select 1 from gloss_caregiver_accounts ga
      where ga.caregiver_profile_id = gloss_caregiver_mastery.caregiver_profile_id
      and ga.user_id = auth.uid()
    )
  );

create policy "Supervisors see their caregivers' mastery"
  on gloss_caregiver_mastery for select
  using (
    exists (
      select 1 from caregiver_profiles cp
      where cp.id = gloss_caregiver_mastery.caregiver_profile_id
      and cp.supervisor_id = auth.uid()
    )
  );

create policy "Admins manage mastery"
  on gloss_caregiver_mastery for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on gloss_caregiver_mastery to authenticated;
grant select, insert, update, delete on gloss_caregiver_mastery to service_role;
