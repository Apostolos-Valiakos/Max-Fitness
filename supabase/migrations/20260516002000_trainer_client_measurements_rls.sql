-- Allow trainers to read body measurements of their assigned clients
CREATE POLICY "measurements: trainers read client"
  ON public.body_measurements FOR SELECT
  USING (public.user_role() = 'trainer' AND public.is_trainer_for(user_id));
