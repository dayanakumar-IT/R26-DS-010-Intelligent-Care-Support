-- ============================================================
-- 0031_gloss_sign_difficulty_grants.sql
-- GLOSS component — Personalised Sign Language Tutoring for Caregivers
-- Owner: Kaushalya (R26-DS-010)
--
-- gloss_sign_difficulty (0024) was created without any GRANT
-- statements, unlike its sibling tables — so even the service_role
-- key gets "permission denied for view gloss_sign_difficulty" (42501)
-- from PostgREST. Discovered while wiring up Phase 6's cold-start
-- lesson selection (lesson_selector.py), which reads this view to
-- pick a caregiver's first-ever lesson.
--
-- Depends on: gloss_sign_difficulty (0024)
-- ============================================================

grant select on gloss_sign_difficulty to authenticated;
grant select on gloss_sign_difficulty to service_role;
