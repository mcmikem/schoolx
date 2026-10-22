ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS paper_model JSONB;

DROP POLICY IF EXISTS "Students view assigned practice papers" ON public.exams;
CREATE POLICY "Students view assigned practice papers"
  ON public.exams FOR SELECT TO authenticated
  USING (
    school_id = my_school_id()
    AND class_id IN (SELECT class_id FROM students WHERE id IN (SELECT my_student_ids()))
    AND EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'student')
    AND paper_model #>> '{assignment,published}' = 'true'
  );

CREATE TABLE IF NOT EXISTS public.exam_paper_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  marks_awarded NUMERIC(7,2),
  feedback TEXT,
  marked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  marked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, student_id),
  CHECK (marks_awarded IS NULL OR marks_awarded >= 0)
);

CREATE INDEX IF NOT EXISTS idx_exam_paper_submissions_exam
  ON public.exam_paper_submissions (school_id, exam_id, submitted_at DESC);

ALTER TABLE public.exam_paper_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage paper submissions" ON public.exam_paper_submissions;
CREATE POLICY "Staff manage paper submissions"
  ON public.exam_paper_submissions FOR ALL TO authenticated
  USING (
    school_id = my_school_id()
    AND is_staff_role()
    AND EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = exam_paper_submissions.exam_id
        AND exams.school_id = exam_paper_submissions.school_id
        AND (
          NOT EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('teacher', 'class_teacher'))
          OR exams.class_id IN (
            SELECT id FROM classes WHERE class_teacher_id = (SELECT id FROM users WHERE auth_id = auth.uid())
            UNION
            SELECT class_id FROM teacher_subjects WHERE teacher_id = (SELECT id FROM users WHERE auth_id = auth.uid())
          )
        )
    )
  )
  WITH CHECK (
    school_id = my_school_id()
    AND is_staff_role()
    AND EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = exam_paper_submissions.exam_id
        AND exams.school_id = exam_paper_submissions.school_id
        AND (
          NOT EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('teacher', 'class_teacher'))
          OR exams.class_id IN (
            SELECT id FROM classes WHERE class_teacher_id = (SELECT id FROM users WHERE auth_id = auth.uid())
            UNION
            SELECT class_id FROM teacher_subjects WHERE teacher_id = (SELECT id FROM users WHERE auth_id = auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "Students read own paper submissions" ON public.exam_paper_submissions;
CREATE POLICY "Students read own paper submissions"
  ON public.exam_paper_submissions FOR SELECT TO authenticated
  USING (
    student_id IN (SELECT my_student_ids())
    AND EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'student')
  );

DROP POLICY IF EXISTS "Students submit own published papers" ON public.exam_paper_submissions;
CREATE POLICY "Students submit own published papers"
  ON public.exam_paper_submissions FOR INSERT TO authenticated
  WITH CHECK (
    student_id IN (SELECT my_student_ids())
    AND EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'student')
    AND school_id = my_school_id()
    AND marks_awarded IS NULL
    AND feedback IS NULL
    AND marked_by IS NULL
    AND EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = exam_id
        AND exams.school_id = exam_paper_submissions.school_id
        AND exams.class_id IN (SELECT class_id FROM students WHERE id IN (SELECT my_student_ids()))
        AND exams.paper_model #>> '{assignment,published}' = 'true'
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exam-papers', 'exam-papers', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "School staff manage source papers" ON storage.objects;
CREATE POLICY "School staff manage source papers"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'exam-papers'
    AND (storage.foldername(name))[1] = my_school_id()::text
    AND is_staff_role()
  )
  WITH CHECK (
    bucket_id = 'exam-papers'
    AND (storage.foldername(name))[1] = my_school_id()::text
    AND is_staff_role()
  );

DROP POLICY IF EXISTS "Students view assigned source papers" ON storage.objects;
CREATE POLICY "Students view assigned source papers"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'exam-papers'
    AND EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id::text = (storage.foldername(name))[2]
        AND exams.school_id = my_school_id()
        AND exams.class_id IN (SELECT class_id FROM students WHERE id IN (SELECT my_student_ids()))
        AND EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'student')
        AND exams.paper_model #>> '{assignment,published}' = 'true'
    )
  );
