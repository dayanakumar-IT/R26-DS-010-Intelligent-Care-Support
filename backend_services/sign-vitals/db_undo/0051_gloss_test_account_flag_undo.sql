-- Undo 0051_gloss_test_account_flag.sql. One transaction. Only drops the flag.
begin;
alter table gloss_caregiver_accounts drop column is_test;
commit;
