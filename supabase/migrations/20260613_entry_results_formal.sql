-- Formal result table for 日本株代表イレブン 2026
-- entries = participant roster / entry_results = official score sheet

create extension if not exists pgcrypto;

create table if not exists public.entry_results (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  match_type text not null check (match_type in ('daily', 'weekly', 'monthly', 'quarterly')),
  period_id text not null,
  owner_key text,
  display_user_name text,
  display_team_name text,
  weighted_return numeric(16, 10) not null default 0,
  rank integer,
  rank_order integer,
  stock_returns jsonb not null default '[]'::jsonb,
  result_status text not null default 'provisional' check (result_status in ('provisional', 'final')),
  calculation_version text not null default 'v1',
  calculated_at timestamptz not null default now(),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility columns for older API/UI code that still reads entry_results.team_return.
alter table public.entry_results
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists match_type text,
  add column if not exists period_id text,
  add column if not exists owner_key text,
  add column if not exists display_user_name text,
  add column if not exists display_team_name text,
  add column if not exists weighted_return numeric(16, 10),
  add column if not exists rank_order integer,
  add column if not exists stock_returns jsonb not null default '[]'::jsonb,
  add column if not exists result_status text not null default 'provisional',
  add column if not exists calculation_version text not null default 'v1',
  add column if not exists finalized_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists team_return numeric;

update public.entry_results
set weighted_return = coalesce(weighted_return, team_return / 100.0, 0),
    match_type = coalesce(match_type, 'daily'),
    period_id = coalesce(period_id, 'legacy'),
    calculated_at = coalesce(calculated_at, now()),
    updated_at = now()
where weighted_return is null
   or match_type is null
   or period_id is null;

create unique index if not exists entry_results_unique_match_period_entry
on public.entry_results (contest_id, match_type, period_id, entry_id);

create index if not exists entry_results_match_period_rank_idx
on public.entry_results (contest_id, match_type, period_id, rank_order);

create index if not exists entry_results_entry_id_idx
on public.entry_results (entry_id);
