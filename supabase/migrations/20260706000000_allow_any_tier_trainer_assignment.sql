-- =============================================================================
-- Allow trainer assignment for clients of ANY tier (free, paid, ultra)
--
-- Previously check_trainer_role() required tier='ultra' on the client, and the
-- "assignments: clients read own" RLS policy matched that restriction. Gyms
-- now want to assign trainers to members regardless of tier, so both are
-- relaxed to only check role (client_id must be role='user').
-- =============================================================================

CREATE OR REPLACE FUNCTION check_trainer_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_trainer_role TEXT;
  v_client_role  TEXT;
  v_trainer_gym  UUID;
  v_client_gym   UUID;
BEGIN
  SELECT role INTO v_trainer_role FROM public.profiles WHERE id = NEW.trainer_id;
  IF v_trainer_role NOT IN ('trainer','admin','owner') THEN
    RAISE EXCEPTION 'trainer_id must reference a profile with role trainer, admin, or owner';
  END IF;

  SELECT role INTO v_client_role FROM public.profiles WHERE id = NEW.client_id;
  IF v_client_role <> 'user' THEN
    RAISE EXCEPTION 'client_id must reference a profile with role=user';
  END IF;

  SELECT gym_id INTO v_trainer_gym FROM public.profiles WHERE id = NEW.trainer_id;
  SELECT gym_id INTO v_client_gym  FROM public.profiles WHERE id = NEW.client_id;

  -- Enforce same gym when both parties belong to a gym
  IF v_trainer_gym IS NOT NULL AND v_client_gym IS NOT NULL
     AND v_trainer_gym <> v_client_gym THEN
    RAISE EXCEPTION 'trainer and client must belong to the same gym';
  END IF;

  -- Auto-populate gym_id from trainer's gym
  IF NEW.gym_id IS NULL THEN
    NEW.gym_id := v_trainer_gym;
  END IF;

  RETURN NEW;
END;
$$;

-- Clients of any tier must be able to read their own assignment row
-- (previously gated on user_tier() = 'ultra', blocking free/paid clients
-- from seeing their assigned trainer once the trigger allowed the row).
DROP POLICY IF EXISTS "assignments: clients read own" ON public.trainer_assignments;

CREATE POLICY "assignments: clients read own" ON public.trainer_assignments
  FOR SELECT USING (client_id = auth.uid());
