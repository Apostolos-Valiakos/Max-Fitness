-- Add Stripe customer ID to profiles so mobile users can be billed individually
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Allow users to read/update their own stripe_customer_id (needed for portal redirect)
-- The column is set by the edge function via service role, but users can read it.
COMMENT ON COLUMN public.profiles.stripe_customer_id IS
  'Stripe customer ID for individual user billing (free/paid/ultra tier upgrades)';
