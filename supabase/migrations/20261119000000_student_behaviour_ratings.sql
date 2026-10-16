-- ============================================================================
-- Per-student behaviour and co-curricular ratings
-- ---------------------------------------------------------------------------
-- The Uganda progress report prints a BEHAVIOUR & CO-CURRICULAR grid -- four
-- skills rated 1-5 per pupil, per term. Nothing could ever be written there:
--
--   behaviour_logs            records incidents, not a term rating
--   co_curricular_activities  records activities offered, not a pupil score
--
-- so every report in every school printed four empty boxes. On a PDF the
-- teacher cannot write on, that is not "a blank for the teacher" -- it is four
-- boxes that look like missing data to a parent or an inspector.
--
-- This adds the missing table so the grid can be filled from the app and
-- prints what was actually recorded.
--
-- Rows are per pupil per term per skill, uniquely. A teacher re-rating a
-- skill updates that row rather than accumulating history, because the report
-- needs the current term's value, not a trail.
--
-- RLS is student-scoped through the students table, matching behavior_logs:
-- a teacher can only rate a pupil in their own school, and the school_id
-- column is not trusted on its own, so it is checked against the pupil.
-- Writes are gated on being staff rather than on any authenticated user,
-- since a linked parent must be able to read a child's report but not to
-- assert their conduct.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.student_behaviour_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  academic_year text NOT NULL,
  term smallint NOT NULL CHECK (term BETWEEN 1 AND 3),
  -- Matches the labels printed on the report. Kept as free text rather than
  -- an enum so a school can add its own without a migration.
  skill text NOT NULL CHECK (length(btrim(skill)) BETWEEN 1 AND 40),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_behaviour_ratings_unique UNIQUE (student_id, academic_year, term, skill)
);

COMMENT ON TABLE public.student_behaviour_ratings IS
  'Teacher-entered behaviour and co-curricular ratings, 1-5, per pupil per term. Printed on the Uganda progress report.';

CREATE INDEX IF NOT EXISTS idx_student_behaviour_ratings_lookup
  ON public.student_behaviour_ratings (school_id, class_id, academic_year, term);
CREATE INDEX IF NOT EXISTS idx_student_behaviour_ratings_student
  ON public.student_behaviour_ratings (student_id, academic_year, term);

-- updated_at is maintained here rather than by a trigger so the behaviour of
-- this table is readable in one place.
CREATE OR REPLACE FUNCTION public.touch_student_behaviour_ratings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_behaviour_ratings_touch ON public.student_behaviour_ratings;
CREATE TRIGGER student_behaviour_ratings_touch
  BEFORE UPDATE ON public.student_behaviour_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_student_behaviour_ratings();

-- ─── Row level security ─────────────────────────────────────────────────────

ALTER TABLE public.student_behaviour_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users student_behaviour_ratings select" ON public.student_behaviour_ratings;

-- Reads: staff of the pupil's school, or a linked parent/guardian.
CREATE POLICY "School users student_behaviour_ratings select"
ON public.student_behaviour_ratings
FOR SELECT
TO authenticated
USING (
  (
    student_id IN (SELECT id FROM public.students WHERE school_id = public.my_school_id())
    AND public.is_staff_role()
  )
  OR student_id IN (SELECT public.my_student_ids())
);

DROP POLICY IF EXISTS "School users student_behaviour_ratings write" ON public.student_behaviour_ratings;

-- Writes: staff only. A linked parent may read their child's report but must
-- not be able to assert their own conduct.
CREATE POLICY "School users student_behaviour_ratings write"
ON public.student_behaviour_ratings
FOR ALL
TO authenticated
USING (
  student_id IN (SELECT id FROM public.students WHERE school_id = public.my_school_id())
  AND public.is_staff_role()
)
WITH CHECK (
  student_id IN (SELECT id FROM public.students WHERE school_id = public.my_school_id())
  AND public.is_staff_role()
);