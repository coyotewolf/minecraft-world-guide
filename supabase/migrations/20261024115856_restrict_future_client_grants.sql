-- Existing tables, policies and explicit grants are unchanged.
-- New app-owned objects are private until a migration grants client access.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
-- PUBLIC's implicit EXECUTE is global, so a per-schema revoke is insufficient.
alter default privileges for role postgres revoke execute on functions from public;
