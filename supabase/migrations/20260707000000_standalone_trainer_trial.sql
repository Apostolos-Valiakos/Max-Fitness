-- =============================================================================
-- Self-serve standalone trainer trial + paid subscription
--
-- Lets someone sign up on the admin portal, become role='trainer' immediately
-- with a 14-day free trial, then subscribe to a single flat plan via Stripe
-- once the trial ends. Gym-affiliated trainers are untouched (their gym pays).
-- Owner/admin-promoted standalone trainers keep trainer_subscription_status
-- NULL, which is never locked — this column only governs self-serve signups.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trainer_subscription_status TEXT
    CHECK (trainer_subscription_status IN ('trialing','active','past_due','canceled')),
  ADD COLUMN IF NOT EXISTS trainer_trial_ends_at TIMESTAMPTZ;

-- Re-pin the two new columns the same way role/tier are already pinned below,
-- so a plain user can never grant themselves trainer access via a direct
-- client .update() — only the service-role edge functions can change these.
DROP POLICY "profiles: users update own" ON public.profiles;
CREATE POLICY "profiles: users update own" ON public.profiles FOR UPDATE USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND tier = (SELECT tier FROM public.profiles WHERE id = auth.uid())
    AND trainer_subscription_status IS NOT DISTINCT FROM (SELECT trainer_subscription_status FROM public.profiles WHERE id = auth.uid())
    AND trainer_trial_ends_at IS NOT DISTINCT FROM (SELECT trainer_trial_ends_at FROM public.profiles WHERE id = auth.uid())
  );
