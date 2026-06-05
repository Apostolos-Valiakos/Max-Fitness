-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Per-set configuration column on template_exercises
--    Stores an ordered array of { set_type, target_reps } objects.
--    NULL means "use target_sets working sets with target_reps" (backward compat).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.template_exercises
  ADD COLUMN IF NOT EXISTS set_configs JSONB DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Allow clients to read template_exercises for templates in their active plans
--    The existing policy joined through trainer_plan_assignments (older system).
--    This policy covers the current client_plan_assignments → plan_day_templates path.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "template_exercises: client reads via plan"
  ON public.template_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_plan_assignments cpa
      JOIN public.plan_day_templates pdt ON pdt.plan_id = cpa.plan_id
      WHERE pdt.template_id = template_exercises.template_id
        AND cpa.client_id   = auth.uid()
        AND cpa.is_active   = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Allow clients to read workout_templates for templates in their active plans
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "workout_templates: client reads via plan"
  ON public.workout_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_plan_assignments cpa
      JOIN public.plan_day_templates pdt ON pdt.plan_id = cpa.plan_id
      WHERE pdt.template_id = workout_templates.id
        AND cpa.client_id   = auth.uid()
        AND cpa.is_active   = true
    )
  );
