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
  updated_at    timestamptz not null default now()
);

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

