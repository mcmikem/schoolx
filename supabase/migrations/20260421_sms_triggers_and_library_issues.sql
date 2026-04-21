-- Migration: Create sms_triggers, automated_message_logs, library_issues
-- These tables were defined in phase SQL files but never promoted to migrations.
-- Apply in Supabase SQL Editor: https://supabase.com/dashboard/project/gucxpmgwvnbqykevucbi/sql

-- ─── sms_triggers ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sms_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('fee_overdue', 'student_absent', 'staff_absent', 'exam_results')),
    threshold_days INTEGER DEFAULT 0,
    template_id UUID REFERENCES public.sms_templates(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sms_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sms_triggers_all" ON public.sms_triggers;
CREATE POLICY "sms_triggers_all" ON public.sms_triggers
  FOR ALL
  USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- ─── automated_message_logs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.automated_message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    trigger_id UUID REFERENCES public.sms_triggers(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')) DEFAULT 'sent',
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.automated_message_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automated_message_logs_select" ON public.automated_message_logs;
CREATE POLICY "automated_message_logs_select" ON public.automated_message_logs
  FOR SELECT USING (school_id = my_school_id());

DROP POLICY IF EXISTS "automated_message_logs_insert" ON public.automated_message_logs;
CREATE POLICY "automated_message_logs_insert" ON public.automated_message_logs
  FOR INSERT WITH CHECK (school_id = my_school_id());

-- ─── library_issues ──────────────────────────────────────────────────────────
-- The code uses library_issues; the old schema had library_checkouts.
-- This creates the table with the name the code expects.
CREATE TABLE IF NOT EXISTS public.library_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    book_id UUID REFERENCES public.library_books(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    returned_date DATE,
    status TEXT NOT NULL CHECK (status IN ('issued', 'returned', 'overdue')) DEFAULT 'issued',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.library_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "library_issues_all" ON public.library_issues;
CREATE POLICY "library_issues_all" ON public.library_issues
  FOR ALL
  USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- ─── Ensure library_books has RLS ────────────────────────────────────────────
ALTER TABLE IF EXISTS public.library_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "library_books_all" ON public.library_books;
CREATE POLICY "library_books_all" ON public.library_books
  FOR ALL
  USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- ─── Fix RLS on tables from 000_schema.sql missing my_school_id() policies ───

-- staff_attendance
ALTER TABLE IF EXISTS public.staff_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_attendance_all" ON public.staff_attendance;
CREATE POLICY "staff_attendance_all" ON public.staff_attendance
  FOR ALL
  USING (staff_id IN (SELECT id FROM users WHERE school_id = my_school_id()))
  WITH CHECK (staff_id IN (SELECT id FROM users WHERE school_id = my_school_id()));

-- exams
ALTER TABLE IF EXISTS public.exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exams_all" ON public.exams;
CREATE POLICY "exams_all" ON public.exams
  FOR ALL
  USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- exam_scores
ALTER TABLE IF EXISTS public.exam_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exam_scores_all" ON public.exam_scores;
CREATE POLICY "exam_scores_all" ON public.exam_scores
  FOR ALL
  USING (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()))
  WITH CHECK (class_id IN (SELECT id FROM classes WHERE school_id = my_school_id()));

-- budgets
ALTER TABLE IF EXISTS public.budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "budgets_all" ON public.budgets;
CREATE POLICY "budgets_all" ON public.budgets
  FOR ALL
  USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- expenses
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expenses_all" ON public.expenses;
CREATE POLICY "expenses_all" ON public.expenses
  FOR ALL
  USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- fee_adjustments
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fee_adjustments') THEN
    EXECUTE 'ALTER TABLE public.fee_adjustments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "fee_adjustments_all" ON public.fee_adjustments';
    EXECUTE $p$CREATE POLICY "fee_adjustments_all" ON public.fee_adjustments
      FOR ALL
      USING (school_id = my_school_id())
      WITH CHECK (school_id = my_school_id())$p$;
  END IF;
END $$;

-- payment_plans
ALTER TABLE IF EXISTS public.payment_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_plans_all" ON public.payment_plans;
CREATE POLICY "payment_plans_all" ON public.payment_plans
  FOR ALL
  USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- payment_plan_installments
ALTER TABLE IF EXISTS public.payment_plan_installments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_plan_installments_select" ON public.payment_plan_installments;
CREATE POLICY "payment_plan_installments_select" ON public.payment_plan_installments
  FOR SELECT USING (
    plan_id IN (SELECT id FROM public.payment_plans WHERE school_id = my_school_id())
  );
DROP POLICY IF EXISTS "payment_plan_installments_insert" ON public.payment_plan_installments;
CREATE POLICY "payment_plan_installments_insert" ON public.payment_plan_installments
  FOR INSERT WITH CHECK (
    plan_id IN (SELECT id FROM public.payment_plans WHERE school_id = my_school_id())
  );

-- student_promotions
ALTER TABLE IF EXISTS public.student_promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "student_promotions_all" ON public.student_promotions;
CREATE POLICY "student_promotions_all" ON public.student_promotions
  FOR ALL
  USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- assets
ALTER TABLE IF EXISTS public.assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assets_all" ON public.assets;
CREATE POLICY "assets_all" ON public.assets
  FOR ALL
  USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- push_subscriptions (scoped by user_id via auth.uid())
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions
  FOR ALL
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- sms_logs
ALTER TABLE IF EXISTS public.sms_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sms_logs_all" ON public.sms_logs;
CREATE POLICY "sms_logs_all" ON public.sms_logs
  FOR ALL
  USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- sms_automations
ALTER TABLE IF EXISTS public.sms_automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sms_automations_all" ON public.sms_automations;
CREATE POLICY "sms_automations_all" ON public.sms_automations
  FOR ALL
  USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());

-- sms_templates
ALTER TABLE IF EXISTS public.sms_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sms_templates_all" ON public.sms_templates;
CREATE POLICY "sms_templates_all" ON public.sms_templates
  FOR ALL
  USING (school_id = my_school_id())
  WITH CHECK (school_id = my_school_id());
