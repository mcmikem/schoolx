-- Wave 1 (ROADMAP #10): missing performance indexes + payroll_deductions FK hardening
-- Additive + idempotent (IF NOT EXISTS / guarded DO blocks). Safe to re-run.

-- 1. Students filtered by school + class (class lists, attendance, fees)
CREATE INDEX IF NOT EXISTS idx_students_school_class
  ON public.students (school_id, class_id);

-- 2. Fee payments looked up per student (bursar ledger, defaulter engine)
CREATE INDEX IF NOT EXISTS idx_fee_payments_student
  ON public.fee_payments (student_id);

-- 3. Attendance looked up per student + date (streaks, at-risk, reports)
CREATE INDEX IF NOT EXISTS idx_attendance_student_date
  ON public.attendance (student_id, date DESC);

-- 4. Parent→child links resolved per student (parent portal provider)
CREATE INDEX IF NOT EXISTS idx_parent_students_student
  ON public.parent_students (student_id);

-- 5. Teacher→subject assignments resolved per teacher (timetable, workload)
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher
  ON public.teacher_subjects (teacher_id);

-- 6. Events per school + start date (calendar; duplicates 202611010002 guard — IF NOT EXISTS keeps it safe)
CREATE INDEX IF NOT EXISTS idx_events_school_start_date
  ON public.events (school_id, start_date DESC);

-- 7. Payroll deduction lookups (payslip build, payroll run)
CREATE INDEX IF NOT EXISTS idx_payroll_deductions_record
  ON public.payroll_deductions (payroll_record_id);
CREATE INDEX IF NOT EXISTS idx_payroll_deductions_staff
  ON public.payroll_deductions (staff_id);

-- 8. Referential integrity on payroll_deductions (audit L9).
-- NOT VALID: enforces for new writes without failing on legacy orphan rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_deductions_record'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payroll_records'
  ) THEN
    ALTER TABLE public.payroll_deductions
      ADD CONSTRAINT fk_payroll_deductions_record
      FOREIGN KEY (payroll_record_id) REFERENCES public.payroll_records (id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_payroll_deductions_staff'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'staff'
  ) THEN
    ALTER TABLE public.payroll_deductions
      ADD CONSTRAINT fk_payroll_deductions_staff
      FOREIGN KEY (staff_id) REFERENCES public.staff (id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END $$;
