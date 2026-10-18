-- ============================================================
-- 0049_gloss_learners.sql
-- Sign & Vitals (GLOSS + Parkinson's education) — Owner: Kaushalya (R26-DS-010)
--
-- One learner table, so supervisors can learn too (sign practice and
-- Parkinson's education with their own progress) WITHOUT adding them to
-- the shared caregiver_profiles table (other components list it, and it
-- needs a TILES participant).
--
--   gloss_learners: one row per learner.
--     kind 'caregiver'  -> id = caregiver_profile_id (the SAME uuid), so
--                          every existing row and caregiver id stays valid;
--     kind 'supervisor' -> own id, user_id = the supervisor's login.
--
-- The eight learning tables keep their caregiver_profile_id column (not
-- renamed); only its foreign key now points at gloss_learners(id), still
-- ON DELETE CASCADE. Deleting a caregiver still removes their learning
-- data: caregiver_profiles -> gloss_learners -> learning rows.
--
-- Shared tables: caregiver_profiles, profiles are only REFERENCED (new
-- foreign keys from gloss_learners); nothing in them changes.
-- Undo: backend_services/sign-vitals/db_undo/0049_gloss_learners_undo.sql
-- (run 0050's undo first).
-- ============================================================

begin;

create table gloss_learners (
  id                   uuid primary key default gen_random_uuid(),
  kind                 text not null check (kind in ('caregiver', 'supervisor')),
  caregiver_profile_id uuid unique references caregiver_profiles(id) on delete cascade,
  user_id              uuid unique references profiles(id) on delete cascade,
  -- Supervisors only (profiles.name when the profile was created); a
  -- caregiver's name is always read from caregiver_profiles.
  display_name         text,
  created_at           timestamptz not null default now(),
  constraint gloss_learners_kind_shape check (
    (kind = 'caregiver' and caregiver_profile_id = id and user_id is null)
    or (kind = 'supervisor' and caregiver_profile_id is null and user_id is not null and display_name is not null)
  )
);

comment on table gloss_learners is
  'Sign & Vitals learners. A caregiver learner has id = caregiver_profile_id;
  a supervisor learner has its own id and user_id = their login. The
  learning tables'' caregiver_profile_id column holds this id.';

-- Every caregiver id already used by Sign & Vitals keeps working.
insert into gloss_learners (id, kind, caregiver_profile_id)
select cp.id, 'caregiver', cp.id
from caregiver_profiles cp
where cp.id in (
  select caregiver_profile_id from gloss_caregiver_accounts
  union select caregiver_profile_id from gloss_caregiver_mastery
  union select caregiver_profile_id from gloss_learning_sessions
  union select caregiver_profile_id from gloss_attempts
  union select caregiver_profile_id from gloss_milestones
  union select caregiver_profile_id from pdedu_responses
  union select caregiver_profile_id from pdedu_caregiver_mastery
  union select caregiver_profile_id from pdedu_quiz_sessions
  union select caregiver_profile_id from pdedu_quiz_attempts
);

-- A new caregiver account gets its learner row automatically.
create or replace function public.gloss_learner_for_new_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into gloss_learners (id, kind, caregiver_profile_id)
  values (new.caregiver_profile_id, 'caregiver', new.caregiver_profile_id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger gloss_caregiver_accounts_learner
  after insert on gloss_caregiver_accounts
  for each row execute function public.gloss_learner_for_new_account();

-- "Is this learner me?" — a caregiver through gloss_caregiver_accounts, a
-- supervisor through their own learner row.
create or replace function public.gloss_is_own_learner(learner uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from gloss_caregiver_accounts ga
    where ga.caregiver_profile_id = learner and ga.user_id = auth.uid()
  ) or exists (
    select 1 from gloss_learners l
    where l.id = learner and l.kind = 'supervisor' and l.user_id = auth.uid()
  );
$$;

grant execute on function public.gloss_is_own_learner(uuid) to authenticated, service_role;

-- Foreign keys: same column, same cascade, new parent.
alter table gloss_caregiver_mastery drop constraint gloss_caregiver_mastery_caregiver_profile_id_fkey,
  add constraint gloss_caregiver_mastery_learner_fkey foreign key (caregiver_profile_id) references gloss_learners(id) on delete cascade;
alter table gloss_learning_sessions drop constraint gloss_learning_sessions_caregiver_profile_id_fkey,
  add constraint gloss_learning_sessions_learner_fkey foreign key (caregiver_profile_id) references gloss_learners(id) on delete cascade;
alter table gloss_attempts drop constraint gloss_attempts_caregiver_profile_id_fkey,
  add constraint gloss_attempts_learner_fkey foreign key (caregiver_profile_id) references gloss_learners(id) on delete cascade;
alter table gloss_milestones drop constraint gloss_milestones_caregiver_profile_id_fkey,
  add constraint gloss_milestones_learner_fkey foreign key (caregiver_profile_id) references gloss_learners(id) on delete cascade;
alter table pdedu_responses drop constraint pdedu_responses_caregiver_profile_id_fkey,
  add constraint pdedu_responses_learner_fkey foreign key (caregiver_profile_id) references gloss_learners(id) on delete cascade;
alter table pdedu_caregiver_mastery drop constraint pdedu_caregiver_mastery_caregiver_profile_id_fkey,
  add constraint pdedu_caregiver_mastery_learner_fkey foreign key (caregiver_profile_id) references gloss_learners(id) on delete cascade;
alter table pdedu_quiz_sessions drop constraint pdedu_quiz_sessions_caregiver_profile_id_fkey,
  add constraint pdedu_quiz_sessions_learner_fkey foreign key (caregiver_profile_id) references gloss_learners(id) on delete cascade;
alter table pdedu_quiz_attempts drop constraint pdedu_quiz_attempts_caregiver_profile_id_fkey,
  add constraint pdedu_quiz_attempts_learner_fkey foreign key (caregiver_profile_id) references gloss_learners(id) on delete cascade;

-- RLS on gloss_learners: own row, supervisors read all, admins manage,
-- writes from the backend (service role) only.
alter table gloss_learners enable row level security;

create policy "Learner sees own learner row"
  on gloss_learners for select
  using (public.gloss_is_own_learner(id));

create policy "Supervisors see all learners"
  on gloss_learners for select
  using (public.is_supervisor());

create policy "Admins manage learners"
  on gloss_learners for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on gloss_learners to authenticated;
grant select, insert, update, delete on gloss_learners to service_role;

-- GLOSS own-row policies: same rule, now also for supervisor learners.
drop policy "Caregiver sees own mastery" on gloss_caregiver_mastery;
create policy "Caregiver sees own mastery" on gloss_caregiver_mastery for select
  using (public.gloss_is_own_learner(caregiver_profile_id));

drop policy "Caregiver sees own sessions" on gloss_learning_sessions;
create policy "Caregiver sees own sessions" on gloss_learning_sessions for select
  using (public.gloss_is_own_learner(caregiver_profile_id));

drop policy "Caregiver sees own attempts" on gloss_attempts;
create policy "Caregiver sees own attempts" on gloss_attempts for select
  using (public.gloss_is_own_learner(caregiver_profile_id));

drop policy "Caregiver sees own milestones" on gloss_milestones;
create policy "Caregiver sees own milestones" on gloss_milestones for select
  using (public.gloss_is_own_learner(caregiver_profile_id));

commit;
