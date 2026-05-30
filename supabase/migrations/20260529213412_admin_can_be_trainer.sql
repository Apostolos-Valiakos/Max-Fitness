-- Allow profiles with role='admin' to appear as trainers in trainer_assignments.
-- Previously the trigger only accepted role='trainer'.

CREATE OR REPLACE FUNCTION check_trainer_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = NEW.trainer_id) NOT IN ('trainer', 'admin') THEN
    RAISE EXCEPTION 'trainer_id must reference a profile with role=trainer or admin';
  END IF;
  IF (SELECT tier FROM public.profiles WHERE id = NEW.client_id) <> 'ultra' THEN
    RAISE EXCEPTION 'client_id must reference a profile with tier=ultra';
  END IF;
  RETURN NEW;
END;
$$;
