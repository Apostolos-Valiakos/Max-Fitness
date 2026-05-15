-- =============================================================================
--  MAX FITNESS — Complete Database Schema
-- =============================================================================

-- =============================================================================
--  1. EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;

-- =============================================================================
--  2. ENUMS
-- =============================================================================
CREATE TYPE user_role AS ENUM ('user', 'trainer', 'admin');
CREATE TYPE user_tier AS ENUM ('free', 'paid', 'ultra');
CREATE TYPE set_type   AS ENUM ('warmup', 'working', 'failure', 'drop', 'myorep');
CREATE TYPE equipment_type AS ENUM (
  'barbell', 'dumbbell', 'cable', 'machine',
  'bodyweight', 'kettlebell', 'band', 'other'
);
CREATE TYPE body_part AS ENUM (
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'forearms', 'quads', 'hamstrings', 'glutes',
  'calves', 'core', 'full_body'
);

-- =============================================================================
--  3. TABLES
-- =============================================================================

CREATE TABLE public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        user_role   NOT NULL DEFAULT 'user',
  tier        user_tier   NOT NULL DEFAULT 'free',
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.exercises (
  id           UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT           NOT NULL,
  body_part    body_part      NOT NULL,
  equipment    equipment_type NOT NULL,
  image_url    TEXT,
  instructions TEXT,
  is_custom    BOOLEAN        NOT NULL DEFAULT false,
  created_by   UUID           REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT exercises_name_equipment_creator_unique
    UNIQUE NULLS NOT DISTINCT (name, equipment, created_by)
);

CREATE TABLE public.trainer_assignments (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT no_self_assignment   CHECK (trainer_id <> client_id),
  CONSTRAINT trainer_client_unique UNIQUE (trainer_id, client_id)
);

CREATE TABLE public.workout_templates (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  notes       TEXT,
  is_public   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.template_exercises (
  id          UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID     NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  exercise_id UUID     NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  position    SMALLINT NOT NULL DEFAULT 0,
  target_sets SMALLINT,
  target_reps SMALLINT,
  target_rpe  NUMERIC(3,1) CHECK (target_rpe BETWEEN 1 AND 10),
  notes       TEXT
);

CREATE TABLE public.workout_sessions (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id    UUID        REFERENCES public.workout_templates(id) ON DELETE SET NULL,
  name           TEXT        NOT NULL,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ,
  duration_secs  INT GENERATED ALWAYS AS (
                   EXTRACT(EPOCH FROM (finished_at - started_at))::INT
                 ) STORED,
  bodyweight_kg  NUMERIC(5,2),
  notes          TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted        BOOLEAN     NOT NULL DEFAULT false
);

CREATE TABLE public.sets (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID        NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id   UUID        NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  set_number    SMALLINT    NOT NULL,
  set_type      set_type    NOT NULL DEFAULT 'working',
  weight_kg     NUMERIC(6,2),
  reps          SMALLINT,
  rpe           NUMERIC(3,1) CHECK (rpe BETWEEN 1 AND 10),
  duration_secs INT,
  distance_m    NUMERIC(8,2),
  notes         TEXT,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted       BOOLEAN     NOT NULL DEFAULT false
);

-- =============================================================================
--  4. INDEXES
-- =============================================================================
CREATE INDEX idx_exercises_body_part  ON public.exercises(body_part);
CREATE INDEX idx_exercises_equipment  ON public.exercises(equipment);
CREATE INDEX idx_exercises_created_by ON public.exercises(created_by);
CREATE INDEX idx_ta_trainer_id ON public.trainer_assignments(trainer_id);
CREATE INDEX idx_ta_client_id  ON public.trainer_assignments(client_id);
CREATE INDEX idx_wt_owner_id ON public.workout_templates(owner_id);
CREATE INDEX idx_te_template_id ON public.template_exercises(template_id);
CREATE INDEX idx_ws_user_id    ON public.workout_sessions(user_id);
CREATE INDEX idx_ws_started_at ON public.workout_sessions(started_at DESC);
CREATE INDEX idx_ws_sync ON public.workout_sessions(user_id, updated_at DESC) WHERE deleted = false;
CREATE INDEX idx_sets_session_id  ON public.sets(session_id);
CREATE INDEX idx_sets_exercise_id ON public.sets(exercise_id);
CREATE INDEX idx_sets_sync        ON public.sets(session_id, updated_at DESC) WHERE deleted = false;

-- =============================================================================
--  5. FUNCTIONS & TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_exercises_updated_at BEFORE UPDATE ON public.exercises FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_templates_updated_at BEFORE UPDATE ON public.workout_templates FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_sessions_updated_at BEFORE UPDATE ON public.workout_sessions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_sets_updated_at BEFORE UPDATE ON public.sets FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.user_tier()
RETURNS user_tier LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tier FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_trainer_for(client_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trainer_assignments
    WHERE trainer_id  = auth.uid()
      AND trainer_assignments.client_id = is_trainer_for.client_id
      AND is_active   = true
  )
$$;

CREATE OR REPLACE FUNCTION check_trainer_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = NEW.trainer_id) <> 'trainer' THEN
    RAISE EXCEPTION 'trainer_id must reference a profile with role=trainer';
  END IF;
  IF (SELECT tier FROM public.profiles WHERE id = NEW.client_id) <> 'ultra' THEN
    RAISE EXCEPTION 'client_id must reference a profile with tier=ultra';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_trainer_assignment_roles
  BEFORE INSERT OR UPDATE ON public.trainer_assignments
  FOR EACH ROW EXECUTE FUNCTION check_trainer_role();

-- =============================================================================
--  6. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_exercises  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_assignments ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles: users read own" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles: users update own" ON public.profiles FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND tier = (SELECT tier FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "profiles: trainers read assigned clients" ON public.profiles FOR SELECT USING (public.user_role() = 'trainer' AND public.is_trainer_for(id));
CREATE POLICY "profiles: admin full access" ON public.profiles FOR ALL USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- Exercises
CREATE POLICY "exercises: read global library" ON public.exercises FOR SELECT USING (auth.role() = 'authenticated' AND created_by IS NULL);
CREATE POLICY "exercises: users manage own custom" ON public.exercises FOR ALL USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "exercises: admin manage global" ON public.exercises FOR ALL USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- Templates
CREATE POLICY "templates: users read own" ON public.workout_templates FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "templates: users insert own" ON public.workout_templates FOR INSERT WITH CHECK (owner_id = auth.uid() AND (public.user_tier() <> 'free' OR (SELECT COUNT(*) FROM public.workout_templates WHERE owner_id = auth.uid()) < 3));
CREATE POLICY "templates: users update own" ON public.workout_templates FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "templates: users delete own" ON public.workout_templates FOR DELETE USING (owner_id = auth.uid());
CREATE POLICY "templates: trainers read client templates" ON public.workout_templates FOR SELECT USING (public.user_role() = 'trainer' AND public.is_trainer_for(owner_id));
CREATE POLICY "templates: trainers assign to clients" ON public.workout_templates FOR INSERT WITH CHECK (public.user_role() = 'trainer' AND public.is_trainer_for(owner_id) AND assigned_by = auth.uid());
CREATE POLICY "templates: trainers update assigned" ON public.workout_templates FOR UPDATE USING (public.user_role() = 'trainer' AND assigned_by = auth.uid() AND public.is_trainer_for(owner_id)) WITH CHECK (assigned_by = auth.uid());
CREATE POLICY "templates: admin full access" ON public.workout_templates FOR ALL USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- Template Exercises
CREATE POLICY "template_exercises: access via template ownership" ON public.template_exercises FOR ALL USING (EXISTS (SELECT 1 FROM public.workout_templates wt WHERE wt.id = template_id AND (wt.owner_id = auth.uid() OR public.is_trainer_for(wt.owner_id) OR public.user_role() = 'admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.workout_templates wt WHERE wt.id = template_id AND (wt.owner_id = auth.uid() OR (public.user_role() = 'trainer' AND public.is_trainer_for(wt.owner_id)) OR public.user_role() = 'admin')));

-- Sessions
CREATE POLICY "sessions: users manage own" ON public.workout_sessions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "sessions: trainers read client sessions" ON public.workout_sessions FOR SELECT USING (public.user_role() = 'trainer' AND public.is_trainer_for(user_id));
CREATE POLICY "sessions: admin full access" ON public.workout_sessions FOR ALL USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- Sets
CREATE POLICY "sets: users manage own via session" ON public.sets FOR ALL USING (EXISTS (SELECT 1 FROM public.workout_sessions ws WHERE ws.id = session_id AND ws.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.workout_sessions ws WHERE ws.id = session_id AND ws.user_id = auth.uid()));
CREATE POLICY "sets: trainers read client sets" ON public.sets FOR SELECT USING (public.user_role() = 'trainer' AND EXISTS (SELECT 1 FROM public.workout_sessions ws WHERE ws.id = session_id AND public.is_trainer_for(ws.user_id)));
CREATE POLICY "sets: admin full access" ON public.sets FOR ALL USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- Assignments
CREATE POLICY "assignments: trainers read own" ON public.trainer_assignments FOR SELECT USING (trainer_id = auth.uid() AND public.user_role() = 'trainer');
CREATE POLICY "assignments: clients read own" ON public.trainer_assignments FOR SELECT USING (client_id = auth.uid() AND public.user_tier() = 'ultra');
CREATE POLICY "assignments: admin full access" ON public.trainer_assignments FOR ALL USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- =============================================================================
--  7. EXERCISE SEED DATA
-- =============================================================================
INSERT INTO public.exercises (name, body_part, equipment, is_custom, created_by) VALUES
  ('Barbell Bench Press', 'chest', 'barbell', false, NULL),
  ('Pull-Up', 'back', 'bodyweight', false, NULL),
  ('Overhead Press', 'shoulders', 'barbell', false, NULL),
  ('Barbell Curl', 'biceps', 'barbell', false, NULL),
  ('Close Grip Bench Press', 'triceps', 'barbell', false, NULL),
  ('Barbell Squat', 'quads', 'barbell', false, NULL),
  ('Romanian Deadlift', 'hamstrings', 'barbell', false, NULL),
  ('Hip Thrust', 'glutes', 'barbell', false, NULL),
  ('Standing Calf Raise', 'calves', 'machine', false, NULL),
  ('Plank', 'core', 'bodyweight', false, NULL),
  ('Power Clean', 'full_body', 'barbell', false, NULL)
ON CONFLICT DO NOTHING;
