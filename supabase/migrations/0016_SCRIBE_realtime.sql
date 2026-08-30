-- ============================================================
-- 0016_SCRIBE_realtime.sql
-- SCRIBE Component — Voice ADL Logging (Component 4)
-- Enable Supabase Realtime on adl_records and adl_alerts so the
-- supervisor dashboard receives live inserts/updates without polling.
-- ============================================================

alter publication supabase_realtime add table adl_records;
alter publication supabase_realtime add table adl_alerts;
