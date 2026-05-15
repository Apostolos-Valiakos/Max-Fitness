-- Replace the partial index with a proper unique constraint so PostgREST
-- can use exercise_db_id as an ON CONFLICT target.

DROP INDEX IF EXISTS exercises_db_id;

ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_exercise_db_id_unique UNIQUE (exercise_db_id);
