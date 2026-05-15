-- Fix infinite recursion in workout_templates INSERT policy.
--
-- The original "templates: users insert own" policy contained an inline
-- subquery: SELECT COUNT(*) FROM workout_templates WHERE owner_id = auth.uid()
-- PostgreSQL evaluates all permissive policies together, so the subquery on
-- the same table triggers RLS again on workout_templates → infinite recursion.
--
-- Solution: move the count into a SECURITY DEFINER function, which runs as
-- the function owner (postgres) and bypasses RLS on that inner query.

CREATE OR REPLACE FUNCTION public.count_own_templates()
  RETURNS BIGINT
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COUNT(*) FROM public.workout_templates WHERE owner_id = auth.uid()
$$;

DROP POLICY IF EXISTS "templates: users insert own" ON public.workout_templates;

CREATE POLICY "templates: users insert own" ON public.workout_templates
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
    AND (
      public.user_tier() <> 'free'
      OR public.count_own_templates() < 3
    )
  );
