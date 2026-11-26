-- BECOMING v0.4 — Supabase schema
-- Run once in Supabase Dashboard → SQL Editor → New query → paste all → Run.
-- Safe to re-run: every statement is idempotent.
-- Every table is protected by Row Level Security: a signed-in user can only
-- read and write rows where user_id = their own auth.uid().

-- 1) Life OS snapshot (all v0.3 data: tasks, routines, journal, ...) — one row per user
create table if not exists public.user_state (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  data           jsonb not null,
  schema_version int  not null default 1,
  device_id      text,
  updated_at     timestamptz not null default now()
);

-- 2) Intelligence Core — Long-term Memory (user can view / edit / delete)
create table if not exists public.memories (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null,               -- fact | preference | pattern | goal | context
  content     text not null,
  source      text not null,               -- user | learned | capture | agent:<id>
  agent_id    text,
  status      text not null default 'active', -- proposed (waiting for approval) | active
  confidence  real not null default 1,
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists memories_user_updated on public.memories (user_id, updated_at);

-- 3) Intelligence Core — Behavior event log (Observe). Append-only.
create table if not exists public.behavior_events (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type        text not null,
  agent_id    text,
  payload     jsonb not null default '{}',
  occurred_at timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists behavior_events_user_time on public.behavior_events (user_id, occurred_at);

-- 4) Intelligence Core — Recommendations (Recommend → Human approval → Evaluate → Learn)
create table if not exists public.recommendations (
  id           text primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  agent_id     text not null,
  signal_key   text not null,
  title        text not null,
  body         text not null,
  rationale    text not null default '',
  status       text not null,              -- proposed | approved | dismissed | evaluated
  outcome      text,                       -- helpful | not_helpful
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  evaluated_at timestamptz,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists recommendations_user_updated on public.recommendations (user_id, updated_at);

-- 5) Image capture usage log (used by the extract-capture Edge Function for a daily limit)
create table if not exists public.capture_log (
  id         bigserial primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  items      int not null default 0
);
create index if not exists capture_log_user_time on public.capture_log (user_id, created_at);

-- Row Level Security -----------------------------------------------------------
alter table public.user_state      enable row level security;
alter table public.memories        enable row level security;
alter table public.behavior_events enable row level security;
alter table public.recommendations enable row level security;
alter table public.capture_log     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['user_state','memories','behavior_events','recommendations','capture_log'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
