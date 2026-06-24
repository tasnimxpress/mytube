-- Migration: allow multiple notes per video.
-- The original notes table had `unique (user_id, course_id, video_id)`, which
-- limited each video to a single note (saved via upsert). Drop it so a video
-- can have many independent notes, each its own row keyed by `id`.
--
-- Run this in the Supabase SQL editor if you created the table before this change.

alter table public.notes
  drop constraint if exists notes_user_id_course_id_video_id_key;
