-- ══════════════════════════════════════════════════════════════════════════════
--  SEED DATA  — local development only
--  Run automatically by: npx supabase db reset
--  Creates 3 fixed-UUID accounts so data can reference them across resets.
-- ══════════════════════════════════════════════════════════════════════════════

-- Fixed UUIDs (stable across resets so you can hardcode them in test data)
-- Admin   : 00000000-0000-0000-0000-000000000001  /  admin@maxfitness.local   / password123
-- Trainer : 00000000-0000-0000-0000-000000000002  /  trainer@maxfitness.local / password123
-- Client  : 00000000-0000-0000-0000-000000000003  /  client@maxfitness.local  / password123

DO $$
DECLARE
  v_admin   CONSTANT uuid := '00000000-0000-0000-0000-000000000001';
  v_trainer CONSTANT uuid := '00000000-0000-0000-0000-000000000002';
  v_client  CONSTANT uuid := '00000000-0000-0000-0000-000000000003';
  v_pw      TEXT := crypt('password123', gen_salt('bf', 10));
BEGIN

  -- ── Create auth.users ──────────────────────────────────────────────────────

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    aud, role, raw_user_meta_data, raw_app_meta_data,
    is_super_admin, confirmation_token, recovery_token,
    email_change_token_new, email_change
  )
  VALUES
    (v_admin,   '00000000-0000-0000-0000-000000000000', 'admin@maxfitness.local',   v_pw,
     NOW(), NOW(), NOW(), 'authenticated', 'authenticated',
     '{"full_name":"Admin"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb,
     false, '', '', '', ''),
    (v_trainer, '00000000-0000-0000-0000-000000000000', 'trainer@maxfitness.local', v_pw,
     NOW(), NOW(), NOW(), 'authenticated', 'authenticated',
     '{"full_name":"Test Trainer"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb,
     false, '', '', '', ''),
    (v_client,  '00000000-0000-0000-0000-000000000000', 'client@maxfitness.local',  v_pw,
     NOW(), NOW(), NOW(), 'authenticated', 'authenticated',
     '{"full_name":"Test Client"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb,
     false, '', '', '', '')
  ON CONFLICT (id) DO NOTHING;

  -- ── Create auth.identities ─────────────────────────────────────────────────

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_admin,   'admin@maxfitness.local',
     jsonb_build_object('sub', v_admin::text,   'email', 'admin@maxfitness.local'),   'email', NOW(), NOW(), NOW()),
    (gen_random_uuid(), v_trainer, 'trainer@maxfitness.local',
     jsonb_build_object('sub', v_trainer::text, 'email', 'trainer@maxfitness.local'), 'email', NOW(), NOW(), NOW()),
    (gen_random_uuid(), v_client,  'client@maxfitness.local',
     jsonb_build_object('sub', v_client::text,  'email', 'client@maxfitness.local'),  'email', NOW(), NOW(), NOW())
  ON CONFLICT DO NOTHING;

  -- ── Upsert profiles with correct roles/tiers ───────────────────────────────

  INSERT INTO public.profiles (id, role, tier, full_name, created_at, updated_at)
  VALUES
    (v_admin,   'admin',   'ultra', 'Admin',        NOW(), NOW()),
    (v_trainer, 'trainer', 'ultra', 'Test Trainer',  NOW(), NOW()),
    (v_client,  'user',    'ultra', 'Test Client',   NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
    SET role       = EXCLUDED.role,
        tier       = EXCLUDED.tier,
        full_name  = EXCLUDED.full_name,
        updated_at = NOW();

  -- ── Trainer ↔ client assignment ────────────────────────────────────────────

  INSERT INTO public.trainer_assignments (trainer_id, client_id, is_active)
  VALUES (v_trainer, v_client, true)
  ON CONFLICT (trainer_id, client_id) DO NOTHING;

  RAISE NOTICE 'Seed complete — admin / trainer / client accounts ready';
END $$;

-- ── Also promote aposval99@gmail.com to admin if it already exists ────────────
-- (covers the case where you've signed up via the real app before seeding)
UPDATE public.profiles p
SET role = 'admin', tier = 'ultra', updated_at = NOW()
FROM auth.users u
WHERE u.email = 'aposval99@gmail.com'
  AND p.id = u.id;
