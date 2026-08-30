-- ============================================================
-- 0039_SCRIBE_supervisor_manage_adl_records.sql
-- SCRIBE Component — Voice ADL Logging (Component 4)
-- Allow supervisors to update and delete ADL observation rows.
--
-- Depends on: adl_records (0013, 0017),
--             public.is_supervisor() (0013_SCRIBE_adl_records.sql)
--
-- Write path: supervisors use the authenticated Supabase client
-- (same pattern as adl_alerts acknowledgement in 0014). Inserts
-- remain backend-only via service_role after the ML pipeline.
-- Deleting a record cascades to adl_alerts (0014).
-- ============================================================

create policy "Supervisors can update adl records"
  on adl_records for update
  using (public.is_supervisor())
  with check (public.is_supervisor());

create policy "Supervisors can delete adl records"
  on adl_records for delete
  using (public.is_supervisor());

grant update, delete on adl_records to authenticated;
