-- ============================================================
-- 0050_pdedu_supervisor_read.sql
-- Sign & Vitals (Parkinson's education) — Owner: Kaushalya (R26-DS-010)
--
-- 1. Every supervisor can READ all caregivers' Parkinson's education
--    rows (as for GLOSS since 0047). Before this, only the caregiver and
--    admins could.
-- 2. The caregiver's own-row rules also accept a supervisor learner
--    (public.gloss_is_own_learner, 0049), so supervisors can use the
--    Parkinson's trainer with their own progress. Caregivers' access is
--    unchanged.
--
-- Depends on: 0036, 0042 (pdedu tables), 0049 (gloss_is_own_learner),
--   public.is_supervisor() (0013). No shared table changes.
-- Undo: backend_services/sign-vitals/db_undo/0050_pdedu_supervisor_read_undo.sql
-- ============================================================

begin;

create policy "Supervisors see all pdedu responses" on pdedu_responses for select
  using (public.is_supervisor());
create policy "Supervisors see all pdedu mastery" on pdedu_caregiver_mastery for select
  using (public.is_supervisor());
create policy "Supervisors see all pdedu quiz sessions" on pdedu_quiz_sessions for select
  using (public.is_supervisor());
create policy "Supervisors see all pdedu quiz attempts" on pdedu_quiz_attempts for select
  using (public.is_supervisor());

drop policy "Caregiver sees own pdedu responses" on pdedu_responses;
create policy "Caregiver sees own pdedu responses" on pdedu_responses for select
  using (public.gloss_is_own_learner(caregiver_profile_id));
drop policy "Caregiver creates own pdedu responses" on pdedu_responses;
create policy "Caregiver creates own pdedu responses" on pdedu_responses for insert
  with check (public.gloss_is_own_learner(caregiver_profile_id));

drop policy "Caregiver sees own pdedu mastery" on pdedu_caregiver_mastery;
create policy "Caregiver sees own pdedu mastery" on pdedu_caregiver_mastery for select
  using (public.gloss_is_own_learner(caregiver_profile_id));

drop policy "Caregiver sees own pdedu quiz sessions" on pdedu_quiz_sessions;
create policy "Caregiver sees own pdedu quiz sessions" on pdedu_quiz_sessions for select
  using (public.gloss_is_own_learner(caregiver_profile_id));
drop policy "Caregiver creates own pdedu quiz sessions" on pdedu_quiz_sessions;
create policy "Caregiver creates own pdedu quiz sessions" on pdedu_quiz_sessions for insert
  with check (public.gloss_is_own_learner(caregiver_profile_id));
drop policy "Caregiver updates own pdedu quiz sessions" on pdedu_quiz_sessions;
create policy "Caregiver updates own pdedu quiz sessions" on pdedu_quiz_sessions for update
  using (public.gloss_is_own_learner(caregiver_profile_id));

drop policy "Caregiver sees own pdedu quiz attempts" on pdedu_quiz_attempts;
create policy "Caregiver sees own pdedu quiz attempts" on pdedu_quiz_attempts for select
  using (public.gloss_is_own_learner(caregiver_profile_id));
drop policy "Caregiver creates own pdedu quiz attempts" on pdedu_quiz_attempts;
create policy "Caregiver creates own pdedu quiz attempts" on pdedu_quiz_attempts for insert
  with check (public.gloss_is_own_learner(caregiver_profile_id));

commit;
