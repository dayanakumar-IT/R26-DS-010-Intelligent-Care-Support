-- ============================================================
-- 0023_gloss_attempts.sql
-- GLOSS component — Personalised Sign Language Tutoring for Caregivers
-- Owner: Kaushalya (R26-DS-010)
--
-- Table: gloss_attempts
-- One row per attempt. target vs recognized tells you directly
-- whether the sign was correct. deviating_landmarks and
-- corrective_feedback additionally persist the per-attempt XAI
-- output — confirm this is intentional (see chat note); their
-- JSON shape is not yet finalised.
--
-- Depends on: gloss_signs (0020), gloss_learning_sessions (0022),
-- caregiver_profiles (0006), gloss_caregiver_accounts (0019)
-- ============================================================

create table gloss_attempts (
  id uuid primary key default gen_random_uuid(),
  caregiver_profile_id uuid not null references caregiver_profiles(id) on delete cascade,
  session_id uuid references gloss_learning_sessions(id) on delete set null,
  target_sign_id text not null references gloss_signs(id),
  recognized_sign_id text references gloss_signs(id),
  recognition_confidence numeric,
  execution_score numeric,
  quality_tier text check (quality_tier in ('strong', 'moderate', 'weak')),
  deviating_landmarks jsonb,
  corrective_feedback jsonb,
  attempted_at timestamptz not null default now()
);

comment on column gloss_attempts.target_sign_id is
  'The sign the caregiver was asked to perform.';
comment on column gloss_attempts.recognized_sign_id is
  'The sign the model actually recognised. If this is different
  from target_sign_id, the attempt was signed incorrectly.';
comment on column gloss_attempts.deviating_landmarks is
  'Per-attempt DTW deviation output (e.g. a ranked list of
  landmarks that deviated most from the reference). Shape not
  yet finalised — confirm before backend code depends on it.';
comment on column gloss_attempts.corrective_feedback is
  'Per-attempt plain-language feedback generated from
  deviating_landmarks. Shape not yet finalised — confirm before
  backend code depends on it.';

alter table gloss_attempts enable row level security;

create policy "Caregiver sees own attempts"
  on gloss_attempts for select
  using (
    exists (
      select 1 from gloss_caregiver_accounts ga
      where ga.caregiver_profile_id = gloss_attempts.caregiver_profile_id
      and ga.user_id = auth.uid()
    )
  );

create policy "Caregiver creates own attempts"
  on gloss_attempts for insert
  with check (
    exists (
      select 1 from gloss_caregiver_accounts ga
      where ga.caregiver_profile_id = gloss_attempts.caregiver_profile_id
      and ga.user_id = auth.uid()
    )
  );

create policy "Admins manage attempts"
  on gloss_attempts for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert on gloss_attempts to authenticated;
grant select, insert, update, delete on gloss_attempts to service_role;
