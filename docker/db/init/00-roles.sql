-- Bootstrap the Supabase-compatible roles + extensions our stack needs.
-- Runs once on first container start (initdb) under the postgres superuser.

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- Roles used by PostgREST + GoTrue.
-- The two LOGIN roles ('authenticator', 'supabase_auth_admin') need a password
-- that matches what the services connect with — keep this in sync with .env.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login password 'postgres' noinherit;
  else
    alter role authenticator with login password 'postgres' noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin login password 'postgres' noinherit createrole;
  else
    alter role supabase_auth_admin with login password 'postgres' noinherit createrole;
  end if;
end
$$;

grant anon, authenticated, service_role to authenticator;

-- Schemas owned by Supabase services. The auth schema is owned by
-- supabase_auth_admin so GoTrue can run its own migrations there.
create schema if not exists auth authorization supabase_auth_admin;
create schema if not exists extensions;

-- Make sure supabase_auth_admin can also read public (for the trigger we
-- install later that inserts into public.profiles on auth.users insert).
grant usage on schema public to supabase_auth_admin;
grant all   on schema public to supabase_auth_admin;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth   to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
