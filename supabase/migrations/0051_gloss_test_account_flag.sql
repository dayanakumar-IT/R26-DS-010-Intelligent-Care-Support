-- ============================================================
-- 0051_gloss_test_account_flag.sql
-- Sign & Vitals (GLOSS) — Owner: Kaushalya (R26-DS-010)
--
-- Marks test logins (e.g. the GLOSS TEST caregiver) so the supervisors'
-- Team learning list shows only real caregivers. The account itself keeps
-- working for testing. A flag on our own table — never name matching.
--
-- No shared table changes. One transaction.
-- Undo: backend_services/sign-vitals/db_undo/0051_gloss_test_account_flag_undo.sql
-- The flag is set for the existing test login by
--   backend_services/sign-vitals/scripts/create_test_caregiver.py   (by its login id)
-- ============================================================

begin;

alter table gloss_caregiver_accounts
  add column is_test boolean not null default false;

comment on column gloss_caregiver_accounts.is_test is
  'True for test logins (e.g. GLOSS TEST caregiver): left out of the supervisors'' Team learning list.';

commit;
