-- The WITH CHECK subqueries on profiles re-trigger the same policy, causing infinite recursion.
-- Replace them with the SECURITY DEFINER helper functions which bypass RLS.
DROP POLICY IF EXISTS "profiles: users update own" ON public.profiles;

CREATE POLICY "profiles: users update own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.user_role()
    AND tier = public.user_tier()
  );
