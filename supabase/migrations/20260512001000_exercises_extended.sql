-- Extend exercises table with ExerciseDB fields
-- image_url already exists (used for GIF URL)
-- instructions already exists (used as text)

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS target_muscle      TEXT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS secondary_muscles  JSONB    DEFAULT NULL,  -- string[]
  ADD COLUMN IF NOT EXISTS exercise_db_id     TEXT     DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS exercises_db_id ON public.exercises(exercise_db_id)
  WHERE exercise_db_id IS NOT NULL;

-- Allow the service role (Edge Function) to upsert exercises
-- (RLS on exercises is read-only for users; service role bypasses RLS)
