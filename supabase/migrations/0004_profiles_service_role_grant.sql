-- The service_role (used by the create-user Edge Function) bypasses
-- RLS by design, but RLS-bypass is separate from base table-level
-- grants in Postgres. Because this project has "Automatically expose
-- new tables" disabled, no role was granted access automatically —
-- service_role needs an explicit grant here, same as authenticated
-- needed one in 0003 for the frontend.

grant select, insert, update, delete on public.profiles to service_role;
