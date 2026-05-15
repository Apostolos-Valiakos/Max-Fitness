-- =============================================================================
--  Add bodyweight_logs table
-- =============================================================================

CREATE TABLE public.bodyweight_logs (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date       DATE        NOT NULL,
  kg         NUMERIC(5,2) NOT NULL CHECK (kg > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bodyweight_logs_user_date_unique UNIQUE (user_id, date)
);

CREATE INDEX idx_bwl_user_date ON public.bodyweight_logs(user_id, date DESC);

ALTER TABLE public.bodyweight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bodyweight_logs: users manage own"
  ON public.bodyweight_logs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bodyweight_logs: trainers read client logs"
  ON public.bodyweight_logs FOR SELECT
  USING (public.user_role() = 'trainer' AND public.is_trainer_for(user_id));

CREATE POLICY "bodyweight_logs: admin full access"
  ON public.bodyweight_logs FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');
