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

-- 3. Items (catalogue, reusable across lists)
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
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

-- 5. Auto-create a profile when a user signs up
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

-- 6. Row-Level Security
alter table public.profiles    enable row level security;
alter table public.lists       enable row level security;
alter table public.items       enable row level security;
alter table public.list_items  enable row level security;

create policy "own profile read"
  on public.profiles for select using (auth.uid() = id);
create policy "own profile update"
  on public.profiles for update using (auth.uid() = id);

create policy "own lists"
  on public.lists for all using (auth.uid() = user_id);

create policy "own items"
  on public.items for all using (auth.uid() = user_id);

create policy "own list_items"
  on public.list_items for all
  using (
    exists (
      select 1 from public.lists l
      where l.id = list_items.list_id
        and l.user_id = auth.uid()
    )
  );
