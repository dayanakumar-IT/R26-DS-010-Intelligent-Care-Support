-- ============================================================
-- 0048_gloss_sign_difficulty_security_invoker.sql
-- GLOSS component — Personalised Sign Language Tutoring for Caregivers
-- Owner: Kaushalya (R26-DS-010)
--
-- gloss_sign_difficulty (0024) has per-sign columns only, but it was
-- created as a plain view, which runs with its OWNER's rights and so
-- ignores the row-level security on gloss_attempts (Supabase shows it as
-- UNRESTRICTED). Any logged-in caregiver could read attempt and error
-- counts summed over ALL caregivers. Checked on the live project
-- (2026-10-18): the GLOSS TEST caregiver, with no attempts of its own and
-- 0 rows from gloss_attempts directly, saw 97 attempts across 59 signs.
-- With two or three caregivers, subtracting your own counts reveals the
-- other caregivers' attempts and mistakes per sign — per-caregiver data.
--
-- Fix: the view now runs with the CALLER's rights (security_invoker), so
-- the gloss_attempts policies apply: a caregiver sees counts from their
-- own attempts only, every supervisor sees all (0047), admins all, the
-- backend (service_role) all. Columns and definition are unchanged.
-- Not-logged-in callers stay blocked. No app code reads this view.
--
-- Depends on: gloss_sign_difficulty (0024, 0031), gloss_attempts
-- policies (0023, 0047)
-- ============================================================

alter view gloss_sign_difficulty set (security_invoker = true);

revoke all on gloss_sign_difficulty from anon, public;
grant select on gloss_sign_difficulty to authenticated, service_role;

comment on view gloss_sign_difficulty is
  'Per-sign attempt and error counts (higher error_rate_percent = harder sign). Runs with the caller''s rights (security_invoker, 0048): caregivers see their own attempts only, supervisors and the backend see all caregivers.';
