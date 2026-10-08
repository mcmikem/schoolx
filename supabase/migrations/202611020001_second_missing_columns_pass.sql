-- Second missing-column pass: columns the client writes or reads that production lacks.
-- Every target table has 0 rows in production, so these are purely additive.
-- Applies after 202611010018_columns_the_app_writes.sql.

-- 1. Sick bay admissions. The health page records an admit/discharge cycle on
--    health_records (status, admitted_at, discharged_at) but production only has
--    the medical-profile columns.
ALTER TABLE public.health_records
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS student_name text,
  ADD COLUMN IF NOT EXISTS "condition" text,
  ADD COLUMN IF NOT EXISTS severity text,
  ADD COLUMN IF NOT EXISTS treatment text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS admitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS discharged_at timestamptz;

-- Walk-in admissions are saved without a linked student.
ALTER TABLE public.health_records ALTER COLUMN student_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_health_records_school_id ON public.health_records (school_id);
CREATE INDEX IF NOT EXISTS idx_health_records_admitted_at ON public.health_records (admitted_at DESC);

DROP POLICY IF EXISTS "health_records_staff_write" ON public.health_records;
CREATE POLICY "health_records_staff_write" ON public.health_records
  FOR ALL TO authenticated
  USING (
    is_staff_role()
    AND (
      (health_records.student_id IN (
        SELECT s.id FROM public.students s WHERE s.school_id = my_school_id()
      ))
      OR (health_records.student_id IS NULL AND health_records.school_id = my_school_id())
    )
  )
  WITH CHECK (
    is_staff_role()
    AND (
      (health_records.student_id IN (
        SELECT s.id FROM public.students s WHERE s.school_id = my_school_id()
      ))
      OR (health_records.student_id IS NULL AND health_records.school_id = my_school_id())
    )
  );

-- 2. Expense approval timestamp, plus the "rejected" state the approval UI writes
--    (the existing check constraint only allowed pending/approved/paid).
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_status_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'paid'::text, 'rejected'::text]));

-- 3. Promotion history must distinguish promoted / repeat / withdrawn students.
ALTER TABLE public.student_promotions ADD COLUMN IF NOT EXISTS promotion_type text;
