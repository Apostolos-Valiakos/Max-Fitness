ALTER TABLE public.workout_templates
  ADD COLUMN IF NOT EXISTS folder_name TEXT;
