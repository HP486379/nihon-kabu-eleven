-- Allow one user to save multiple teams in the same contest.
--
-- The previous partial unique index/constraint allowed only one active entry per user.
-- That is wrong for 日本株代表イレブン because a user may create multiple fantasy teams.
--
-- Apply this SQL in Supabase SQL Editor for the production project.

DROP INDEX IF EXISTS public.entries_one_active_entry_per_user;
ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_one_active_entry_per_user;
