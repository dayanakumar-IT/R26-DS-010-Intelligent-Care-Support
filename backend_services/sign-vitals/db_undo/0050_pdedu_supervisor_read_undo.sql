-- Undo 0050_pdedu_supervisor_read.sql — restores the pdedu policies exactly
-- as they were after 0036 / 0042. Run BEFORE undoing 0049. One transaction.
-- Data is not touched.

begin;

drop policy "Supervisors see all pdedu responses" on pdedu_responses;
drop policy "Supervisors see all pdedu mastery" on pdedu_caregiver_mastery;
drop policy "Supervisors see all pdedu quiz sessions" on pdedu_quiz_sessions;
drop policy "Supervisors see all pdedu quiz attempts" on pdedu_quiz_attempts;

drop policy "Caregiver sees own pdedu responses" on pdedu_responses;
create policy "Caregiver sees own pdedu responses" on pdedu_responses for select
  using (exists (select 1 from gloss_caregiver_accounts ga
                 where ga.caregiver_profile_id = pdedu_responses.caregiver_profile_id and ga.user_id = auth.uid()));
drop policy "Caregiver creates own pdedu responses" on pdedu_responses;
create policy "Caregiver creates own pdedu responses" on pdedu_responses for insert
  with check (exists (select 1 from gloss_caregiver_accounts ga
                      where ga.caregiver_profile_id = pdedu_responses.caregiver_profile_id and ga.user_id = auth.uid()));

drop policy "Caregiver sees own pdedu mastery" on pdedu_caregiver_mastery;
create policy "Caregiver sees own pdedu mastery" on pdedu_caregiver_mastery for select
  using (exists (select 1 from gloss_caregiver_accounts ga
                 where ga.caregiver_profile_id = pdedu_caregiver_mastery.caregiver_profile_id and ga.user_id = auth.uid()));

drop policy "Caregiver sees own pdedu quiz sessions" on pdedu_quiz_sessions;
create policy "Caregiver sees own pdedu quiz sessions" on pdedu_quiz_sessions for select
  using (exists (select 1 from gloss_caregiver_accounts ga
                 where ga.caregiver_profile_id = pdedu_quiz_sessions.caregiver_profile_id and ga.user_id = auth.uid()));
drop policy "Caregiver creates own pdedu quiz sessions" on pdedu_quiz_sessions;
create policy "Caregiver creates own pdedu quiz sessions" on pdedu_quiz_sessions for insert
  with check (exists (select 1 from gloss_caregiver_accounts ga
                      where ga.caregiver_profile_id = pdedu_quiz_sessions.caregiver_profile_id and ga.user_id = auth.uid()));
drop policy "Caregiver updates own pdedu quiz sessions" on pdedu_quiz_sessions;
create policy "Caregiver updates own pdedu quiz sessions" on pdedu_quiz_sessions for update
  using (exists (select 1 from gloss_caregiver_accounts ga
                 where ga.caregiver_profile_id = pdedu_quiz_sessions.caregiver_profile_id and ga.user_id = auth.uid()));

drop policy "Caregiver sees own pdedu quiz attempts" on pdedu_quiz_attempts;
create policy "Caregiver sees own pdedu quiz attempts" on pdedu_quiz_attempts for select
  using (exists (select 1 from gloss_caregiver_accounts ga
                 where ga.caregiver_profile_id = pdedu_quiz_attempts.caregiver_profile_id and ga.user_id = auth.uid()));
drop policy "Caregiver creates own pdedu quiz attempts" on pdedu_quiz_attempts;
create policy "Caregiver creates own pdedu quiz attempts" on pdedu_quiz_attempts for insert
  with check (exists (select 1 from gloss_caregiver_accounts ga
                      where ga.caregiver_profile_id = pdedu_quiz_attempts.caregiver_profile_id and ga.user_id = auth.uid()));

commit;
