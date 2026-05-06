-- ohMyBuying — Supabase schema
-- Run this in Supabase SQL Editor on a fresh project.

-- 1. Profiles mirror auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz default now()
);

-- 2. Lists owned by a user
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Items (catalogue, reusable across lists). user_id is the original creator
-- but is nullable: a shared list can hold items the current viewer didn't author.
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  reminder_enabled boolean not null default false,
  reminder_interval_days integer
    check (reminder_interval_days is null or reminder_interval_days between 1 and 365),
  last_used_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Junction table — many-to-many with per-list ordering
create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz default now(),
  unique (list_id, item_id)
);

create index list_items_list_id_position
  on public.list_items(list_id, position);

create or replace function public.mark_item_used()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.items set last_used_at = now() where id = old.item_id;
  return old;
end;
$$;

drop trigger if exists on_list_item_removed on public.list_items;
create trigger on_list_item_removed
  after delete on public.list_items
  for each row execute procedure public.mark_item_used();

-- 5. Sharing: members of a list (other than the owner) with full edit access.
create table public.list_members (
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  primary key (list_id, user_id)
);

create index list_members_user_id on public.list_members(user_id);

-- 6. Auto-create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7. SECURITY DEFINER helpers
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

create or replace function public.is_list_member(p_list_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.list_members
    where list_id = p_list_id and user_id = auth.uid()
  );
$$;
grant execute on function public.is_list_member(uuid) to authenticated;

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

create or replace function public.lookup_user_by_email(p_email text)
returns uuid language sql stable security definer set search_path = public, auth as $$
  select id from auth.users
  where lower(email) = lower(p_email)
  limit 1;
$$;

grant execute on function public.lookup_user_by_email(text) to authenticated;

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
    i.id, i.title, i.description, i.reminder_interval_days, i.last_used_at,
    extract(day from (now() - i.last_used_at))::int as days_since
  from public.items i
  where i.reminder_enabled = true
    and i.reminder_interval_days is not null
    and i.last_used_at is not null
    and i.last_used_at + (i.reminder_interval_days * interval '1 day') < now()
    and (
      i.user_id = auth.uid()
      or exists (
        select 1 from public.list_items li
        where li.item_id = i.id and public.can_access_list(li.list_id)
      )
    )
    and not exists (select 1 from public.list_items li where li.item_id = i.id)
  order by i.last_used_at asc;
$$;
grant execute on function public.due_reminders() to authenticated;

-- 8. Row-Level Security
alter table public.profiles     enable row level security;
alter table public.lists        enable row level security;
alter table public.items        enable row level security;
alter table public.list_items   enable row level security;
alter table public.list_members enable row level security;

-- profiles: read your own + anyone you share a list with
create policy "profiles read"
  on public.profiles for select
  using (public.profile_visible(id));
create policy "own profile update"
  on public.profiles for update using (auth.uid() = id);

-- lists: owner or member can read. Only owner mutates.
create policy "lists read"
  on public.lists for select
  using (user_id = auth.uid() or public.is_list_member(id));
create policy "lists insert" on public.lists for insert with check (user_id = auth.uid());
create policy "lists update" on public.lists for update using (user_id = auth.uid());
create policy "lists delete" on public.lists for delete using (user_id = auth.uid());

-- list_items: anyone with access to the list can rw
create policy "list_items rw"
  on public.list_items for all
  using (public.can_access_list(list_id))
  with check (public.can_access_list(list_id));

-- items: read/write if author OR the item is in some list you can access
create policy "items read"
  on public.items for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.list_items li
      where li.item_id = items.id and public.can_access_list(li.list_id)
    )
  );
create policy "items insert"
  on public.items for insert with check (auth.uid() is not null);
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

-- list_members: anyone with access to the list can read; only owner writes
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
  using (exists (
    select 1 from public.lists
    where id = list_members.list_id and user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.lists
    where id = list_members.list_id and user_id = auth.uid()
  ));
create policy "members self leave"
  on public.list_members for delete using (user_id = auth.uid());
