-- ohMyBuying schema for the local Docker stack.
-- Idempotent: safe to re-run on every container start.
-- Mirrors supabase/schema.sql but uses IF NOT EXISTS / DROP IF EXISTS guards.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz default now()
);

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  reminder_enabled boolean not null default false,
  reminder_interval_days integer,
  last_used_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Migration steps for existing installs.
alter table public.items alter column user_id drop not null;
alter table public.items add column if not exists reminder_enabled boolean not null default false;
alter table public.items add column if not exists reminder_interval_days integer;
alter table public.items add column if not exists last_used_at timestamptz;
-- reminder_interval_days only matters when reminders are on; keep it sane.
alter table public.items drop constraint if exists items_reminder_interval_chk;
alter table public.items add constraint items_reminder_interval_chk
  check (reminder_interval_days is null or reminder_interval_days between 1 and 365);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz default now(),
  unique (list_id, item_id)
);

create index if not exists list_items_list_id_position
  on public.list_items(list_id, position);

-- When an item is removed from a list, mark the item itself as "just used"
-- so reminder timers start counting from this moment.
create or replace function public.mark_item_used()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.items
    set last_used_at = now()
    where id = old.item_id;
  return old;
end;
$$;

drop trigger if exists on_list_item_removed on public.list_items;
create trigger on_list_item_removed
  after delete on public.list_items
  for each row execute procedure public.mark_item_used();

-- Sharing: a user (other than the owner) granted full edit access on a list.
create table if not exists public.list_members (
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  primary key (list_id, user_id)
);

create index if not exists list_members_user_id on public.list_members(user_id);

-- Auto-create a profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper: can the current user see/edit this list?
-- SECURITY DEFINER avoids recursive RLS evaluation against list_members.
create or replace function public.can_access_list(p_list_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lists
    where id = p_list_id and user_id = auth.uid()
  )
  or exists (
    select 1 from public.list_members
    where list_id = p_list_id and user_id = auth.uid()
  );
$$;

grant execute on function public.can_access_list(uuid) to authenticated;

-- Helper: is the current user a member (NOT counting owner) of a list?
-- Used inside lists/list_members RLS to break recursion.
create or replace function public.is_list_member(p_list_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.list_members
    where list_id = p_list_id and user_id = auth.uid()
  );
$$;

grant execute on function public.is_list_member(uuid) to authenticated;

-- Add a member to a list by their email, atomically. The caller must own the
-- list. Returns a status enum so the client never sees a UUID for an account
-- it didn't already know about — this avoids using the function as a generic
-- email-existence oracle (the old lookup_user_by_email did exactly that).
create or replace function public.add_list_member_by_email(
  p_list_id uuid,
  p_email text
)
returns text language plpgsql security definer set search_path = public, auth as $$
declare
  v_target_id uuid;
  v_caller    uuid := auth.uid();
begin
  if v_caller is null then
    return 'unauthenticated';
  end if;

  if not exists (
    select 1 from public.lists where id = p_list_id and user_id = v_caller
  ) then
    return 'not_owner';
  end if;

  select id into v_target_id
  from auth.users
  where lower(email) = lower(p_email)
  limit 1;

  if v_target_id is null then
    return 'no_such_user';
  end if;

  if v_target_id = v_caller then
    return 'cannot_add_self';
  end if;

  insert into public.list_members (list_id, user_id, added_by)
  values (p_list_id, v_target_id, v_caller)
  on conflict (list_id, user_id) do nothing;

  return 'ok';
end;
$$;

revoke all on function public.add_list_member_by_email(uuid, text) from public;
grant execute on function public.add_list_member_by_email(uuid, text) to authenticated;

-- Drop the old leaky email-lookup function if it still exists from a prior boot.
drop function if exists public.lookup_user_by_email(text);

-- "Due reminders": items the current user can see that have reminders on,
-- aren't currently on any list, and whose last_used_at is older than the
-- configured interval.
create or replace function public.due_reminders()
returns table (
  id uuid,
  title text,
  description text,
  reminder_interval_days integer,
  last_used_at timestamptz,
  days_since integer
)
language sql stable security definer set search_path = public as $$
  select
    i.id,
    i.title,
    i.description,
    i.reminder_interval_days,
    i.last_used_at,
    extract(day from (now() - i.last_used_at))::int as days_since
  from public.items i
  where i.reminder_enabled = true
    and i.reminder_interval_days is not null
    and i.last_used_at is not null
    and i.last_used_at + (i.reminder_interval_days * interval '1 day') < now()
    -- visible to the current user: own item, OR item exists in any list they
    -- can access (mirrors the items SELECT RLS).
    and (
      i.user_id = auth.uid()
      or exists (
        select 1 from public.list_items li
        where li.item_id = i.id and public.can_access_list(li.list_id)
      )
    )
    -- not currently on any list (otherwise no need to remind)
    and not exists (
      select 1 from public.list_items li where li.item_id = i.id
    )
  order by i.last_used_at asc;
$$;

grant execute on function public.due_reminders() to authenticated;

-- ============================================================
-- Alexa account linking
-- ============================================================

-- A code the user generates inside the app, then types into the Alexa app.
-- Codes are 6 chars, expire in 10 minutes, single-use.
create table if not exists public.alexa_link_codes (
  code         text primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  expires_at   timestamptz not null,
  redeemed_at  timestamptz,
  alexa_user_id text,
  created_at   timestamptz default now()
);

create index if not exists alexa_link_codes_user_id on public.alexa_link_codes(user_id);

-- Permanent binding once redeemed.
create table if not exists public.alexa_links (
  alexa_user_id text primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz default now()
);

create index if not exists alexa_links_user_id on public.alexa_links(user_id);

alter table public.alexa_link_codes enable row level security;
alter table public.alexa_links      enable row level security;

drop policy if exists "alexa_link_codes own"     on public.alexa_link_codes;
drop policy if exists "alexa_links own read"     on public.alexa_links;
drop policy if exists "alexa_links own delete"   on public.alexa_links;

-- A user only sees / mutates their own codes.
create policy "alexa_link_codes own"
  on public.alexa_link_codes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- A user can see / unlink their own Alexa binding. Inserts come from the
-- service role via the redeem RPC, never from authenticated clients.
create policy "alexa_links own read"
  on public.alexa_links for select using (user_id = auth.uid());
create policy "alexa_links own delete"
  on public.alexa_links for delete using (user_id = auth.uid());

-- Issue a fresh 6-character code for the current user. Older unredeemed codes
-- for the same user are wiped so only one is active at a time.
create or replace function public.issue_alexa_link_code()
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_expires timestamptz := now() + interval '10 minutes';
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  delete from public.alexa_link_codes
   where user_id = v_user_id and redeemed_at is null;

  -- 6-character uppercase code from a friendly alphabet (no 0/O/1/I confusion).
  v_code := upper(substring(replace(encode(gen_random_bytes(8), 'base64'), '/', '')
                            from 1 for 6));
  v_code := translate(v_code, '0O1I+/', 'XKJLMN');

  insert into public.alexa_link_codes (code, user_id, expires_at)
  values (v_code, v_user_id, v_expires);

  return query select v_code, v_expires;
end;
$$;
grant execute on function public.issue_alexa_link_code() to authenticated;

-- Redeem a code: server-side only (no JWT). The Vercel handler calls this
-- using the service_role key, so we restrict it accordingly.
create or replace function public.redeem_alexa_link_code(
  p_code text,
  p_alexa_user_id text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  if p_code is null or p_alexa_user_id is null then
    return null;
  end if;

  update public.alexa_link_codes
     set redeemed_at = now(),
         alexa_user_id = p_alexa_user_id
   where code = upper(p_code)
     and redeemed_at is null
     and expires_at > now()
   returning user_id into v_user_id;

  if v_user_id is null then
    return null;
  end if;

  insert into public.alexa_links (alexa_user_id, user_id)
  values (p_alexa_user_id, v_user_id)
  on conflict (alexa_user_id) do update set user_id = excluded.user_id;

  return v_user_id;
end;
$$;
revoke all on function public.redeem_alexa_link_code(text, text) from public;
grant execute on function public.redeem_alexa_link_code(text, text) to service_role;

-- Resolve an Alexa user to a Supabase user. Server-side only.
create or replace function public.resolve_alexa_user(p_alexa_user_id text)
returns uuid
language sql stable security definer set search_path = public as $$
  select user_id from public.alexa_links where alexa_user_id = p_alexa_user_id;
$$;
revoke all on function public.resolve_alexa_user(text) from public;
grant execute on function public.resolve_alexa_user(text) to service_role;

-- Row-Level Security
alter table public.profiles     enable row level security;
alter table public.lists        enable row level security;
alter table public.items        enable row level security;
alter table public.list_items   enable row level security;
alter table public.list_members enable row level security;

-- Drop legacy policies before recreating with the new sharing model.
drop policy if exists "own profile read"        on public.profiles;
drop policy if exists "own profile update"      on public.profiles;
drop policy if exists "own lists"               on public.lists;
drop policy if exists "own items"               on public.items;
drop policy if exists "own list_items"          on public.list_items;
drop policy if exists "lists read"              on public.lists;
drop policy if exists "lists insert"            on public.lists;
drop policy if exists "lists update"            on public.lists;
drop policy if exists "lists delete"            on public.lists;
drop policy if exists "items read"              on public.items;
drop policy if exists "items insert"            on public.items;
drop policy if exists "items update"            on public.items;
drop policy if exists "items delete"            on public.items;
drop policy if exists "list_items rw"           on public.list_items;
drop policy if exists "members read"            on public.list_members;
drop policy if exists "members write owner"     on public.list_members;
drop policy if exists "members self leave"      on public.list_members;
drop policy if exists "profiles read"           on public.profiles;

-- profiles: read your own, or any profile that shares a list with you (so the
-- share modal can render member emails). Use a SECURITY DEFINER helper to
-- avoid touching list_members RLS from inside a profiles policy.
create or replace function public.profile_visible(p_target_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    auth.uid() = p_target_id
    or exists (
      select 1
      from public.list_members lm_self
      join public.list_members lm_other on lm_self.list_id = lm_other.list_id
      where lm_self.user_id = auth.uid() and lm_other.user_id = p_target_id
    )
    or exists (
      select 1 from public.list_members lm
      join public.lists l on l.id = lm.list_id
      where l.user_id = auth.uid() and lm.user_id = p_target_id
    )
    or exists (
      select 1 from public.list_members lm
      join public.lists l on l.id = lm.list_id
      where lm.user_id = auth.uid() and l.user_id = p_target_id
    );
$$;
grant execute on function public.profile_visible(uuid) to authenticated;

create policy "profiles read"
  on public.profiles for select
  using (public.profile_visible(id));

create policy "own profile update"
  on public.profiles for update using (auth.uid() = id);

-- lists: owner or member can read. Only owner can insert/update/delete.
create policy "lists read"
  on public.lists for select
  using (user_id = auth.uid() or public.is_list_member(id));

create policy "lists insert"
  on public.lists for insert with check (user_id = auth.uid());

create policy "lists update"
  on public.lists for update using (user_id = auth.uid());

create policy "lists delete"
  on public.lists for delete using (user_id = auth.uid());

-- list_items: anyone with access to the parent list can read AND modify
-- (insert/update/delete for reorder + add + remove).
create policy "list_items rw"
  on public.list_items for all
  using (public.can_access_list(list_id))
  with check (public.can_access_list(list_id));

-- items: readable + writable by anyone with access to a list that references
-- the item. New items (no list yet) are accessible to the inserter only via
-- the inserting transaction. Cleanup of orphans is left to ON DELETE CASCADE
-- when their last list_items row goes (we don't auto-delete here — keeps the
-- model simple).
create policy "items read"
  on public.items for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.list_items li
      where li.item_id = items.id and public.can_access_list(li.list_id)
    )
  );

-- An authenticated user may only insert items as themselves (or anonymous).
-- Without this check, a JWT holder could plant items "owned" by a different
-- user_id and then exploit the items update/delete policies.
create policy "items insert"
  on public.items for insert
  with check (user_id is null or user_id = auth.uid());

create policy "items update"
  on public.items for update
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.list_items li
      where li.item_id = items.id and public.can_access_list(li.list_id)
    )
  );

create policy "items delete"
  on public.items for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.list_items li
      where li.item_id = items.id and public.can_access_list(li.list_id)
    )
  );

-- list_members: any participant of the list can read the member list (so the
-- share modal works for both owner and members). Only the OWNER can add or
-- remove members.
-- A user can read member rows if it's their own row, they're a co-member of
-- the same list, or they own the list. is_list_member() is SECURITY DEFINER
-- so it doesn't re-enter RLS.
create policy "members read"
  on public.list_members for select
  using (
    user_id = auth.uid()
    or public.is_list_member(list_id)
    or exists (
      select 1 from public.lists
      where id = list_members.list_id and user_id = auth.uid()
    )
  );

create policy "members write owner"
  on public.list_members for all
  using (
    exists (
      select 1 from public.lists
      where id = list_members.list_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.lists
      where id = list_members.list_id and user_id = auth.uid()
    )
  );

-- A member can remove their own membership row (leave the list).
create policy "members self leave"
  on public.list_members for delete
  using (user_id = auth.uid());

-- Grants for PostgREST roles.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables    in schema public to authenticated, service_role;
grant select                         on all tables    in schema public to anon;
grant usage, select                  on all sequences in schema public to authenticated, service_role;

-- Tell PostgREST to reload its schema cache so newly added RPCs are reachable.
notify pgrst, 'reload schema';
