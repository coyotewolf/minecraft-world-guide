-- Run inside a transaction and ROLLBACK. Only empty audit objects are created.
begin;
-- Transactional assertions: these empty probes are removed before commit.
create table public.__security_default_grants_probe (id integer);
create sequence public.__security_default_grants_sequence;
create function public.__security_default_grants_function() returns boolean language sql security invoker set search_path='' as $$select true$$;
do $$
begin
 if has_table_privilege('anon','public.__security_default_grants_probe','select') or has_table_privilege('authenticated','public.__security_default_grants_probe','select')
 or has_sequence_privilege('anon','public.__security_default_grants_sequence','usage') or has_sequence_privilege('authenticated','public.__security_default_grants_sequence','usage')
 or has_function_privilege('anon','public.__security_default_grants_function()','execute') or has_function_privilege('authenticated','public.__security_default_grants_function()','execute')
 then raise exception 'New objects unexpectedly grant client access';end if;
 if not has_table_privilege('service_role','public.__security_default_grants_probe','select') or not has_function_privilege('service_role','public.__security_default_grants_function()','execute')
 then raise exception 'Service access unexpectedly changed';end if;
end $$;
drop function public.__security_default_grants_function();
drop sequence public.__security_default_grants_sequence;
drop table public.__security_default_grants_probe;

rollback;
