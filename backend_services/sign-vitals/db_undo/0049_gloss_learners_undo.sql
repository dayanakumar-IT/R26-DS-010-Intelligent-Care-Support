-- Undo 0049_gloss_learners.sql — run AFTER 0050's undo. One transaction.
--
-- !! Supervisors' OWN learning data (sign practice and Parkinson's
-- education of supervisor learners) cannot point at caregiver_profiles, so
-- it is DELETED first (cascade from their gloss_learners rows). Caregivers'
-- data and ids are untouched. Back up first.

begin;

-- 1. Supervisor learners and their learning rows (cascade).
delete from gloss_learners where kind = 'supervisor';

-- 2. GLOSS own-row policies as after 0047.
drop policy "Caregiver sees own mastery" on gloss_caregiver_mastery;
create policy "Caregiver sees own mastery" on gloss_caregiver_mastery for select
  using (exists (select 1 from gloss_caregiver_accounts ga
                 where ga.caregiver_profile_id = gloss_caregiver_mastery.caregiver_profile_id and ga.user_id = auth.uid()));
drop policy "Caregiver sees own sessions" on gloss_learning_sessions;
create policy "Caregiver sees own sessions" on gloss_learning_sessions for select
  using (exists (select 1 from gloss_caregiver_accounts ga
                 where ga.caregiver_profile_id = gloss_learning_sessions.caregiver_profile_id and ga.user_id = auth.uid()));
drop policy "Caregiver sees own attempts" on gloss_attempts;
create policy "Caregiver sees own attempts" on gloss_attempts for select
  using (exists (select 1 from gloss_caregiver_accounts ga
                 where ga.caregiver_profile_id = gloss_attempts.caregiver_profile_id and ga.user_id = auth.uid()));
drop policy "Caregiver sees own milestones" on gloss_milestones;
create policy "Caregiver sees own milestones" on gloss_milestones for select
  using (exists (select 1 from gloss_caregiver_accounts ga
                 where ga.caregiver_profile_id = gloss_milestones.caregiver_profile_id and ga.user_id = auth.uid()));

-- 3. Foreign keys back to caregiver_profiles, with their original names.
alter table gloss_caregiver_mastery drop constraint gloss_caregiver_mastery_learner_fkey,
  add constraint gloss_caregiver_mastery_caregiver_profile_id_fkey foreign key (caregiver_profile_id) references caregiver_profiles(id) on delete cascade;
alter table gloss_learning_sessions drop constraint gloss_learning_sessions_learner_fkey,
  add constraint gloss_learning_sessions_caregiver_profile_id_fkey foreign key (caregiver_profile_id) references caregiver_profiles(id) on delete cascade;
alter table gloss_attempts drop constraint gloss_attempts_learner_fkey,
  add constraint gloss_attempts_caregiver_profile_id_fkey foreign key (caregiver_profile_id) references caregiver_profiles(id) on delete cascade;
alter table gloss_milestones drop constraint gloss_milestones_learner_fkey,
  add constraint gloss_milestones_caregiver_profile_id_fkey foreign key (caregiver_profile_id) references caregiver_profiles(id) on delete cascade;
alter table pdedu_responses drop constraint pdedu_responses_learner_fkey,
  add constraint pdedu_responses_caregiver_profile_id_fkey foreign key (caregiver_profile_id) references caregiver_profiles(id) on delete cascade;
alter table pdedu_caregiver_mastery drop constraint pdedu_caregiver_mastery_learner_fkey,
  add constraint pdedu_caregiver_mastery_caregiver_profile_id_fkey foreign key (caregiver_profile_id) references caregiver_profiles(id) on delete cascade;
alter table pdedu_quiz_sessions drop constraint pdedu_quiz_sessions_learner_fkey,
  add constraint pdedu_quiz_sessions_caregiver_profile_id_fkey foreign key (caregiver_profile_id) references caregiver_profiles(id) on delete cascade;
alter table pdedu_quiz_attempts drop constraint pdedu_quiz_attempts_learner_fkey,
  add constraint pdedu_quiz_attempts_caregiver_profile_id_fkey foreign key (caregiver_profile_id) references caregiver_profiles(id) on delete cascade;

-- 4. Trigger, table (with its policies), then the helper functions.
drop trigger gloss_caregiver_accounts_learner on gloss_caregiver_accounts;
drop table gloss_learners;
drop function public.gloss_learner_for_new_account();
drop function public.gloss_is_own_learner(uuid);

commit;
