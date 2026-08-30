-- ============================================================
-- 0036_pdedu_schema.sql
-- Parkinson's-Disease EDUcation (pdedu_) — caregiver education feature.
-- NOT a diagnostic tool, NOT an AI/ML model — multiple-choice
-- education with adaptive question selection and mastery tracking.
-- Kept completely separate from gloss_ tables.
--
-- Depends on: caregiver_profiles (0006), gloss_caregiver_accounts (0019)
-- ============================================================

-- ------------------------------------------------------------
-- pdedu_symptoms — reference table, the symptom categories.
-- IMPORTANT: no demo_asset_type/demo_asset_ref yet — video/media
-- architecture is intentionally deferred to a later phase.
-- ------------------------------------------------------------
create table pdedu_symptoms (
  id text primary key,
  display_name text not null,
  definition text not null,
  is_active boolean not null default true
);

comment on table pdedu_symptoms is
  'Reference table of Parkinson''s symptom categories used by the
  caregiver education quiz. Text/definition only in this phase — no
  video or media fields yet.';

-- ------------------------------------------------------------
-- pdedu_questions — reference table, quiz questions per symptom.
-- ------------------------------------------------------------
create table pdedu_questions (
  id uuid primary key default gen_random_uuid(),
  symptom_id text not null references pdedu_symptoms(id),
  question_type text not null check (question_type in ('direct', 'scenario', 'comparison')),
  prompt text not null,
  choices jsonb not null,
  extra_fact text not null,
  is_active boolean not null default true
);

comment on column pdedu_questions.symptom_id is
  'The symptom this question actually tests — i.e. the correct
  answer. Not necessarily the only symptom mentioned in the prompt.';
comment on column pdedu_questions.choices is
  'JSON array of {"symptom_id": "...", "label": "..."} options shown
  to the caregiver, e.g. [{"symptom_id":"tremor","label":"..."}, ...].';

-- ------------------------------------------------------------
-- pdedu_responses — one row per caregiver answer.
-- ------------------------------------------------------------
create table pdedu_responses (
  id uuid primary key default gen_random_uuid(),
  caregiver_profile_id uuid not null references caregiver_profiles(id) on delete cascade,
  question_id uuid not null references pdedu_questions(id),
  selected_symptom_id text not null references pdedu_symptoms(id),
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);

comment on table pdedu_responses is
  'One row per caregiver quiz answer. The correct symptom for a
  response is NOT stored directly here — derive it by joining
  question_id -> pdedu_questions.symptom_id (see
  pdedu_confusion_pairs below).';

-- ------------------------------------------------------------
-- pdedu_caregiver_mastery — one row per caregiver+symptom.
-- ------------------------------------------------------------
create table pdedu_caregiver_mastery (
  id uuid primary key default gen_random_uuid(),
  caregiver_profile_id uuid not null references caregiver_profiles(id) on delete cascade,
  symptom_id text not null references pdedu_symptoms(id),
  mastery_score numeric not null default 50,
  correct_count int not null default 0,
  incorrect_count int not null default 0,
  last_answered_at timestamptz,
  unique (caregiver_profile_id, symptom_id)
);

comment on table pdedu_caregiver_mastery is
  'One row per caregiver per symptom. mastery_score starts at 50 for
  an unseen symptom, +10 per correct answer, -8 per incorrect answer,
  clamped to [0, 100]. Read by pdedu_lesson_selector.py to adaptively
  choose the next question.';

-- ------------------------------------------------------------
-- pdedu_confusion_pairs — view: repeated wrong-answer pairs per
-- caregiver, for the lesson selector's "targeted comparison
-- question" step. pdedu_responses doesn't store the correct symptom
-- directly, so it's derived via question_id -> pdedu_questions.
-- ------------------------------------------------------------
create or replace view pdedu_confusion_pairs as
select
  r.caregiver_profile_id,
  q.symptom_id as correct_symptom_id,
  r.selected_symptom_id,
  count(*) as confusion_count
from pdedu_responses r
join pdedu_questions q on q.id = r.question_id
where r.is_correct = false
group by r.caregiver_profile_id, q.symptom_id, r.selected_symptom_id;

comment on view pdedu_confusion_pairs is
  'Per-caregiver count of how often a given correct symptom was
  mistaken for a given selected (wrong) symptom. Used by
  pdedu_lesson_selector.py to prioritise a comparison question when a
  confusion_count >= 2 exists and a relevant comparison question is
  active.';

-- ============================================================
-- RLS
-- ============================================================
alter table pdedu_symptoms enable row level security;
alter table pdedu_questions enable row level security;
alter table pdedu_responses enable row level security;
alter table pdedu_caregiver_mastery enable row level security;

-- Reference tables: authenticated read-only, admins manage.
create policy "Authenticated users read symptoms"
  on pdedu_symptoms for select
  using (auth.role() = 'authenticated');

create policy "Admins manage symptoms"
  on pdedu_symptoms for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Authenticated users read questions"
  on pdedu_questions for select
  using (auth.role() = 'authenticated');

create policy "Admins manage questions"
  on pdedu_questions for all
  using (public.is_admin())
  with check (public.is_admin());

-- Caregiver-specific tables: caregiver sees/creates only their own
-- rows (via the existing gloss_caregiver_accounts link — no new
-- auth mechanism), admins manage everything.
create policy "Caregiver sees own pdedu responses"
  on pdedu_responses for select
  using (
    exists (
      select 1 from gloss_caregiver_accounts ga
      where ga.caregiver_profile_id = pdedu_responses.caregiver_profile_id
      and ga.user_id = auth.uid()
    )
  );

create policy "Caregiver creates own pdedu responses"
  on pdedu_responses for insert
  with check (
    exists (
      select 1 from gloss_caregiver_accounts ga
      where ga.caregiver_profile_id = pdedu_responses.caregiver_profile_id
      and ga.user_id = auth.uid()
    )
  );

create policy "Admins manage pdedu responses"
  on pdedu_responses for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Caregiver sees own pdedu mastery"
  on pdedu_caregiver_mastery for select
  using (
    exists (
      select 1 from gloss_caregiver_accounts ga
      where ga.caregiver_profile_id = pdedu_caregiver_mastery.caregiver_profile_id
      and ga.user_id = auth.uid()
    )
  );

create policy "Admins manage pdedu mastery"
  on pdedu_caregiver_mastery for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- GRANTS — explicit, since auto-exposure is disabled (same
-- requirement that caught out gloss_sign_difficulty in 0031).
-- ============================================================
grant select on pdedu_symptoms to authenticated;
grant select, insert, update, delete on pdedu_symptoms to service_role;

grant select on pdedu_questions to authenticated;
grant select, insert, update, delete on pdedu_questions to service_role;

grant select, insert on pdedu_responses to authenticated;
grant select, insert, update, delete on pdedu_responses to service_role;

grant select on pdedu_caregiver_mastery to authenticated;
grant select, insert, update, delete on pdedu_caregiver_mastery to service_role;

grant select on pdedu_confusion_pairs to authenticated;
grant select on pdedu_confusion_pairs to service_role;
