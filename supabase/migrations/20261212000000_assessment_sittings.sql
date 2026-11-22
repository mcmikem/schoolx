-- Assessment sittings: stable identity for school-defined assessments.
--
-- Distinguishes an assessment *group* (e.g. "Saturday tests", "BOT") from an
-- individual *sitting* ("Saturday test, 14 March"). Grades continue to reference
-- the sitting by id (assessment_sitting_id) so renaming an assessment preserves
-- its marks and history. Backfill is intentionally NOT performed: existing rows
-- keep their assessment_type string and are reconciled lazily by the app.

CREATE TABLE IF NOT EXISTS public.assessment_sittings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  term INTEGER NOT NULL CHECK (term BETWEEN 1 AND 3),
  name TEXT NOT NULL,
  group_key TEXT NOT NULL,
  assessment_type TEXT,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  max_score NUMERIC(6,2) NOT NULL DEFAULT 100,
  weight NUMERIC(5,2),
  scale TEXT NOT NULL DEFAULT 'numeric' CHECK (scale IN ('numeric','rating')),
  rating_key TEXT,
  reporting_behavior TEXT NOT NULL DEFAULT 'summary' CHECK (reporting_behavior IN ('summary','detailed','both','none')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_sittings_school_term
  ON public.assessment_sittings (school_id, academic_year, term);

CREATE INDEX IF NOT EXISTS idx_assessment_sittings_class_subject
  ON public.assessment_sittings (class_id, subject_id);

ALTER TABLE public.assessment_sittings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users assessment_sittings all" ON public.assessment_sittings;
CREATE POLICY "School users assessment_sittings all" ON public.assessment_sittings
  FOR ALL TO authenticated
  USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- Optional link from grades to the sitting that produced them. Nullable so
-- legacy rows (and rows created before this migration) keep working.
ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS assessment_sitting_id UUID REFERENCES public.assessment_sittings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_grades_sitting
  ON public.grades (assessment_sitting_id);

-- Extend report_config_snapshot shape is handled in app code; no DB change
-- needed beyond the grades column above. Historical reports keep their
-- captured snapshot and are not recalculated.
EOF
echo written