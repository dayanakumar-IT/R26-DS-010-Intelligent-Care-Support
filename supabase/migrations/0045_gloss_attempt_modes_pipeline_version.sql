-- ============================================================
-- 0045_gloss_attempt_modes_pipeline_version.sql
-- GLOSS component — Personalised Sign Language Tutoring for Caregivers
-- Owner: Kaushalya (R26-DS-010)
--
-- 1. gloss_attempts.mode — how the attempt was made:
--      'practice' — the lesson flow (camera or the multiple-choice fallback);
--                   every attempt before this migration;
--      'recall'   — Recall challenge: the word only, signed from memory,
--                   graded like practice;
--      'free'     — Check my sign: the camera guesses the sign. No target,
--                   never counts toward streaks, Demonstrated, levels or badges.
--    target_sign_id may be empty ONLY for mode = 'free' (check below).
--
-- 2. gloss_attempts.pipeline_version — the grading pipeline that produced
--    the attempt. Only the current version counts toward Demonstrated,
--    Retained and levels; older attempts ('legacy') still count as practice
--    and stay in History, tagged "earlier version".
--    The current pipeline (final thesis recogniser, DTW grading and feedback
--    bundle, manifest sha256 ecf91068...) went live on 10 Oct 2026 01:43
--    Sri Lanka time (UTC+05:30) = 2026-10-09 20:13 UTC; attempts from then
--    on get '2026.10-ecf91068', earlier ones 'legacy'. No default: the
--    backend always states the version (sign_config.PIPELINE_VERSION).
--
-- 3. gloss_caregiver_accounts.timezone — for monthly active-day badges
--    (IANA name, default Asia/Colombo).
--
-- Depends on: gloss_attempts (0023, 0030), gloss_caregiver_accounts (0019)
-- ============================================================

alter table gloss_attempts
  add column mode text not null default 'practice'
    check (mode in ('practice', 'recall', 'free'));

-- Recall and free attempts are always camera attempts.
alter table gloss_attempts
  add constraint gloss_attempts_mode_camera_check
    check (mode = 'practice' or attempt_type = 'webcam');

alter table gloss_attempts alter column target_sign_id drop not null;
alter table gloss_attempts
  add constraint gloss_attempts_target_required_check
    check (target_sign_id is not null or mode = 'free');

alter table gloss_attempts add column pipeline_version text;
update gloss_attempts
  set pipeline_version = case
    when attempted_at >= timestamptz '2026-10-09 20:13:00+00' then '2026.10-ecf91068'
    else 'legacy'
  end;
alter table gloss_attempts alter column pipeline_version set not null;

comment on column gloss_attempts.mode is
  'practice (lesson flow) | recall (word only, from memory) | free (Check my sign: no target, never counts toward progress).';
comment on column gloss_attempts.pipeline_version is
  'Grading pipeline that produced the attempt. Only the current version (backend sign_config.PIPELINE_VERSION) counts toward Demonstrated, Retained and levels; ''legacy'' = before 2026-10-10 01:43 Asia/Colombo.';

create index gloss_attempts_caregiver_time_idx
  on gloss_attempts (caregiver_profile_id, attempted_at);

alter table gloss_caregiver_accounts
  add column timezone text not null default 'Asia/Colombo';
comment on column gloss_caregiver_accounts.timezone is
  'IANA time zone used to count active days for the monthly badge.';
