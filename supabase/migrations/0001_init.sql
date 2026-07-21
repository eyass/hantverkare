-- Example table demonstrating the RLS pattern every table should follow.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- world-readable by default; revisit before adding non-public columns to this table.
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No delete policy: RLS denies by default. Add one explicitly if a
-- "delete my account" feature needs it later.

-- smoke-test comment only, no schema change — verifying T3 routing
