-- Create missing database tables
-- Run this on your Supabase database

-- academic_terms
CREATE TABLE IF NOT EXISTS public.academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  term_number INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- leave_requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- staff_attendance
CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- staff_salaries
CREATE TABLE IF NOT EXISTS public.staff_salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  basic_salary DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- salary_payments
CREATE TABLE IF NOT EXISTS public.salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- staff_reviews
CREATE TABLE IF NOT EXISTS public.staff_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reviewer_id UUID,
  rating INT,
  comments TEXT,
  review_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- sms_triggers
CREATE TABLE IF NOT EXISTS public.sms_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message_template TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- student_promotions
CREATE TABLE IF NOT EXISTS public.student_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  from_class_id UUID,
  to_class_id UUID,
  academic_year TEXT NOT NULL,
  promoted_at TIMESTAMPTZ DEFAULT NOW()
);

-- rate_limit_log
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- subscription_payments
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- pending_mobile_payments
CREATE TABLE IF NOT EXISTS public.pending_mobile_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  transaction_ref TEXT,
  amount DECIMAL(12,2),
  phone TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- setup_checklist
CREATE TABLE IF NOT EXISTS public.setup_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  item_label TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, item_key)
);

-- Add missing columns to existing tables
ALTER TABLE public.fee_structure ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS blood_type TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS medical_conditions TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS religion TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS feature_stage TEXT DEFAULT 'core';
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS setup_progress JSONB;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;