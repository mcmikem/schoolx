-- ============================================================================
-- Columns the application reads or writes that production does not have.
-- ============================================================================
--
-- Every statement here is an additive ADD COLUMN IF NOT EXISTS. Each column is
-- one the shipped application already references and the live database refused:
-- PostgREST answers 400 PGRST204 "Could not find the '<col>' column of
-- '<table>' in the schema cache", so the read returned nothing and the write
-- never landed.
--
-- The worst of them is schools: Settings → School configuration writes
-- student_id_format, has_boarding, has_houses, has_student_council,
-- has_prefects and location_type, none of which existed, so that form has
-- failed on every save since it shipped. homework_submissions.status and
-- .school_id broke grading; lesson_plans.homework broke lesson plans;
-- library_books.total_copies, messages.channel and
-- automated_message_logs.record_id broke the pages that read them; and the
-- school_id columns below are the ones row-level security scopes on, so every
-- write to those tables was refused by policy as well as by schema.
--
-- Derived from supabase/schema.sql (the declarations) cross-checked against
-- information_schema in production, and from a pass over every literal column
-- name the client sends to PostgREST.
-- ============================================================================

-- 1. School configuration — written by dashboard/settings.
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS student_id_format TEXT DEFAULT 'STU{YYYY}{####}';
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS has_boarding BOOLEAN DEFAULT false;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS has_houses BOOLEAN DEFAULT false;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS has_student_council BOOLEAN DEFAULT false;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS has_prefects BOOLEAN DEFAULT false;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS location_type TEXT CHECK (location_type IN ('urban', 'peri_urban', 'rural')) DEFAULT 'urban';

-- 2. Homework grading — inserted and updated by dashboard/homework-submissions.
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'submitted', 'graded', 'late')) DEFAULT 'pending';
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Lesson plans — written by dashboard/lesson-plans.
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS teaching_method TEXT;
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS homework TEXT;

-- 4. Library — read and written by dashboard/library (production renamed this
--    to `copies`; the client and schema.sql both still say total_copies).
ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS total_copies INTEGER DEFAULT 1;

-- 5. Outbound SMS — delivery reports and message batches.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivery_status TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS recipient_count INTEGER DEFAULT 1;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_id TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE public.automated_message_logs ADD COLUMN IF NOT EXISTS record_id TEXT;
ALTER TABLE public.automated_message_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 6. Row-level security scopes on school_id. These tables have policies that
--    compare it, and the client sends it, but the column was never created —
--    so the policy could not evaluate and every insert was refused.
ALTER TABLE public.activity_comments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE public.course_classes ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE public.fee_term_lines ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE public.student_enrollments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE public.student_fee_terms ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE public.co_curricular_activities ADD COLUMN IF NOT EXISTS school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE public.co_curricular_activities ADD COLUMN IF NOT EXISTS period TEXT;
ALTER TABLE public.co_curricular_activities ADD COLUMN IF NOT EXISTS score NUMERIC;
ALTER TABLE public.co_curricular_activities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 7. Remaining declarations schema.sql makes and production never received.
ALTER TABLE public.suggestions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE public.dorms ADD COLUMN IF NOT EXISTS warden_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.dorm_students ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);
ALTER TABLE public.fee_structure ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);
ALTER TABLE public.module_catalog ADD COLUMN IF NOT EXISTS icon TEXT;
