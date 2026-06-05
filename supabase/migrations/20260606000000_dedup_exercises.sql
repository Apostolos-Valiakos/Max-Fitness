-- Deduplicate global exercises that differ only in casing / whitespace.
-- For each group of same-name exercises (case-insensitive, created_by IS NULL):
--   Winner = row with image_url first, then secondary_muscles, then earliest created_at.
-- All FK references (sets, template_exercises) and soft references (personal_records)
-- are re-pointed to the winner before the losers are deleted.

DO $$
DECLARE
  r RECORD;
BEGIN

  -- ── 1. Build winner/loser pairs ──────────────────────────────────────────────
  FOR r IN
    WITH ranked AS (
      SELECT
        id,
        name,
        image_url,
        created_at,
        ROW_NUMBER() OVER (
          PARTITION BY LOWER(TRIM(name))
          ORDER BY
            (image_url IS NOT NULL) DESC,          -- prefer has photo
            (secondary_muscles IS NOT NULL) DESC,  -- prefer richer data
            created_at ASC                         -- prefer older (original)
        ) AS rn,
        FIRST_VALUE(id) OVER (
          PARTITION BY LOWER(TRIM(name))
          ORDER BY
            (image_url IS NOT NULL) DESC,
            (secondary_muscles IS NOT NULL) DESC,
            created_at ASC
        ) AS winner_id
      FROM public.exercises
      WHERE created_by IS NULL          -- global library only, skip user customs
    )
    SELECT id AS loser_id, winner_id, name
    FROM   ranked
    WHERE  rn > 1
    ORDER  BY name
  LOOP
    RAISE NOTICE 'Dedup: keeping % (%), removing %', r.winner_id, r.name, r.loser_id;

    -- ── 2. Re-point sets ──────────────────────────────────────────────────────
    UPDATE public.sets
    SET    exercise_id = r.winner_id
    WHERE  exercise_id = r.loser_id;

    -- ── 3. Re-point template_exercises ───────────────────────────────────────
    -- If a template already has the winner, just remove the loser row to avoid
    -- a duplicate exercise in the same template.
    DELETE FROM public.template_exercises te
    WHERE  te.exercise_id = r.loser_id
      AND  EXISTS (
        SELECT 1 FROM public.template_exercises te2
        WHERE  te2.template_id = te.template_id
          AND  te2.exercise_id = r.winner_id
      );

    -- For remaining loser rows (template doesn't have the winner yet), update.
    UPDATE public.template_exercises
    SET    exercise_id = r.winner_id
    WHERE  exercise_id = r.loser_id;

    -- ── 4. Re-point personal_records (no FK, safe to update directly) ────────
    UPDATE public.personal_records
    SET    exercise_id = r.winner_id
    WHERE  exercise_id = r.loser_id;

    -- ── 5. Delete the loser ───────────────────────────────────────────────────
    DELETE FROM public.exercises WHERE id = r.loser_id;

  END LOOP;

END $$;
