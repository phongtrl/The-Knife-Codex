-- ============================================================
-- The Knife Codex — Supabase schema
-- Run this ONCE in your Supabase project: SQL Editor → New query → paste → Run.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE where possible).
-- ============================================================

-- 1) PROFILES ------------------------------------------------
-- One public row per user. Powers the leaderboard, so SELECT is open to all.
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  xp            integer     not null default 0,
  knives_found  integer     not null default 0,
  knives_owned  integer     not null default 0,
  updated_at    timestamptz not null default now()
);

-- If the profiles table already existed before this column was added, run:
alter table public.profiles
  add column if not exists knives_owned integer not null default 0;

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users insert their own profile" on public.profiles;
create policy "Users insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- 2) PROGRESS ------------------------------------------------
-- Private per-user save blob (the whole localStorage payload as JSON).
-- Only the owner can read or write their row.
create table if not exists public.progress (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.progress enable row level security;

drop policy if exists "Owner reads progress" on public.progress;
create policy "Owner reads progress"
  on public.progress for select
  using (auth.uid() = user_id);

drop policy if exists "Owner inserts progress" on public.progress;
create policy "Owner inserts progress"
  on public.progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owner updates progress" on public.progress;
create policy "Owner updates progress"
  on public.progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 3) GRANTS --------------------------------------------------
-- RLS decides WHICH rows a role may touch, but the role must first hold the
-- table-level privilege at all. Manually created tables don't always inherit
-- these, so grant them explicitly (idempotent).
--   anon          = signed-out visitors (leaderboard is public, read-only)
--   authenticated = signed-in users (manage their own profile + progress)
grant select on table public.profiles to anon;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.progress to authenticated;


-- 4) SELF-SERVICE ACCOUNT DELETION --------------------------
-- The client cannot delete an auth.users row directly (that needs the
-- service_role key, which must never ship in a browser). Instead we expose a
-- SECURITY DEFINER function that runs with the function owner's privileges and
-- deletes ONLY the caller's own data + auth row. The ON DELETE CASCADE on the
-- tables above cleans up profiles/progress automatically.
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is the id of the currently signed-in caller.
  delete from auth.users where id = auth.uid();
end;
$$;

-- Lock the function down: only signed-in users may call it, and each call can
-- only ever affect the caller (auth.uid()), never another account.
revoke all on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;


