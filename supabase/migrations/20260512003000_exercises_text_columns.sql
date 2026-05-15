-- ExerciseDB uses body part / equipment names that don't match our enums.
-- Convert these two columns to TEXT so we can store values as-is.

ALTER TABLE public.exercises
  ALTER COLUMN body_part  TYPE TEXT,
  ALTER COLUMN equipment  TYPE TEXT;

-- Drop the old enum types if nothing else uses them
DROP TYPE IF EXISTS body_part;
DROP TYPE IF EXISTS equipment_type;
