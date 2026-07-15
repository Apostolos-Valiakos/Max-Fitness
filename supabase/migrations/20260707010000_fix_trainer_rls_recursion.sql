-- =============================================================================
-- Fix: "infinite recursion detected in policy for relation profiles"
--
-- "profiles: users update own" pinned role/tier (and, as of the previous
-- migration, trainer_subscription_status/trainer_trial_ends_at) using raw
-- self-referential subqueries directly in the policy body. Postgres re-applies
-- RLS to those subqueries since they aren't wrapped in a SECURITY DEFINER
-- function — with 4 such subqueries in one WITH CHECK clause, Postgres's
-- recursion detector now trips (verified live: a client's self-update attempt
-- returned "infinite recursion detected" instead of a clean permission denial,
-- though the write was still correctly blocked either way).
--
-- Fix: reuse the same SECURITY DEFINER pattern this schema already uses for
-- exactly this purpose (user_role(), user_tier() below) — a SECURITY DEFINER
-- function bypasses RLS entirely, so there's no nested policy evaluation.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.user_trainer_subscription_status()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT trainer_subscription_status FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.user_trainer_trial_ends_at()
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT trainer_trial_ends_at FROM public.profiles WHERE id = auth.uid()
$$;

DROP POLICY "profiles: users update own" ON public.profiles;
CREATE POLICY "profiles: users update own" ON public.profiles FOR UPDATE USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.user_role()
    AND tier = public.user_tier()
    AND trainer_subscription_status IS NOT DISTINCT FROM public.user_trainer_subscription_status()
    AND trainer_trial_ends_at IS NOT DISTINCT FROM public.user_trainer_trial_ends_at()
  );
