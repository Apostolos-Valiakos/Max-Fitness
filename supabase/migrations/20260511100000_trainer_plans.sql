-- ─────────────────────────────────────────────────────────────────────────────
--  Trainer Plans Feature
--  • workout_plans            — a trainer's weekly program
--  • plan_day_templates       — template per day-of-week within a plan
--  • client_plan_assignments  — assigns a plan to a client
--  • session_feedback         — trainer note on a completed session
--  • workout_templates.visibility — public template visibility by tier
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. workout_plans ──────────────────────────────────────────────────────────
CREATE TABLE public.workout_plans (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wp_trainer ON public.workout_plans(trainer_id);
ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_workout_plans_updated_at
  BEFORE UPDATE ON public.workout_plans
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── 2. plan_day_templates ─────────────────────────────────────────────────────
-- day_of_week: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
CREATE TABLE public.plan_day_templates (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      UUID     NOT NULL REFERENCES public.workout_plans(id)   ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  template_id  UUID     NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  UNIQUE (plan_id, day_of_week)
);

CREATE INDEX idx_pdt_plan ON public.plan_day_templates(plan_id);
ALTER TABLE public.plan_day_templates ENABLE ROW LEVEL SECURITY;

-- ── 3. client_plan_assignments ────────────────────────────────────────────────
CREATE TABLE public.client_plan_assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID        NOT NULL REFERENCES public.workout_plans(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  trainer_id  UUID        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, client_id)
);

CREATE INDEX idx_cpa_client  ON public.client_plan_assignments(client_id);
CREATE INDEX idx_cpa_trainer ON public.client_plan_assignments(trainer_id);
ALTER TABLE public.client_plan_assignments ENABLE ROW LEVEL SECURITY;

-- ── 4. session_feedback ───────────────────────────────────────────────────────
CREATE TABLE public.session_feedback (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID        NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  trainer_id UUID        NOT NULL REFERENCES public.profiles(id)         ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, trainer_id)
);

ALTER TABLE public.session_feedback ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_session_feedback_updated_at
  BEFORE UPDATE ON public.session_feedback
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── 5. workout_templates: add visibility column ───────────────────────────────
ALTER TABLE public.workout_templates
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'free', 'paid', 'ultra'));

-- ── RLS: workout_plans ────────────────────────────────────────────────────────
CREATE POLICY "plans: admin full access" ON public.workout_plans
  USING (user_role() = 'admin')
  WITH CHECK (user_role() = 'admin');

CREATE POLICY "plans: trainer manage own" ON public.workout_plans
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "plans: clients read assigned" ON public.workout_plans
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.client_plan_assignments cpa
    WHERE cpa.plan_id   = workout_plans.id
      AND cpa.client_id = auth.uid()
      AND cpa.is_active = true
  ));

-- ── RLS: plan_day_templates ───────────────────────────────────────────────────
CREATE POLICY "plan_days: admin full access" ON public.plan_day_templates
  USING (user_role() = 'admin')
  WITH CHECK (user_role() = 'admin');

CREATE POLICY "plan_days: trainer manage own" ON public.plan_day_templates
  USING (EXISTS (
    SELECT 1 FROM public.workout_plans wp
    WHERE wp.id = plan_day_templates.plan_id AND wp.trainer_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workout_plans wp
    WHERE wp.id = plan_day_templates.plan_id AND wp.trainer_id = auth.uid()
  ));

CREATE POLICY "plan_days: clients read assigned" ON public.plan_day_templates
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.client_plan_assignments cpa
    WHERE cpa.plan_id   = plan_day_templates.plan_id
      AND cpa.client_id = auth.uid()
      AND cpa.is_active = true
  ));

-- ── RLS: client_plan_assignments ──────────────────────────────────────────────
CREATE POLICY "assignments: admin full access" ON public.client_plan_assignments
  USING (user_role() = 'admin')
  WITH CHECK (user_role() = 'admin');

CREATE POLICY "assignments: trainer manage own" ON public.client_plan_assignments
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "assignments: clients read own" ON public.client_plan_assignments
  FOR SELECT USING (client_id = auth.uid());

-- ── RLS: session_feedback ─────────────────────────────────────────────────────
CREATE POLICY "feedback: admin full access" ON public.session_feedback
  USING (user_role() = 'admin')
  WITH CHECK (user_role() = 'admin');

CREATE POLICY "feedback: trainer manage own" ON public.session_feedback
  USING (trainer_id = auth.uid())
  WITH CHECK (
    trainer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workout_sessions ws
      WHERE ws.id = session_feedback.session_id AND is_trainer_for(ws.user_id)
    )
  );

CREATE POLICY "feedback: clients read own sessions" ON public.session_feedback
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.workout_sessions ws
    WHERE ws.id = session_feedback.session_id AND ws.user_id = auth.uid()
  ));

-- ── RLS: workout_templates — add public & plan-access policies ────────────────
CREATE POLICY "templates: users read public" ON public.workout_templates
  FOR SELECT USING (
    visibility = 'free'
    OR (visibility = 'paid'  AND user_tier() IN ('paid', 'ultra'))
    OR (visibility = 'ultra' AND user_tier() = 'ultra')
  );

CREATE POLICY "templates: clients read from active plans" ON public.workout_templates
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.plan_day_templates pdt
    JOIN public.client_plan_assignments cpa ON cpa.plan_id = pdt.plan_id
    WHERE pdt.template_id = workout_templates.id
      AND cpa.client_id   = auth.uid()
      AND cpa.is_active   = true
  ));
