-- ══════════════════════════════════════════════════════════════════════════════
-- Features v2: rest timer, supersets, PRs, measurements, check-ins,
--              subscriptions, plate config, preferred unit / bar weight
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. template_exercises: superset group + per-exercise rest override ────────

ALTER TABLE public.template_exercises
  ADD COLUMN IF NOT EXISTS superset_group  INTEGER     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rest_seconds    INTEGER     DEFAULT NULL;

-- ─── 2. profiles: user preferences ──────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_unit  TEXT        DEFAULT 'kg'  CHECK (preferred_unit IN ('kg','lbs')),
  ADD COLUMN IF NOT EXISTS bar_weight_kg   NUMERIC(5,2) DEFAULT 20,
  ADD COLUMN IF NOT EXISTS plate_config    JSONB       DEFAULT NULL;

-- ─── 3. personal_records ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.personal_records (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id   UUID        NOT NULL,
  metric        TEXT        NOT NULL CHECK (metric IN ('weight_kg','e1rm','volume')),
  value         NUMERIC     NOT NULL,
  achieved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id    UUID        REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS personal_records_user_exercise ON public.personal_records(user_id, exercise_id, metric);
CREATE INDEX IF NOT EXISTS personal_records_updated_at    ON public.personal_records(updated_at);

ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pr: users manage own" ON public.personal_records
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── 4. body_measurements ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.body_measurements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_at     DATE        NOT NULL DEFAULT CURRENT_DATE,
  weight_kg       NUMERIC(6,2) DEFAULT NULL,
  body_fat_pct    NUMERIC(5,2) DEFAULT NULL,
  chest_cm        NUMERIC(6,2) DEFAULT NULL,
  waist_cm        NUMERIC(6,2) DEFAULT NULL,
  hips_cm         NUMERIC(6,2) DEFAULT NULL,
  left_arm_cm     NUMERIC(6,2) DEFAULT NULL,
  right_arm_cm    NUMERIC(6,2) DEFAULT NULL,
  left_thigh_cm   NUMERIC(6,2) DEFAULT NULL,
  right_thigh_cm  NUMERIC(6,2) DEFAULT NULL,
  notes           TEXT        DEFAULT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS body_measurements_user_date ON public.body_measurements(user_id, measured_at);
CREATE INDEX IF NOT EXISTS body_measurements_updated_at ON public.body_measurements(updated_at);

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "measurements: users manage own" ON public.body_measurements
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── 5. checkin_forms ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.checkin_forms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  questions   JSONB       NOT NULL DEFAULT '[]',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkin_forms_trainer ON public.checkin_forms(trainer_id);
CREATE INDEX IF NOT EXISTS checkin_forms_client  ON public.checkin_forms(client_id);

ALTER TABLE public.checkin_forms ENABLE ROW LEVEL SECURITY;

-- Trainer can manage their own forms; client can read their forms
CREATE POLICY "checkin_forms: trainer manage" ON public.checkin_forms
  FOR ALL USING (trainer_id = auth.uid()) WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "checkin_forms: client read" ON public.checkin_forms
  FOR SELECT USING (client_id = auth.uid());

-- ─── 6. checkin_responses ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.checkin_responses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     UUID        NOT NULL REFERENCES public.checkin_forms(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers     JSONB       NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkin_responses_form    ON public.checkin_responses(form_id);
CREATE INDEX IF NOT EXISTS checkin_responses_client  ON public.checkin_responses(client_id);

ALTER TABLE public.checkin_responses ENABLE ROW LEVEL SECURITY;

-- Client can manage their own responses; trainer can read their clients' responses
CREATE POLICY "checkin_responses: client manage" ON public.checkin_responses
  FOR ALL USING (client_id = auth.uid()) WITH CHECK (client_id = auth.uid());

CREATE POLICY "checkin_responses: trainer read" ON public.checkin_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.checkin_forms f
      WHERE f.id = form_id AND f.trainer_id = auth.uid()
    )
  );

-- ─── 7. subscriptions ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT        DEFAULT NULL,
  stripe_subscription_id  TEXT        DEFAULT NULL,
  tier                    TEXT        NOT NULL DEFAULT 'free' CHECK (tier IN ('free','paid','ultra')),
  status                  TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','canceled','past_due','trialing')),
  current_period_end      TIMESTAMPTZ DEFAULT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user ON public.subscriptions(user_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription; only service role (webhooks) can write
CREATE POLICY "subscriptions: user read own" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- ─── 8. workout_sessions: mark as completed ──────────────────────────────────

ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT false;

-- ─── 9. Helper function: user streak (consecutive completed workout days) ─────

CREATE OR REPLACE FUNCTION public.get_workout_streak(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_streak   INTEGER := 0;
  v_date     DATE;
  v_prev     DATE := CURRENT_DATE + 1; -- sentinel: tomorrow
  rec        RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT date_trunc('day', started_at AT TIME ZONE 'UTC')::DATE AS workout_date
    FROM public.workout_sessions
    WHERE user_id = p_user_id
      AND is_completed = true
      AND finished_at IS NOT NULL
    ORDER BY workout_date DESC
  LOOP
    v_date := rec.workout_date;
    IF v_prev - v_date <= 1 THEN
      v_streak := v_streak + 1;
      v_prev   := v_date;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN v_streak;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workout_streak(UUID) TO authenticated;

-- ─── 10. Helper function: program compliance score ────────────────────────────

-- Returns % of weeks (over last N weeks) where the client completed at least
-- one workout, weighted by trainer_assignments.weekly_sessions_target
CREATE OR REPLACE FUNCTION public.get_compliance_score(
  p_trainer_id  UUID,
  p_client_id   UUID,
  p_weeks       INTEGER DEFAULT 4
)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target   INTEGER;
  v_score    NUMERIC;
BEGIN
  SELECT COALESCE(weekly_sessions_target, 3)
    INTO v_target
    FROM public.trainer_assignments
   WHERE trainer_id = p_trainer_id AND client_id = p_client_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT ROUND(
    100.0 * COUNT(DISTINCT week_sessions.iso_week) /
    NULLIF(p_weeks, 0)
  )
    INTO v_score
    FROM (
      SELECT
        date_trunc('week', started_at AT TIME ZONE 'UTC') AS iso_week,
        COUNT(*) AS sessions_in_week
      FROM public.workout_sessions
      WHERE user_id   = p_client_id
        AND is_completed = true
        AND finished_at IS NOT NULL
        AND started_at >= now() - (p_weeks || ' weeks')::INTERVAL
      GROUP BY 1
      HAVING COUNT(*) >= v_target
    ) week_sessions;

  RETURN COALESCE(v_score, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_compliance_score(UUID, UUID, INTEGER) TO authenticated;
