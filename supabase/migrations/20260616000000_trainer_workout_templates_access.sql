-- Trainers can now create/manage workout templates and workout plans from the
-- admin portal, using the same /templates and /my-plans pages as admins but
-- with narrower data visibility (own + gym-shared only).
--
-- New visibility value 'gym': template is shared with all trainers/admins in
-- the same gym. Only the creator can edit or delete; others can read and use
-- it in their plans.

-- ── 1. Extend workout_templates.visibility CHECK constraint ───────────────────
ALTER TABLE public.workout_templates
  DROP CONSTRAINT IF EXISTS workout_templates_visibility_check;

ALTER TABLE public.workout_templates
  ADD CONSTRAINT workout_templates_visibility_check
  CHECK (visibility IN ('private', 'free', 'paid', 'ultra', 'gym'));

-- ── 2. Trainer SELECT: own templates ─────────────────────────────────────────
CREATE POLICY "templates: trainer read own"
  ON public.workout_templates FOR SELECT
  USING (
    public.user_role() = 'trainer'
    AND owner_id = auth.uid()
  );

-- ── 3. Trainer SELECT: gym-shared templates from other gym staff ──────────────
CREATE POLICY "templates: trainer read gym shared"
  ON public.workout_templates FOR SELECT
  USING (
    public.user_role() = 'trainer'
    AND visibility = 'gym'
    AND gym_id = public.user_gym_id()
  );

-- ── 4. Trainer INSERT: own templates ─────────────────────────────────────────
CREATE POLICY "templates: trainer insert own"
  ON public.workout_templates FOR INSERT
  WITH CHECK (
    public.user_role() = 'trainer'
    AND owner_id = auth.uid()
    AND assigned_by IS NULL
  );

-- ── 5. Trainer UPDATE: own templates only (shared templates are read-only) ────
CREATE POLICY "templates: trainer update own"
  ON public.workout_templates FOR UPDATE
  USING (
    public.user_role() = 'trainer'
    AND owner_id = auth.uid()
  )
  WITH CHECK (
    public.user_role() = 'trainer'
    AND owner_id = auth.uid()
  );

-- ── 6. Trainer DELETE: own templates only ─────────────────────────────────────
CREATE POLICY "templates: trainer delete own"
  ON public.workout_templates FOR DELETE
  USING (
    public.user_role() = 'trainer'
    AND owner_id = auth.uid()
  );

-- ── 7. Profiles: trainer reads other gym staff (for "Created By" column) ──────
-- Without this, creatorName() in TemplatesAdminView falls back to the short
-- UUID for templates owned by other trainers/admins in the same gym.
CREATE POLICY "profiles: trainer read same gym staff"
  ON public.profiles FOR SELECT
  USING (
    public.user_role() = 'trainer'
    AND gym_id = public.user_gym_id()
    AND role IN ('trainer', 'admin')
  );
