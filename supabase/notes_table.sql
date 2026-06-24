-- Notes feature: one note per (user, course, video).
-- Kept in its own table (not a JSONB column on `courses`) so note writes
-- don't contend with the frequent progress updates on the course row, and so
-- notes stay independently queryable for future features (search, export, AI).
--
-- Run this in the Supabase SQL editor.

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  course_id   text not null,
  video_id    text not null,
  body        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, course_id, video_id)
);

create index if not exists notes_user_course_idx
  on public.notes (user_id, course_id);

-- Row Level Security: a user can only see and modify their own notes.
alter table public.notes enable row level security;

create policy "Users can view their own notes"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notes"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own notes"
  on public.notes for delete
  using (auth.uid() = user_id);
