-- ============================================================
-- 0029_SCRIBE_audit_log_grants.sql
-- SCRIBE Component — Voice ADL Logging (Component 4)
-- Grants service_role append-only access to audit_log.
--
-- The SCRIBE backend logs each processed observation via
-- process_observation() → _write_audit_log() after saving
-- adl_records. Without these grants Postgres returns 42501
-- ("permission denied for table audit_log") and the API
-- reports "Observation processing failed" even when the
-- pipeline completed.
--
-- Depends on: audit_log (0001_core_infra.sql)
-- ============================================================

grant select, insert on public.audit_log to service_role;
