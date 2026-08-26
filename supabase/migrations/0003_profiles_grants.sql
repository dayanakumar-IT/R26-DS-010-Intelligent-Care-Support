-- Explicit grants for the authenticated role, since this project has
-- "Automatically expose new tables" disabled by design (per the
-- access-control principle: no table gets API access until someone
-- deliberately grants it). RLS policies from 0002_profiles.sql still
-- govern which specific rows are visible/editable — this grant only
-- unlocks the table at the object level so those policies can even
-- be evaluated.

grant select, update on public.profiles to authenticated;
