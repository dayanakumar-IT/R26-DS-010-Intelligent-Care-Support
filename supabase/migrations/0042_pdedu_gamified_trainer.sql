-- ============================================================
-- 0042_pdedu_gamified_trainer.sql
-- Parkinson's-Disease EDUcation (pdedu_) — gamified caregiver
-- Symptom Trainer layer.
--
-- This is a caregiver EDUCATION feature: symptom-recognition training
-- through short educational cards, text MCQs and video-based MCQs,
-- with XP / streak / per-symptom progress. It is NOT a diagnostic
-- tool, NOT an AI/ML model, and it does NOT diagnose Parkinson's
-- disease.
--
-- Builds ON TOP of the existing pdedu_ tables (0036/0037) — it
-- reuses pdedu_symptoms, pdedu_questions and pdedu_caregiver_mastery
-- rather than duplicating them. The pre-existing infinite adaptive
-- quiz (pdedu_responses, GET /pdedu/next-question, POST
-- /pdedu/responses) is left completely intact.
--
-- Kept entirely separate from GLOSS's gloss_ tables/pipeline.
--
-- Depends on: caregiver_profiles (0006), gloss_caregiver_accounts
-- (0019), pdedu_symptoms / pdedu_questions / pdedu_caregiver_mastery
-- (0036)
-- ============================================================

-- ------------------------------------------------------------
-- Extend pdedu_symptoms with the education-card fields the trainer
-- surfaces (short definition already exists as `definition`).
-- ------------------------------------------------------------
alter table pdedu_symptoms
  add column if not exists learning_tip  text,
  add column if not exists memory_trick  text,
  add column if not exists display_order integer;

comment on column pdedu_symptoms.learning_tip is
  'Short caregiver-friendly "what to look for" tip shown on the
  symptom education card and in answer feedback.';
comment on column pdedu_symptoms.memory_trick is
  'Optional one-line mnemonic (e.g. "Brady = slow movement").';

-- ------------------------------------------------------------
-- Extend pdedu_questions so one bank can hold both text MCQs and
-- video MCQs. The correct answer stays modelled the existing way:
-- pdedu_questions.symptom_id IS the correct symptom; `choices` is the
-- JSON array of {symptom_id,label} options. `question_type` and its
-- CHECK constraint are untouched — `format` is the new orthogonal
-- text-vs-video flag.
-- ------------------------------------------------------------
alter table pdedu_questions
  add column if not exists format text not null default 'text'
    check (format in ('text', 'video')),
  add column if not exists tip text,
  add column if not exists difficulty text;

comment on column pdedu_questions.format is
  'text  = plain educational MCQ.
   video = "Which movement pattern is shown in this clip?" — the clip
   is the demo video for this row''s symptom_id, fetched via
   GET /pdedu/quiz/questions/{id}/demo-video (which never returns the
   symptom_id, so the answer is not leaked).';
comment on column pdedu_questions.tip is
  'Optional short practical tip shown with answer feedback. Distinct
  from extra_fact, which is the explanation of why the answer is
  correct.';

-- ------------------------------------------------------------
-- Extend pdedu_caregiver_mastery with a best-streak counter so the
-- per-symptom progress view can show it. Existing columns
-- (mastery_score, correct_count, incorrect_count, last_answered_at)
-- are unchanged and the existing pdedu_mastery_engine keeps working.
-- ------------------------------------------------------------
alter table pdedu_caregiver_mastery
  add column if not exists best_streak integer not null default 0;

-- ------------------------------------------------------------
-- pdedu_symptom_demo_videos — one row per symptom that has an
-- educational movement-pattern video. The MP4/WebM binary lives in
-- Cloudflare R2 under the dedicated prefix
-- parkinsons/symptom-references/{symptom_id}.mp4 — never in Postgres.
-- This table holds metadata only. Rows are added progressively by
-- scripts/upload_parkinsons_video.py as clips are validated.
--
-- If the bucket has no public URL, video_url stays null / "pending:"
-- and is_active=false; playback still works via a backend-generated
-- short-lived presigned GET URL.
-- ------------------------------------------------------------
create table pdedu_symptom_demo_videos (
  symptom_id       text primary key references pdedu_symptoms(id) on delete cascade,
  video_object_key text not null,
  video_url        text,
  duration_seconds integer,
  is_active        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table pdedu_symptom_demo_videos is
  'Metadata for educational Parkinson''s movement-pattern videos, one
  row per symptom. The video file lives in Cloudflare R2 (object key
  parkinsons/symptom-references/{symptom_id}.mp4), NOT here. Education
  only — the clip demonstrates a movement pattern, it is not a
  diagnostic recording.';
comment on column pdedu_symptom_demo_videos.video_object_key is
  'R2 object key, e.g. parkinsons/symptom-references/bradykinesia.mp4';

-- ------------------------------------------------------------
-- pdedu_quiz_sessions — one row per caregiver Symptom Trainer quiz
-- (in-progress or completed).
-- ------------------------------------------------------------
create table pdedu_quiz_sessions (
  id                   uuid primary key default gen_random_uuid(),
  caregiver_profile_id uuid not null references caregiver_profiles(id) on delete cascade,
  started_at           timestamptz not null default now(),
  completed_at         timestamptz,
  total_questions      integer not null default 0,
  correct_answers      integer not null default 0,
  xp_earned            integer not null default 0,
  best_streak          integer not null default 0,
  created_at           timestamptz not null default now()
);

create index pdedu_quiz_sessions_caregiver_idx
  on pdedu_quiz_sessions (caregiver_profile_id, started_at desc);

comment on table pdedu_quiz_sessions is
  'One caregiver symptom-recognition training quiz. Educational score
  keeping only — "Quiz Score" / "Recognition Accuracy in Training",
  never diagnostic accuracy.';

-- ------------------------------------------------------------
-- pdedu_quiz_attempts — one row per answered question within a
-- session. Kept separate from pdedu_responses (which powers the older
-- adaptive quiz + pdedu_confusion_pairs); the answer endpoint writes
-- to both so nothing regresses.
-- ------------------------------------------------------------
create table pdedu_quiz_attempts (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references pdedu_quiz_sessions(id) on delete cascade,
  caregiver_profile_id uuid not null references caregiver_profiles(id) on delete cascade,
  question_id          uuid not null references pdedu_questions(id),
  symptom_id           text references pdedu_symptoms(id),
  selected_symptom_id  text not null,
  correct_symptom_id   text not null,
  is_correct           boolean not null,
  xp_awarded           integer not null default 0,
  answered_at          timestamptz not null default now()
);

create index pdedu_quiz_attempts_session_idx
  on pdedu_quiz_attempts (session_id, answered_at);
create index pdedu_quiz_attempts_caregiver_idx
  on pdedu_quiz_attempts (caregiver_profile_id, answered_at desc);

comment on table pdedu_quiz_attempts is
  'One answered question in a Symptom Trainer session. symptom_id is
  the symptom the question tests (the correct answer); it is stored
  here for per-symptom progress aggregation.';

-- ============================================================
-- RLS — mirrors the 0036 pdedu_ pattern exactly.
--   reference/education data  -> authenticated read, admins manage
--   caregiver-owned rows      -> caregiver sees/creates only their
--                                own (via gloss_caregiver_accounts),
--                                admins manage everything
-- ============================================================
alter table pdedu_symptom_demo_videos enable row level security;
alter table pdedu_quiz_sessions        enable row level security;
alter table pdedu_quiz_attempts        enable row level security;

-- pdedu_symptom_demo_videos — education reference.
create policy "Authenticated users read active demo videos"
  on pdedu_symptom_demo_videos for select
  using (auth.role() = 'authenticated' and is_active = true);

create policy "Admins manage demo videos"
  on pdedu_symptom_demo_videos for all
  using (public.is_admin())
  with check (public.is_admin());

-- pdedu_quiz_sessions — caregiver-owned.
create policy "Caregiver sees own pdedu quiz sessions"
  on pdedu_quiz_sessions for select
  using (
    exists (
      select 1 from gloss_caregiver_accounts ga
      where ga.caregiver_profile_id = pdedu_quiz_sessions.caregiver_profile_id
      and ga.user_id = auth.uid()
    )
  );

create policy "Caregiver creates own pdedu quiz sessions"
  on pdedu_quiz_sessions for insert
  with check (
    exists (
      select 1 from gloss_caregiver_accounts ga
      where ga.caregiver_profile_id = pdedu_quiz_sessions.caregiver_profile_id
      and ga.user_id = auth.uid()
    )
  );

create policy "Caregiver updates own pdedu quiz sessions"
  on pdedu_quiz_sessions for update
  using (
    exists (
      select 1 from gloss_caregiver_accounts ga
      where ga.caregiver_profile_id = pdedu_quiz_sessions.caregiver_profile_id
      and ga.user_id = auth.uid()
    )
  );

create policy "Admins manage pdedu quiz sessions"
  on pdedu_quiz_sessions for all
  using (public.is_admin())
  with check (public.is_admin());

-- pdedu_quiz_attempts — caregiver-owned.
create policy "Caregiver sees own pdedu quiz attempts"
  on pdedu_quiz_attempts for select
  using (
    exists (
      select 1 from gloss_caregiver_accounts ga
      where ga.caregiver_profile_id = pdedu_quiz_attempts.caregiver_profile_id
      and ga.user_id = auth.uid()
    )
  );

create policy "Caregiver creates own pdedu quiz attempts"
  on pdedu_quiz_attempts for insert
  with check (
    exists (
      select 1 from gloss_caregiver_accounts ga
      where ga.caregiver_profile_id = pdedu_quiz_attempts.caregiver_profile_id
      and ga.user_id = auth.uid()
    )
  );

create policy "Admins manage pdedu quiz attempts"
  on pdedu_quiz_attempts for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- GRANTS — explicit, since auto-exposure is disabled (same
-- requirement noted in 0031 / 0036).
-- ============================================================
grant select on pdedu_symptom_demo_videos to authenticated;
grant select, insert, update, delete on pdedu_symptom_demo_videos to service_role;

grant select, insert, update on pdedu_quiz_sessions to authenticated;
grant select, insert, update, delete on pdedu_quiz_sessions to service_role;

grant select, insert on pdedu_quiz_attempts to authenticated;
grant select, insert, update, delete on pdedu_quiz_attempts to service_role;
