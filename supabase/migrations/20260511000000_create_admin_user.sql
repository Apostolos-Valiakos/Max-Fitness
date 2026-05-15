-- Create admin user: aposval99@gmail.com / password123
-- Uses pgcrypto bcrypt for password hashing (same as Supabase GoTrue)

DO $$
DECLARE
  admin_id uuid := gen_random_uuid();
BEGIN
  -- Only insert if user doesn't already exist
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'aposval99@gmail.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      aud,
      role,
      raw_user_meta_data,
      raw_app_meta_data,
      is_super_admin,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      admin_id,
      '00000000-0000-0000-0000-000000000000',
      'aposval99@gmail.com',
      crypt('password123', gen_salt('bf', 10)),
      NOW(),
      NOW(),
      NOW(),
      'authenticated',
      'authenticated',
      '{"full_name": "Admin"}'::jsonb,
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      false,
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      admin_id,
      'aposval99@gmail.com',
      jsonb_build_object('sub', admin_id::text, 'email', 'aposval99@gmail.com'),
      'email',
      NOW(),
      NOW(),
      NOW()
    );

    -- Set profile role to admin (trigger may have already created the profile)
    -- Wait a moment and try to update, or insert if trigger didn't fire
    INSERT INTO public.profiles (id, role, tier, full_name, created_at, updated_at)
    VALUES (admin_id, 'admin', 'ultra', 'Admin', NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = 'Admin', updated_at = NOW();

    RAISE NOTICE 'Admin user created with id: %', admin_id;
  ELSE
    -- Update existing user's profile role to admin
    UPDATE public.profiles p
    SET role = 'admin', updated_at = NOW()
    FROM auth.users u
    WHERE u.email = 'aposval99@gmail.com' AND p.id = u.id;

    RAISE NOTICE 'Admin user already exists, role updated to admin';
  END IF;
END $$;
