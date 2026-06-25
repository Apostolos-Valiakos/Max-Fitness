-- ── Fix 1: gyms — allow any authenticated user to look up a gym by join_code ──
-- Mobile JoinGymView queries gyms by join_code before the user belongs to any
-- gym (gym_id IS NULL on their profile). No existing policy covered this case,
-- so the query returned 0 rows and the UI showed "No gym found with that code."
CREATE POLICY "gyms: authenticated read for join"
  ON public.gyms FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── Fix 2: gym_invites — replace bare auth.users subquery with auth.email() ──
-- The old USING clause did:
--   email = (SELECT email FROM auth.users WHERE id = auth.uid())
-- auth.users is not accessible to the authenticated role, so any operation that
-- triggers a SELECT on gym_invites (including INSERT ... RETURNING) caused:
--   "permission denied for table users"
-- auth.email() is a GoTrue-provided SECURITY DEFINER equivalent that is safe.
DROP POLICY IF EXISTS "gym_invites: read own pending by email" ON public.gym_invites;

CREATE POLICY "gym_invites: read own pending by email"
  ON public.gym_invites FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND email = auth.email()
    AND accepted_at IS NULL
    AND expires_at > now()
  );
