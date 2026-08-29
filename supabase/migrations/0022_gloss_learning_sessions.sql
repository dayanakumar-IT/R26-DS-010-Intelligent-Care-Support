-- ============================================================
-- 0022_gloss_learning_sessions.sql
-- GLOSS component — Personalised Sign Language Tutoring for Caregivers
-- Owner: Kaushalya (R26-DS-010)
--
-- Table: gloss_learning_sessions
-- Groups attempts made in one sitting, so progress can be shown
-- "per session" as well as overall.
--
-- Depends on: caregiver_profiles (0006), gloss_caregiver_accounts (0019)
-- ============================================================

create table gloss_learning_sessions (
  id uuid primary key default gen_random_uuid(),
  caregiver_profile_id uuid not null references caregiver_profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

comment on table gloss_learning_sessions is
  'One row per practice sitting. gloss_attempts made during that
  sitting reference it via session_id.';

alter table gloss_learning_sessions enable row level security;

create policy "Caregiver sees own sessions"
  on gloss_learning_sessions for select
  using (
    exists (
      select 1 from gloss_caregiver_accounts ga
      where ga.caregiver_profile_id = gloss_learning_sessions.caregiver_profile_id
      and ga.user_id = auth.uid()
    )
  );

create policy "Caregiver creates own sessions"
  on gloss_learning_sessions for insert
  with check (
    exists (
      select 1 from gloss_caregiver_accounts ga
      where ga.caregiver_profile_id = gloss_learning_sessions.caregiver_profile_id
      and ga.user_id = auth.uid()
    )
  );

create policy "Admins manage sessions"
  on gloss_learning_sessions for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert on gloss_learning_sessions to authenticated;
grant select, insert, update, delete on gloss_learning_sessions to service_role;
