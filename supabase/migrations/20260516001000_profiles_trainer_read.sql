-- Allow a client to read the profile of their assigned trainer.
-- Without this, the JOIN in fetchTrainerAssignment returns no rows
-- because the profiles RLS only allows reading own profile by default.
CREATE POLICY "profiles: clients read own trainer"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trainer_assignments ta
      WHERE ta.trainer_id = profiles.id
        AND ta.client_id  = auth.uid()
        AND ta.is_active  = true
    )
  );
