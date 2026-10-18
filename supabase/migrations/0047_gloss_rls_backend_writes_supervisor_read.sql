-- ============================================================
-- 0047_gloss_rls_backend_writes_supervisor_read.sql
-- GLOSS component — Personalised Sign Language Tutoring for Caregivers
-- Owner: Kaushalya (R26-DS-010)
--
-- 1. Only the backend writes attempts and sessions. Progress (Demonstrated,
--    levels, badges) is built from gloss_attempts, so a logged-in user must
--    not be able to insert attempts straight through the API. The frontend
--    never wrote these tables directly (it always calls the backend, which
--    uses service_role), so these caregiver INSERT policies are removed.
--
-- 2. Every supervisor (public.is_supervisor(), 0013) can READ all
--    caregivers' attempts and mastery rows, so supervisors can cover for
--    each other. Added as NEW policies; the existing "assigned supervisor"
--    policies stay. (gloss_milestones gets the same in 0046.)
--
-- Depends on: gloss_attempts (0023), gloss_learning_sessions (0022),
-- gloss_caregiver_mastery (0021), public.is_supervisor() (0013)
-- ============================================================

drop policy if exists "Caregiver creates own attempts" on gloss_attempts;
drop policy if exists "Caregiver creates own sessions" on gloss_learning_sessions;
revoke insert on gloss_attempts from authenticated;
revoke insert on gloss_learning_sessions from authenticated;

create policy "Supervisors see all caregivers' attempts"
  on gloss_attempts for select
  using (public.is_supervisor());

create policy "Supervisors see all caregivers' mastery"
  on gloss_caregiver_mastery for select
  using (public.is_supervisor());
