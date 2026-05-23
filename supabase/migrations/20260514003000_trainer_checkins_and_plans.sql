-- ═══════════════════════════════════════════════════════════════════════════════
-- Trainer check-ins + plan assignments
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. checkin_templates ─────────────────────────────────────────────────────
-- Trainer-owned reusable question sets.
-- questions: JSONB array of { id, type, label, required, config }
-- Built-in types: weight | scale | adherence | free_text | number | photo | yes_no
-- Custom types: same type list, trainer-defined label

CREATE TABLE IF NOT EXISTS public.checkin_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  questions   JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkin_templates_trainer ON public.checkin_templates(trainer_id);

ALTER TABLE public.checkin_templates ENABLE ROW LEVEL SECURITY;

-- Trainer: full CRUD on own templates
CREATE POLICY "checkin_templates: trainer owns"
  ON public.checkin_templates FOR ALL
  USING  (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

-- ─── 2. checkin_assignments ───────────────────────────────────────────────────
-- Links a template to a client with a schedule.
-- frequency: weekly | biweekly | monthly | manual
-- day_of_week: 0 (Sun) – 6 (Sat) used for weekly/biweekly display hints only
-- next_due_at: computed by trigger on each submission insert
-- Missed submissions stay open until submitted (no expiry)

CREATE TABLE IF NOT EXISTS public.checkin_assignments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  UUID        NOT NULL REFERENCES public.checkin_templates(id) ON DELETE CASCADE,
  client_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  frequency    TEXT        NOT NULL DEFAULT 'weekly'
                           CHECK (frequency IN ('weekly','biweekly','monthly','manual')),
  day_of_week  SMALLINT    CHECK (day_of_week BETWEEN 0 AND 6),
  next_due_at  TIMESTAMPTZ,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkin_assignments_client  ON public.checkin_assignments(client_id);
CREATE INDEX IF NOT EXISTS checkin_assignments_trainer ON public.checkin_assignments(trainer_id);

ALTER TABLE public.checkin_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkin_assignments: trainer owns"
  ON public.checkin_assignments FOR ALL
  USING  (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "checkin_assignments: client reads own"
  ON public.checkin_assignments FOR SELECT
  USING (client_id = auth.uid());

-- Client: read-only on templates they are actively assigned to
-- (placed here because it references checkin_assignments which is now created above)
CREATE POLICY "checkin_templates: client reads assigned"
  ON public.checkin_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.checkin_assignments ca
      WHERE ca.template_id = checkin_templates.id
        AND ca.client_id   = auth.uid()
        AND ca.is_active   = true
    )
  );

-- ─── 3. checkin_submissions ───────────────────────────────────────────────────
-- One row per client submission.
-- answers: { "<question_id>": <value> }  — value type matches question type
-- photo_urls: up to 5 Supabase Storage paths (enforced at app level)
-- is_read: trainer has opened and read the submission (badge counter)
-- photos_deleted: set to true by trigger when trainer_reply is first written
--   App MUST delete storage files before the UPDATE that sets trainer_reply.

CREATE TABLE IF NOT EXISTS public.checkin_submissions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id      UUID        NOT NULL REFERENCES public.checkin_assignments(id) ON DELETE CASCADE,
  client_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers            JSONB       NOT NULL DEFAULT '{}',
  photo_urls         TEXT[]      NOT NULL DEFAULT '{}',
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  trainer_reply      TEXT,
  trainer_replied_at TIMESTAMPTZ,
  is_read            BOOLEAN     NOT NULL DEFAULT false,
  photos_deleted     BOOLEAN     NOT NULL DEFAULT false,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkin_submissions_assignment ON public.checkin_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS checkin_submissions_client     ON public.checkin_submissions(client_id);
CREATE INDEX IF NOT EXISTS checkin_submissions_trainer    ON public.checkin_submissions(trainer_id);
CREATE INDEX IF NOT EXISTS checkin_submissions_submitted  ON public.checkin_submissions(submitted_at DESC);

ALTER TABLE public.checkin_submissions ENABLE ROW LEVEL SECURITY;

-- Client: submit and read own submissions
CREATE POLICY "checkin_submissions: client inserts own"
  ON public.checkin_submissions FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "checkin_submissions: client reads own"
  ON public.checkin_submissions FOR SELECT
  USING (client_id = auth.uid());

-- Trainer: read all submissions from their clients, update for reply + is_read
CREATE POLICY "checkin_submissions: trainer reads clients"
  ON public.checkin_submissions FOR SELECT
  USING (trainer_id = auth.uid());

CREATE POLICY "checkin_submissions: trainer updates"
  ON public.checkin_submissions FOR UPDATE
  USING  (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

-- ─── 4. trainer_plan_assignments ─────────────────────────────────────────────
-- Decouples plan authorship from client assignment.
-- Allows the same workout_template to be assigned to many clients.
-- When is_active = false the client sees the plan as archived in "My Program".
-- The template itself is never copied — clients always read the live version
-- so trainer edits are reflected automatically (requirement: auto-update).

CREATE TABLE IF NOT EXISTS public.trainer_plan_assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID        NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  client_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  starts_at   DATE,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trainer_plan_assignments_client   ON public.trainer_plan_assignments(client_id);
CREATE INDEX IF NOT EXISTS trainer_plan_assignments_trainer  ON public.trainer_plan_assignments(trainer_id);
CREATE INDEX IF NOT EXISTS trainer_plan_assignments_template ON public.trainer_plan_assignments(template_id);

ALTER TABLE public.trainer_plan_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer_plan_assignments: trainer owns"
  ON public.trainer_plan_assignments FOR ALL
  USING  (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "trainer_plan_assignments: client reads own"
  ON public.trainer_plan_assignments FOR SELECT
  USING (client_id = auth.uid());

-- Allow clients to read workout_templates assigned to them by a trainer
-- (in addition to public/own templates already covered by existing policies)
CREATE POLICY "workout_templates: client reads trainer-assigned"
  ON public.workout_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trainer_plan_assignments tpa
      WHERE tpa.template_id = workout_templates.id
        AND tpa.client_id   = auth.uid()
        AND tpa.is_active   = true
    )
  );

-- ─── 5. Supabase Storage bucket: checkin-photos ───────────────────────────────
-- Private bucket. Path convention: {client_id}/{submission_id}/{filename}
-- Max 5 photos per submission enforced at app level.
-- Photos are deleted by the app when the trainer submits their reply,
-- after which the trigger (below) zeroes out photo_urls in the DB.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'checkin-photos',
  'checkin-photos',
  false,
  5242880,  -- 5 MB per file
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
) ON CONFLICT (id) DO NOTHING;

-- Client: upload to their own folder only
CREATE POLICY "checkin-photos: client uploads own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'checkin-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Client: read their own photos
CREATE POLICY "checkin-photos: client reads own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'checkin-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Trainer: read photos of their assigned clients
CREATE POLICY "checkin-photos: trainer reads client photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'checkin-photos'
    AND EXISTS (
      SELECT 1 FROM public.checkin_assignments ca
      WHERE ca.client_id  = ((storage.foldername(name))[1])::uuid
        AND ca.trainer_id = auth.uid()
    )
  );

-- Trainer: delete photos after review
CREATE POLICY "checkin-photos: trainer deletes after review"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'checkin-photos'
    AND EXISTS (
      SELECT 1 FROM public.checkin_assignments ca
      WHERE ca.client_id  = ((storage.foldername(name))[1])::uuid
        AND ca.trainer_id = auth.uid()
    )
  );

-- ─── 6. Trigger: advance next_due_at after each submission ────────────────────
-- Weekly   → +7 days from current next_due_at
-- Biweekly → +14 days; first submission uses submitted_at as reference
-- Monthly  → +1 month from current next_due_at
-- Manual   → next_due_at stays NULL (trainer sends manually each time)

CREATE OR REPLACE FUNCTION public.advance_checkin_next_due()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_freq     TEXT;
  v_due      TIMESTAMPTZ;
  v_is_first BOOLEAN;
BEGIN
  SELECT frequency, next_due_at
  INTO   v_freq, v_due
  FROM   public.checkin_assignments
  WHERE  id = NEW.assignment_id;

  -- Is this the first submission for this assignment?
  SELECT NOT EXISTS (
    SELECT 1 FROM public.checkin_submissions
    WHERE  assignment_id = NEW.assignment_id
      AND  id            != NEW.id
  ) INTO v_is_first;

  CASE v_freq
    WHEN 'weekly' THEN
      v_due := COALESCE(v_due, NEW.submitted_at) + INTERVAL '7 days';

    WHEN 'biweekly' THEN
      -- First submission anchors the biweekly cycle to submitted_at
      IF v_is_first THEN
        v_due := NEW.submitted_at + INTERVAL '14 days';
      ELSE
        v_due := COALESCE(v_due, NEW.submitted_at) + INTERVAL '14 days';
      END IF;

    WHEN 'monthly' THEN
      v_due := COALESCE(v_due, NEW.submitted_at) + INTERVAL '1 month';

    WHEN 'manual' THEN
      v_due := NULL;  -- trainer sends the next one manually

    ELSE
      v_due := NULL;
  END CASE;

  UPDATE public.checkin_assignments
  SET    next_due_at = v_due,
         updated_at  = now()
  WHERE  id = NEW.assignment_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_checkin_submission_inserted
  AFTER INSERT ON public.checkin_submissions
  FOR EACH ROW EXECUTE FUNCTION public.advance_checkin_next_due();

-- ─── 7. Trigger: clear photo_urls once trainer replies ────────────────────────
-- Fires BEFORE UPDATE so the cleared values are written in the same transaction.
-- IMPORTANT: the app must call storage.remove() on all photo_urls BEFORE
-- issuing this UPDATE, otherwise files will be orphaned in the bucket.
-- After this trigger fires, photo_urls = '{}' and photos_deleted = true.
-- The UI should display: "Photos were deleted after review was completed."

CREATE OR REPLACE FUNCTION public.clear_photos_after_reply()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only fires when trainer_reply transitions from NULL → non-NULL
  IF NEW.trainer_reply IS NOT NULL AND OLD.trainer_reply IS NULL THEN
    NEW.photo_urls         := '{}';
    NEW.photos_deleted     := true;
    NEW.trainer_replied_at := now();
    NEW.updated_at         := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_checkin_reply_submitted
  BEFORE UPDATE ON public.checkin_submissions
  FOR EACH ROW EXECUTE FUNCTION public.clear_photos_after_reply();
