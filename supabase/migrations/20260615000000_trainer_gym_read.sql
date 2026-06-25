-- Trainers need to read their own gym so the admin portal's gymStore.load()
-- can fetch plan limits (max_trainers, max_clients) for the billing display
-- and trial-period banner. Without this policy PostgREST returns 406 for
-- any trainer session that calls gymStore.load().

CREATE POLICY "gyms: trainer read own"
  ON public.gyms FOR SELECT
  USING (public.user_role() = 'trainer' AND id = public.user_gym_id());

-- Same gap in gym_subscriptions: trainers see subscription status on their
-- gym's billing card (read-only, own gym only).
CREATE POLICY "gym_subs: trainer read own"
  ON public.gym_subscriptions FOR SELECT
  USING (public.user_role() = 'trainer' AND gym_id = public.user_gym_id());
