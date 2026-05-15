-- Ensure admin user has correct password and role
DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'aposval99@gmail.com';

  IF admin_id IS NOT NULL THEN
    UPDATE auth.users
    SET encrypted_password = crypt('password123', gen_salt('bf', 10)),
        updated_at = NOW()
    WHERE id = admin_id;

    INSERT INTO public.profiles (id, role, tier, full_name, created_at, updated_at)
    VALUES (admin_id, 'admin', 'ultra', 'Admin', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET role = 'admin', updated_at = NOW();

    RAISE NOTICE 'Admin password and role set for user: %', admin_id;
  ELSE
    RAISE NOTICE 'Admin user not found';
  END IF;
END $$;
