-- Add a permanent per-exercise coaching cue that users set on exercises they own.
-- Admins can set it on any exercise; regular users only on their own custom exercises.
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS sticky_note TEXT;
