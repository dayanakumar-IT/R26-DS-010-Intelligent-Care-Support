-- ============================================================
-- 0046_gloss_milestones.sql
-- GLOSS component — Personalised Sign Language Tutoring for Caregivers
-- Owner: Kaushalya (R26-DS-010)
--
-- Table: gloss_milestones
-- Everything a caregiver has earned, each backed by the real attempts that
-- earned it (evidence = gloss_attempts ids). Nothing is ever seeded: rows
-- are written only by the backend, either together with the attempt that
-- earns them (gloss_record_attempt below, one transaction) or by the
-- re-runnable backfill (scripts/backfill_milestones.py), which recomputes
-- from existing attempts. Milestones are permanent: never revoked.
--
--   type          key                      earned by
--   demonstrated  <sign_id>                3 strong camera attempts in a row (current pipeline)
--   retained      <sign_id>                Demonstrated, then a strong recall attempt 7+ days later
--   level         starter|learner|communicator|care_signer|master
--   category      <category slug>          every countable sign in the category Demonstrated
--   practice      signs_5|signs_10|signs_25|signs_40|first_recall
--                                          practice badges: all history, incl. earlier versions
--   monthly       <YYYY-MM>:<5|10|15>      active days in the month (caregiver's time zone)
--
-- Row-level security: a caregiver reads only their own rows; every
-- supervisor (profiles.role = 'supervisor', public.is_supervisor() from
-- 0013) reads all caregivers' rows; admins read all; only the backend
-- (service_role) writes.
--
-- Depends on: caregiver_profiles (0006), gloss_caregiver_accounts (0019),
-- gloss_attempts (0023, 0030, 0045), gloss_caregiver_mastery (0021, 0030),
-- public.is_supervisor() (0013), public.is_admin() (0002)
-- ============================================================

create table gloss_milestones (
  id uuid primary key default gen_random_uuid(),
  caregiver_profile_id uuid not null references caregiver_profiles(id) on delete cascade,
  type text not null
    check (type in ('demonstrated', 'retained', 'level', 'category', 'practice', 'monthly')),
  key text not null,
  achieved_at timestamptz not null,
  evidence uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (caregiver_profile_id, type, key)
);

comment on table gloss_milestones is
  'Permanent GLOSS milestones (Demonstrated, Retained, levels, category / practice / monthly badges), each with the gloss_attempts ids that earned it. Written only by the backend.';
comment on column gloss_milestones.evidence is
  'gloss_attempts.id values of the attempts that earned this milestone.';

create index gloss_milestones_caregiver_idx on gloss_milestones (caregiver_profile_id, achieved_at);

alter table gloss_milestones enable row level security;

create policy "Caregiver sees own milestones"
  on gloss_milestones for select
  using (
    exists (
      select 1 from gloss_caregiver_accounts ga
      where ga.caregiver_profile_id = gloss_milestones.caregiver_profile_id
      and ga.user_id = auth.uid()
    )
  );

create policy "Supervisors see all caregivers' milestones"
  on gloss_milestones for select
  using (public.is_supervisor());

create policy "Admins see all milestones"
  on gloss_milestones for select
  using (public.is_admin());

grant select on gloss_milestones to authenticated;
grant select, insert, update, delete on gloss_milestones to service_role;

-- ------------------------------------------------------------
-- gloss_record_attempt: the attempt, its mastery row and any milestones it
-- earns, in ONE transaction. Called by the backend (service_role) only.
--   p_attempt    gloss_attempts columns (no id / attempted_at)
--   p_mastery    gloss_caregiver_mastery row to upsert, or null
--   p_milestones [{caregiver_profile_id, type, key, achieved_at|null,
--                  evidence: [attempt id | "NEW"]}] — "NEW" = this attempt;
--                  achieved_at null = this attempt's time
-- Returns {attempt_id, attempted_at, new_milestones: [{type, key, achieved_at}]}
-- (milestones that already existed are skipped and not returned).
-- ------------------------------------------------------------
create function public.gloss_record_attempt(p_attempt jsonb, p_mastery jsonb, p_milestones jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_at timestamptz;
  v_new jsonb;
begin
  insert into gloss_attempts (
    caregiver_profile_id, session_id, target_sign_id, recognized_sign_id,
    recognition_confidence, execution_score, quality_tier, deviating_landmarks,
    corrective_feedback, attempt_type, mode, pipeline_version)
  select caregiver_profile_id, session_id, target_sign_id, recognized_sign_id,
    recognition_confidence, execution_score, quality_tier, deviating_landmarks,
    corrective_feedback, attempt_type, coalesce(mode, 'practice'), pipeline_version
  from jsonb_populate_record(null::gloss_attempts, p_attempt)
  returning id, attempted_at into v_id, v_at;

  if p_mastery is not null then
    insert into gloss_caregiver_mastery (
      caregiver_profile_id, sign_id, attempts, consecutive_strong_streak, mastery_status,
      recognition_mismatch_count, best_score, last_score, last_practiced_at,
      has_verified_strong_execution)
    select caregiver_profile_id, sign_id, attempts, consecutive_strong_streak, mastery_status,
      recognition_mismatch_count, best_score, last_score, coalesce(last_practiced_at, v_at),
      has_verified_strong_execution
    from jsonb_populate_record(null::gloss_caregiver_mastery, p_mastery)
    on conflict (caregiver_profile_id, sign_id) do update set
      attempts = excluded.attempts,
      consecutive_strong_streak = excluded.consecutive_strong_streak,
      mastery_status = excluded.mastery_status,
      recognition_mismatch_count = excluded.recognition_mismatch_count,
      best_score = excluded.best_score,
      last_score = excluded.last_score,
      last_practiced_at = excluded.last_practiced_at,
      has_verified_strong_execution = excluded.has_verified_strong_execution;
  end if;

  with ins as (
    insert into gloss_milestones (caregiver_profile_id, type, key, achieved_at, evidence)
    select (m ->> 'caregiver_profile_id')::uuid, m ->> 'type', m ->> 'key',
      coalesce((m ->> 'achieved_at')::timestamptz, v_at),
      array(select case when e = 'NEW' then v_id else e::uuid end
            from jsonb_array_elements_text(coalesce(m -> 'evidence', '[]'::jsonb)) as e)
    from jsonb_array_elements(coalesce(p_milestones, '[]'::jsonb)) as m
    on conflict (caregiver_profile_id, type, key) do nothing
    returning type, key, achieved_at
  )
  select coalesce(jsonb_agg(jsonb_build_object('type', type, 'key', key, 'achieved_at', achieved_at)), '[]'::jsonb)
    into v_new from ins;

  return jsonb_build_object('attempt_id', v_id, 'attempted_at', v_at, 'new_milestones', v_new);
end;
$$;

revoke all on function public.gloss_record_attempt(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.gloss_record_attempt(jsonb, jsonb, jsonb) to service_role;
