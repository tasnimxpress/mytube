-- Migration: remember playback position per video ("resume where you left off").
-- Adds a `positions` map to each course: { [videoId]: secondsIntoVideo }.
-- Both YouTube and local videos save their current time here every few seconds,
-- and the player auto-seeks to it on open.
--
-- Run this in the Supabase SQL editor if you created the courses table before
-- this change.

alter table public.courses
  add column if not exists positions jsonb not null default '{}'::jsonb;
