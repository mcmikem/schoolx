-- ============================================================================
-- Persist papers parsed by the Exam Lab, and record what pupils scored on them
-- ============================================================================
-- Until now the lab produced a standalone HTML form: the parsed paper lived in
-- nobody's database, so a teacher who wanted to record what a class actually
-- scored on it had nowhere to record it. This gives the pipeline a spine:
--
-- 1. `exams.paper_model` -- the parsed question structure (kind, marks,
--    accepted answers, marking strategy) stored as JSON on the existing
--    exams row. The lab's renderer already emits HTML from this structure;
--    storing it means the marking screen can be generated from the same
--    source of truth instead of a re-parse of an attachment.
--
-- 2. `exam_paper_answers` -- one row per pupil, per question, per paper: the
--    answer text (typed in during capture) and the marks awarded. The
--    auto-marking script marks closed-form questions offline; those results
--    land here the same way, but marked_by records the human or the script
--    that set them, and NOTHING is marked that the paper does not say is
--    machine-markable. Teachers mark the essay tasks here, against the rubric
--    printed on the paper.
--
-- The UNIQUE constraint is the reconciliation guarantee (exam, pupil,
-- question): re-recording a mark updates rather than duplicates, so a
-- correction is a correction and a tally can never double-count.
-- ============================================================================

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS paper_model JSONB;

COMMENT ON COLUMN public.exams.paper_model IS
  'The parsed question structure of a past paper (from the Exam Lab). NULL for exams created directly in the Exams page, which are score-only.';

CREATE TABLE IF NOT EXISTS public.exam_paper_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    answer TEXT,
    marks_awarded NUMERIC(5,1),
    marked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT exam_paper_answers_marks_nonnegative CHECK (marks_awarded IS NULL OR marks_awarded >= 0),
    UNIQUE (exam_id, student_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_exam_paper_answers_exam
    ON public.exam_paper_answers (exam_id, student_id);

CREATE INDEX IF NOT EXISTS idx_exam_paper_answers_school
    ON public.exam_paper_answers (school_id, updated_at DESC);

-- Ensure the trigger helper exists where earlier migrations were skipped
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_exam_paper_answers_updated ON public.exam_paper_answers;
CREATE TRIGGER set_exam_paper_answers_updated
    BEFORE UPDATE ON public.exam_paper_answers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- RLS: staff can read and write exam answers only within their own school.
ALTER TABLE public.exam_paper_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users exam answers all" ON public.exam_paper_answers;
CREATE POLICY "School users exam answers all" ON public.exam_paper_answers
    FOR ALL TO authenticated
    USING (school_id = my_school_id() AND is_staff_role())
    WITH CHECK (school_id = my_school_id() AND is_staff_role());
