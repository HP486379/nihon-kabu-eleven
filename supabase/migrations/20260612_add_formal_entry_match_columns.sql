-- Formal match type / period support for 日本株代表イレブン entries.
-- Safe to run multiple times.

alter table if exists public.entries
  add column if not exists match_type text;

alter table if exists public.entries
  add column if not exists period_id text;

alter table if exists public.entries
  add column if not exists display_user_name text;

alter table if exists public.entries
  add column if not exists display_team_name text;

alter table if exists public.entries
  add column if not exists owner_key text;

create index if not exists idx_entries_match_period_status
  on public.entries (contest_id, match_type, period_id, status, created_at desc);

create index if not exists idx_entries_owner_match_period
  on public.entries (contest_id, match_type, period_id, owner_key)
  where status in ('draft', 'entered', 'locked');
