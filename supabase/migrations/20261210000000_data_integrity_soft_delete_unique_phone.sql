-- Data integrity: per-school unique phone for users + soft-delete columns.
-- Safe to run on existing data: no duplicate (school_id, phone) rows exist.

-- 1. Soft-delete columns (nullable; NULL means active).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Unique phone per school (ignoring soft-deleted rows).
CREATE UNIQUE INDEX IF NOT EXISTS users_school_phone_unique
  ON public.users (school_id, phone)
  WHERE deleted_at IS NULL AND phone IS NOT NULL;

-- 3. Helpful indexes for history/report queries.
CREATE INDEX IF NOT EXISTS attendance_school_date_class_idx
  ON public.attendance (class_id, date);
CREATE INDEX IF NOT EXISTS students_school_class_status_idx
  ON public.students (school_id, class_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS audit_log_school_created_idx
  ON public.audit_log (school_id, created_at DESC);

-- 4. Default deleted_at to NULL for existing rows (already null, but be explicit).
UPDATE public.users SET deleted_at = NULL WHERE deleted_at IS NULL;
UPDATE public.students SET deleted_at = NULL WHERE deleted_at IS NULL;
