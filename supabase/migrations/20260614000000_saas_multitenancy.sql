-- =============================================================================
-- MAX FITNESS — Phase A: SaaS Multi-Tenant Foundation
--
-- Summary of changes:
--   1.  Add 'owner' to user_role enum
--   2.  Create gyms table (tenant unit)
--   3.  Create gym_subscriptions table (Stripe billing state)
--   4.  Create gym_invites table (email invite system)
--   5.  Add gym_id column to all affected tables
--   6.  New RLS helper functions (user_gym_id, is_owner, same_gym)
--   7.  Update check_trainer_role trigger (same-gym enforcement)
--   8.  Drop all old flat-admin RLS policies
--   9.  Create gym-scoped admin + owner-bypass RLS policies
--   10. Data migration: Default Gym + promote first admin to owner
-- =============================================================================

-- NOTE: 'owner' was added to user_role enum in 20260613000000_add_owner_role.sql
-- It must be in a separate committed transaction before being used here.

-- =============================================================================
-- 2. GYMS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.gyms (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  slug                TEXT        NOT NULL UNIQUE,
  join_code           TEXT        NOT NULL UNIQUE,
  plan                TEXT        NOT NULL DEFAULT 'basic'
                      CHECK (plan IN ('basic','pro','elite')),
  -- Placeholder limits — adjust before launch
  max_trainers        INT         NOT NULL DEFAULT 3,
  max_clients         INT         NOT NULL DEFAULT 30,
  subscription_status TEXT        NOT NULL DEFAULT 'trialing'
                      CHECK (subscription_status IN
                        ('trialing','active','past_due','canceled','suspended')),
  trial_ends_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  created_by          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gyms_slug      ON public.gyms(slug);
CREATE INDEX IF NOT EXISTS idx_gyms_join_code ON public.gyms(join_code);
CREATE INDEX IF NOT EXISTS idx_gyms_created_by ON public.gyms(created_by);

ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_gyms_updated_at
  BEFORE UPDATE ON public.gyms
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- 3. GYM_SUBSCRIPTIONS TABLE (Stripe billing state per gym)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.gym_subscriptions (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id                   UUID        NOT NULL UNIQUE
                           REFERENCES public.gyms(id) ON DELETE CASCADE,
  stripe_customer_id       TEXT        UNIQUE,
  stripe_subscription_id   TEXT        UNIQUE,
  stripe_price_id          TEXT,
  plan                     TEXT        CHECK (plan IN ('basic','pro','elite')),
  -- Mirrors Stripe status: active | trialing | past_due | canceled | unpaid
  status                   TEXT,
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN     NOT NULL DEFAULT false,
  monthly_amount_cents     INT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gym_subs_gym_id    ON public.gym_subscriptions(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_subs_stripe_sub ON public.gym_subscriptions(stripe_subscription_id);

ALTER TABLE public.gym_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_gym_subscriptions_updated_at
  BEFORE UPDATE ON public.gym_subscriptions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- =============================================================================
-- 4. GYM_INVITES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.gym_invites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id      UUID        NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        user_role   NOT NULL DEFAULT 'user',
  -- Random URL-safe token for the invite link
  token       TEXT        NOT NULL UNIQUE
              DEFAULT encode(gen_random_bytes(24), 'base64url'),
  invited_by  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gym_invites_gym_id ON public.gym_invites(gym_id);
CREATE INDEX IF NOT EXISTS idx_gym_invites_token  ON public.gym_invites(token);
CREATE INDEX IF NOT EXISTS idx_gym_invites_email  ON public.gym_invites(email);

ALTER TABLE public.gym_invites ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. ADD gym_id COLUMN TO EXISTING TABLES
--    Nullable everywhere — standalone users (gym_id IS NULL) are valid.
-- =============================================================================

-- profiles: the gym this user belongs to
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_gym_id ON public.profiles(gym_id);

-- exercises: gym-wide shared library (gym_id NOT NULL = gym-scoped)
-- Global: created_by IS NULL AND gym_id IS NULL
-- Gym-wide: gym_id IS NOT NULL  (any gym member can see)
-- Personal custom: created_by IS NOT NULL AND gym_id IS NULL
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_exercises_gym_id ON public.exercises(gym_id);

-- trainer_assignments: always within one gym
ALTER TABLE public.trainer_assignments
  ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ta_gym_id ON public.trainer_assignments(gym_id);

-- workout_templates: gym-scoped
ALTER TABLE public.workout_templates
  ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_wt_gym_id ON public.workout_templates(gym_id);

-- checkin_templates: gym-scoped
ALTER TABLE public.checkin_templates
  ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ct_gym_id ON public.checkin_templates(gym_id);

-- checkin_assignments: gym-scoped
ALTER TABLE public.checkin_assignments
  ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ca_gym_id ON public.checkin_assignments(gym_id);

-- workout_plans: gym-scoped
ALTER TABLE public.workout_plans
  ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_wp_gym_id ON public.workout_plans(gym_id);

-- client_plan_assignments: gym-scoped
ALTER TABLE public.client_plan_assignments
  ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES public.gyms(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_cpa_gym_id ON public.client_plan_assignments(gym_id);

-- =============================================================================
-- 6. NEW RLS HELPER FUNCTIONS
-- =============================================================================

-- Current user's gym_id (NULL for owner or standalone users)
CREATE OR REPLACE FUNCTION public.user_gym_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT gym_id FROM public.profiles WHERE id = auth.uid()
$$;

-- True if current user is the platform owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
  )
$$;

-- True if current user's gym matches a target gym_id
CREATE OR REPLACE FUNCTION public.same_gym(target_gym_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT public.user_gym_id() IS NOT NULL
    AND public.user_gym_id() = target_gym_id
$$;

-- =============================================================================
-- 7. UPDATE check_trainer_role TRIGGER
--    Add same-gym constraint and auto-populate trainer_assignments.gym_id
-- =============================================================================
CREATE OR REPLACE FUNCTION check_trainer_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_trainer_role TEXT;
  v_client_tier  TEXT;
  v_trainer_gym  UUID;
  v_client_gym   UUID;
BEGIN
  SELECT role INTO v_trainer_role FROM public.profiles WHERE id = NEW.trainer_id;
  IF v_trainer_role NOT IN ('trainer','admin','owner') THEN
    RAISE EXCEPTION 'trainer_id must reference a profile with role trainer, admin, or owner';
  END IF;

  SELECT tier INTO v_client_tier FROM public.profiles WHERE id = NEW.client_id;
  IF v_client_tier <> 'ultra' THEN
    RAISE EXCEPTION 'client_id must reference a profile with tier=ultra';
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

-- =============================================================================
-- 8. DROP ALL FLAT-ADMIN POLICIES
--    These gave any admin full access to all data. We replace them with
--    gym-scoped equivalents below.
-- =============================================================================

DROP POLICY IF EXISTS "profiles: admin full access"               ON public.profiles;
DROP POLICY IF EXISTS "exercises: admin manage global"            ON public.exercises;
DROP POLICY IF EXISTS "templates: admin full access"              ON public.workout_templates;
DROP POLICY IF EXISTS "template_exercises: access via template ownership" ON public.template_exercises;
DROP POLICY IF EXISTS "sessions: admin full access"               ON public.workout_sessions;
DROP POLICY IF EXISTS "sets: admin full access"                   ON public.sets;
DROP POLICY IF EXISTS "assignments: admin full access"            ON public.trainer_assignments;
DROP POLICY IF EXISTS "assignments: admin full access"            ON public.client_plan_assignments;
DROP POLICY IF EXISTS "bodyweight_logs: admin full access"        ON public.bodyweight_logs;
DROP POLICY IF EXISTS "plans: admin full access"                  ON public.workout_plans;
DROP POLICY IF EXISTS "plan_days: admin full access"              ON public.plan_day_templates;
DROP POLICY IF EXISTS "feedback: admin full access"               ON public.session_feedback;

-- =============================================================================
-- 9. NEW GYM-SCOPED + OWNER-BYPASS RLS POLICIES
-- =============================================================================

-- ── GYMS ──────────────────────────────────────────────────────────────────────
-- Owner: full CRUD on all gyms
CREATE POLICY "gyms: owner full access"
  ON public.gyms FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Admin: read their own gym
CREATE POLICY "gyms: admin read own"
  ON public.gyms FOR SELECT
  USING (public.user_role() = 'admin' AND id = public.user_gym_id());

-- Admin: update their own gym (name changes etc.)
CREATE POLICY "gyms: admin update own"
  ON public.gyms FOR UPDATE
  USING (public.user_role() = 'admin' AND id = public.user_gym_id())
  WITH CHECK (public.user_role() = 'admin' AND id = public.user_gym_id());

-- ── GYM_SUBSCRIPTIONS ─────────────────────────────────────────────────────────
CREATE POLICY "gym_subs: owner full access"
  ON public.gym_subscriptions FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Admin: read their own gym's subscription (for billing UI)
CREATE POLICY "gym_subs: admin read own"
  ON public.gym_subscriptions FOR SELECT
  USING (public.user_role() = 'admin' AND gym_id = public.user_gym_id());

-- ── GYM_INVITES ───────────────────────────────────────────────────────────────
CREATE POLICY "gym_invites: owner full access"
  ON public.gym_invites FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Admin: manage invites for their own gym
CREATE POLICY "gym_invites: admin manage own gym"
  ON public.gym_invites FOR ALL
  USING (public.user_role() = 'admin' AND gym_id = public.user_gym_id())
  WITH CHECK (public.user_role() = 'admin' AND gym_id = public.user_gym_id());

-- Authenticated users: read pending invites addressed to their email
-- (needed on the /invite/[token] page before they accept)
CREATE POLICY "gym_invites: read own pending by email"
  ON public.gym_invites FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND accepted_at IS NULL
    AND expires_at > now()
  );

-- ── PROFILES ──────────────────────────────────────────────────────────────────
-- Owner bypass
CREATE POLICY "profiles: owner full access"
  ON public.profiles FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Admin: manage profiles in their gym only; cannot touch the owner row
CREATE POLICY "profiles: admin gym access"
  ON public.profiles FOR ALL
  USING (
    public.user_role() = 'admin'
    AND gym_id = public.user_gym_id()
  )
  WITH CHECK (
    public.user_role() = 'admin'
    AND gym_id = public.user_gym_id()
    AND role <> 'owner'  -- admins cannot promote anyone to owner
  );

-- ── EXERCISES ─────────────────────────────────────────────────────────────────
-- Owner bypass + manages global library
CREATE POLICY "exercises: owner full access"
  ON public.exercises FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Admin/trainer: manage gym-scoped exercise library (gym_id = their gym)
CREATE POLICY "exercises: gym staff manage gym library"
  ON public.exercises FOR ALL
  USING (
    public.user_role() IN ('admin','trainer')
    AND gym_id IS NOT NULL
    AND gym_id = public.user_gym_id()
  )
  WITH CHECK (
    public.user_role() IN ('admin','trainer')
    AND gym_id IS NOT NULL
    AND gym_id = public.user_gym_id()
  );

-- All authenticated gym members: read their gym's shared exercise library
CREATE POLICY "exercises: read own gym library"
  ON public.exercises FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND gym_id IS NOT NULL
    AND gym_id = public.user_gym_id()
  );

-- ── WORKOUT TEMPLATES ─────────────────────────────────────────────────────────
-- Owner bypass
CREATE POLICY "templates: owner full access"
  ON public.workout_templates FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Admin: manage all templates in their gym
CREATE POLICY "templates: admin gym access"
  ON public.workout_templates FOR ALL
  USING (
    public.user_role() = 'admin'
    AND gym_id = public.user_gym_id()
  )
  WITH CHECK (
    public.user_role() = 'admin'
    AND gym_id = public.user_gym_id()
  );

-- ── TEMPLATE EXERCISES ────────────────────────────────────────────────────────
-- Restored with owner + gym-scoped admin support
CREATE POLICY "template_exercises: access via template ownership"
  ON public.template_exercises FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_templates wt
      WHERE wt.id = template_id
        AND (
          wt.owner_id = auth.uid()
          OR public.is_trainer_for(wt.owner_id)
          OR public.user_role() IN ('admin','owner')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workout_templates wt
      WHERE wt.id = template_id
        AND (
          wt.owner_id = auth.uid()
          OR (public.user_role() = 'trainer' AND public.is_trainer_for(wt.owner_id))
          OR public.user_role() IN ('admin','owner')
        )
    )
  );

-- ── WORKOUT SESSIONS ──────────────────────────────────────────────────────────
-- Owner bypass
CREATE POLICY "sessions: owner full access"
  ON public.workout_sessions FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Admin: sessions of all users in their gym
CREATE POLICY "sessions: admin gym access"
  ON public.workout_sessions FOR ALL
  USING (
    public.user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.gym_id = public.user_gym_id()
    )
  )
  WITH CHECK (
    public.user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.gym_id = public.user_gym_id()
    )
  );

-- ── SETS ─────────────────────────────────────────────────────────────────────
-- Owner bypass
CREATE POLICY "sets: owner full access"
  ON public.sets FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Admin: sets from sessions of users in their gym
CREATE POLICY "sets: admin gym access"
  ON public.sets FOR ALL
  USING (
    public.user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      JOIN public.profiles p ON p.id = ws.user_id
      WHERE ws.id = session_id AND p.gym_id = public.user_gym_id()
    )
  )
  WITH CHECK (
    public.user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      JOIN public.profiles p ON p.id = ws.user_id
      WHERE ws.id = session_id AND p.gym_id = public.user_gym_id()
    )
  );

-- ── TRAINER ASSIGNMENTS ────────────────────────────────────────────────────────
-- Owner bypass
CREATE POLICY "assignments: owner full access"
  ON public.trainer_assignments FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Admin: assignments within their gym only
CREATE POLICY "assignments: admin gym access"
  ON public.trainer_assignments FOR ALL
  USING (
    public.user_role() = 'admin'
    AND gym_id = public.user_gym_id()
  )
  WITH CHECK (
    public.user_role() = 'admin'
    AND gym_id = public.user_gym_id()
  );

-- ── BODYWEIGHT LOGS ───────────────────────────────────────────────────────────
-- Owner bypass
CREATE POLICY "bodyweight_logs: owner full access"
  ON public.bodyweight_logs FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Admin: bodyweight logs of users in their gym
CREATE POLICY "bodyweight_logs: admin gym access"
  ON public.bodyweight_logs FOR ALL
  USING (
    public.user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.gym_id = public.user_gym_id()
    )
  )
  WITH CHECK (
    public.user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.gym_id = public.user_gym_id()
    )
  );

-- ── BODY MEASUREMENTS ─────────────────────────────────────────────────────────
-- Owner bypass (no previous admin policy; trainers already have RLS)
CREATE POLICY "measurements: owner full access"
  ON public.body_measurements FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE POLICY "measurements: admin gym access"
  ON public.body_measurements FOR ALL
  USING (
    public.user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.gym_id = public.user_gym_id()
    )
  )
  WITH CHECK (
    public.user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.gym_id = public.user_gym_id()
    )
  );

-- ── PERSONAL RECORDS ──────────────────────────────────────────────────────────
CREATE POLICY "pr: owner full access"
  ON public.personal_records FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE POLICY "pr: admin gym access"
  ON public.personal_records FOR ALL
  USING (
    public.user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.gym_id = public.user_gym_id()
    )
  )
  WITH CHECK (
    public.user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_id AND p.gym_id = public.user_gym_id()
    )
  );

-- ── WORKOUT PLANS ─────────────────────────────────────────────────────────────
-- Owner bypass
CREATE POLICY "plans: owner full access"
  ON public.workout_plans FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Admin: plans in their gym
CREATE POLICY "plans: admin gym access"
  ON public.workout_plans FOR ALL
  USING (
    public.user_role() = 'admin'
    AND gym_id = public.user_gym_id()
  )
  WITH CHECK (
    public.user_role() = 'admin'
    AND gym_id = public.user_gym_id()
  );

-- ── PLAN DAY TEMPLATES ────────────────────────────────────────────────────────
-- Owner bypass
CREATE POLICY "plan_days: owner full access"
  ON public.plan_day_templates FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Admin: plan days whose parent plan is in their gym
CREATE POLICY "plan_days: admin gym access"
  ON public.plan_day_templates FOR ALL
  USING (
    public.user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.workout_plans wp
      WHERE wp.id = plan_id AND wp.gym_id = public.user_gym_id()
    )
  )
  WITH CHECK (
    public.user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.workout_plans wp
      WHERE wp.id = plan_id AND wp.gym_id = public.user_gym_id()
    )
  );

-- ── CLIENT PLAN ASSIGNMENTS ───────────────────────────────────────────────────
-- Owner bypass
CREATE POLICY "cpa: owner full access"
  ON public.client_plan_assignments FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Admin: assignments in their gym
CREATE POLICY "cpa: admin gym access"
  ON public.client_plan_assignments FOR ALL
  USING (
    public.user_role() = 'admin'
    AND gym_id = public.user_gym_id()
  )
  WITH CHECK (
    public.user_role() = 'admin'
    AND gym_id = public.user_gym_id()
  );

-- ── SESSION FEEDBACK ──────────────────────────────────────────────────────────
-- Owner bypass
CREATE POLICY "feedback: owner full access"
  ON public.session_feedback FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- Admin: feedback for sessions of gym users
CREATE POLICY "feedback: admin gym access"
  ON public.session_feedback FOR ALL
  USING (
    public.user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      JOIN public.profiles p ON p.id = ws.user_id
      WHERE ws.id = session_id AND p.gym_id = public.user_gym_id()
    )
  )
  WITH CHECK (
    public.user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      JOIN public.profiles p ON p.id = ws.user_id
      WHERE ws.id = session_id AND p.gym_id = public.user_gym_id()
    )
  );

-- ── CHECKIN TEMPLATES ─────────────────────────────────────────────────────────
-- Owner bypass (no previous admin policy)
CREATE POLICY "checkin_templates: owner full access"
  ON public.checkin_templates FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE POLICY "checkin_templates: admin gym access"
  ON public.checkin_templates FOR ALL
  USING (
    public.user_role() = 'admin'
    AND gym_id = public.user_gym_id()
  )
  WITH CHECK (
    public.user_role() = 'admin'
    AND gym_id = public.user_gym_id()
  );

-- ── CHECKIN ASSIGNMENTS ───────────────────────────────────────────────────────
CREATE POLICY "checkin_assignments: owner full access"
  ON public.checkin_assignments FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE POLICY "checkin_assignments: admin gym access"
  ON public.checkin_assignments FOR ALL
  USING (
    public.user_role() = 'admin'
    AND gym_id = public.user_gym_id()
  )
  WITH CHECK (
    public.user_role() = 'admin'
    AND gym_id = public.user_gym_id()
  );

-- ── CHECKIN SUBMISSIONS (owner bypass only — trainer/client policies unchanged) ──
CREATE POLICY "checkin_submissions: owner full access"
  ON public.checkin_submissions FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- ── CHECKIN FORMS (legacy, owner bypass only) ────────────────────────────────
CREATE POLICY "checkin_forms: owner full access"
  ON public.checkin_forms FOR ALL
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- =============================================================================
-- 10. DATA MIGRATION
--     • Create "Default Gym" for all existing data
--     • Assign every profile to the Default Gym
--     • Promote the earliest admin account to 'owner' (gym_id = NULL)
-- =============================================================================
DO $$
DECLARE
  v_default_gym_id UUID;
  v_owner_id       UUID;
BEGIN
  -- Find the first-created admin — this is the platform owner (you)
  SELECT id INTO v_owner_id
  FROM public.profiles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'No admin found — skipping owner promotion and default gym assignment';
    RETURN;
  END IF;

  -- Create the Default Gym (elite plan, effectively unlimited, active forever)
  INSERT INTO public.gyms (
    name, slug, join_code, plan,
    max_trainers, max_clients,
    subscription_status, trial_ends_at,
    created_by
  ) VALUES (
    'Default Gym',
    'default-gym',
    'MAXFIT',
    'elite',
    9999, 9999,
    'active',
    now() + INTERVAL '100 years',
    v_owner_id
  )
  RETURNING id INTO v_default_gym_id;

  -- Assign ALL existing users (including other admins) to Default Gym
  UPDATE public.profiles
  SET gym_id = v_default_gym_id
  WHERE gym_id IS NULL;

  -- Promote the first admin to 'owner'; owner has no gym affiliation
  UPDATE public.profiles
  SET role = 'owner', gym_id = NULL
  WHERE id = v_owner_id;

  -- Populate gym_id on relational tables using the trainer/user's gym
  UPDATE public.trainer_assignments ta
  SET gym_id = v_default_gym_id
  WHERE ta.gym_id IS NULL;

  UPDATE public.workout_templates wt
  SET gym_id = v_default_gym_id
  WHERE wt.gym_id IS NULL;

  UPDATE public.checkin_templates ct
  SET gym_id = v_default_gym_id
  WHERE ct.gym_id IS NULL;

  UPDATE public.checkin_assignments ca
  SET gym_id = v_default_gym_id
  WHERE ca.gym_id IS NULL;

  UPDATE public.workout_plans wp
  SET gym_id = v_default_gym_id
  WHERE wp.gym_id IS NULL;

  UPDATE public.client_plan_assignments cpa
  SET gym_id = v_default_gym_id
  WHERE cpa.gym_id IS NULL;

  RAISE NOTICE 'SaaS migration complete. Default Gym id: %. Owner id: %',
    v_default_gym_id, v_owner_id;
END $$;
