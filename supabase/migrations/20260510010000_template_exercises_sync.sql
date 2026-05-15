-- Add updated_at + deleted to template_exercises for RxDB checkpoint replication
ALTER TABLE public.template_exercises
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN deleted     BOOLEAN     NOT NULL DEFAULT false;

CREATE INDEX idx_te_sync ON public.template_exercises(updated_at ASC, id ASC);

CREATE TRIGGER trg_template_exercises_updated_at
  BEFORE UPDATE ON public.template_exercises
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
