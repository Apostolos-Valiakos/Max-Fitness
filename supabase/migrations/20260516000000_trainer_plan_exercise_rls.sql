-- Allow clients to read exercises belonging to templates assigned to them by a trainer.
-- Without this policy the mobile replication cannot pull template_exercises for trainer plans.
CREATE POLICY "template_exercises: client reads trainer-assigned"
  ON public.template_exercises FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.trainer_plan_assignments tpa
      WHERE tpa.template_id = template_exercises.template_id
        AND tpa.client_id   = auth.uid()
        AND tpa.is_active   = true
    )
  );
