-- Allow all authenticated users to read public (library) templates
CREATE POLICY "templates: read public" ON public.workout_templates
  FOR SELECT USING (is_public = true);

-- Extend template_exercises SELECT to cover exercises belonging to public templates.
-- The original policy covers owners/trainers/admins; we add a separate read policy for public.
CREATE POLICY "template_exercises: read public" ON public.template_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workout_templates wt
      WHERE wt.id = template_id
        AND wt.is_public = true
    )
  );
