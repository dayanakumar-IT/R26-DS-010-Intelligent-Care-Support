-- ============================================================
-- 0030_gloss_mastery_engine_columns.sql
-- GLOSS component — Personalised Sign Language Tutoring for Caregivers
-- Owner: Kaushalya (R26-DS-010)
--
-- Phase 5 (mastery engine) needs two new columns:
--
--   gloss_attempts.attempt_type
--     Distinguishes "webcam" attempts (go through TCN recognition +
--     DTW execution evaluation, produce a quality_tier and
--     execution_score) from "multiple_choice" attempts (a fallback
--     when the camera isn't available — just correct/incorrect, no
--     video, no execution_score). Both count toward attempts/streak.
--
--   gloss_caregiver_mastery.has_verified_strong_execution
--     Sticky flag: true once a caregiver has ever landed a webcam
--     attempt at "strong" tier for that sign. "mastered" status
--     requires this flag AND a >=5 streak — multiple_choice attempts
--     alone can build up learning/improving but can never alone reach
--     mastered, since they never set this flag.
--
-- Depends on: gloss_attempts (0023), gloss_caregiver_mastery (0021)
-- ============================================================

alter table gloss_attempts
  add column attempt_type text not null default 'webcam'
    check (attempt_type in ('webcam', 'multiple_choice'));

alter table gloss_caregiver_mastery
  add column has_verified_strong_execution boolean not null default false;
