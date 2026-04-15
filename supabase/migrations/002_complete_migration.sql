-- ============================================================
-- SchoolX Complete Database Migration
-- Run this entire script in Supabase SQL Editor
-- Date: 2026-04-05
-- ============================================================

-- Create default school if not exists
INSERT INTO schools (id, name, school_code, district, school_type, ownership)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo School', 'DEMO', 'Kampala', 'primary', 'private')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PART 1: School Customization & Report Branding
-- ============================================================

-- 1. Add customization columns to schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#002045';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#3b82f6';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS school_motto TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS report_header_text TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS report_footer_text TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS signature_headteacher_url TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS signature_class_teacher_url TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS report_template TEXT DEFAULT 'default';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS show_position_in_report BOOLEAN DEFAULT true;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS show_conduct_in_report BOOLEAN DEFAULT true;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS show_attendance_in_report BOOLEAN DEFAULT true;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS show_remarks_in_report BOOLEAN DEFAULT true;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS receipt_footer_text TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS custom_features TEXT[];
ALTER TABLE schools ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- 2. Create support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature_request', 'custom_package', 'onboarding', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create report templates table
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'report_card',
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create conduct/behavior records for reports
CREATE TABLE IF NOT EXISTS student_conduct (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  term INTEGER NOT NULL,
  academic_year TEXT NOT NULL,
  punctuality INTEGER DEFAULT 5 CHECK (punctuality BETWEEN 1 AND 5),
  neatness INTEGER DEFAULT 5 CHECK (neatness BETWEEN 1 AND 5),
  honesty INTEGER DEFAULT 5 CHECK (honesty BETWEEN 1 AND 5),
  discipline INTEGER DEFAULT 5 CHECK (discipline BETWEEN 1 AND 5),
  respect INTEGER DEFAULT 5 CHECK (respect BETWEEN 1 AND 5),
  leadership INTEGER DEFAULT 5 CHECK (leadership BETWEEN 1 AND 5),
  cooperation INTEGER DEFAULT 5 CHECK (cooperation BETWEEN 1 AND 5),
  class_teacher_remark TEXT,
  head_teacher_remark TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, term, academic_year)
);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_conduct ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Note: These policies are fixed in migration 003_fix_rls_policies.sql
-- Keeping original policies for migration continuity, but they will be replaced
CREATE POLICY "Super admins manage support tickets" ON support_tickets
  FOR ALL USING (
    school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Schools manage their report templates" ON report_templates
  FOR ALL USING (school_id IN (SELECT id FROM schools WHERE id = school_id));

CREATE POLICY "Schools manage their student conduct" ON student_conduct
  FOR ALL USING (school_id IN (SELECT id FROM schools WHERE id = school_id));

-- Default report templates
INSERT INTO report_templates (school_id, name, template_type, config, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Default Report Card', 'report_card', '{"style": "classic", "show_logo": true, "show_motto": true, "show_signatures": true}', true),
  ('00000000-0000-0000-0000-000000000001', 'Modern Report Card', 'report_card', '{"style": "modern", "show_logo": true, "show_motto": true, "show_signatures": true}', false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PART 2: Feedback & Error Logging
-- ============================================================

-- 1. Feedback table
CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  user_id TEXT,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature_request', 'feedback', 'custom_package')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  page_url TEXT,
  admin_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- Note: These policies are fixed in migration 003_fix_rls_policies.sql
CREATE POLICY "Users view all feedback" ON feedbacks
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Users create feedback" ON feedbacks
  FOR INSERT WITH CHECK (
    school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())
    OR school_id IS NULL
  );

CREATE POLICY "Users update own feedback" ON feedbacks
  FOR UPDATE USING (
    school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())
    AND user_id = auth.uid()::text
  );

-- 2. Error logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID,
  user_id TEXT,
  user_role TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  page_url TEXT,
  browser_info TEXT,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Note: These policies are fixed in migration 003_fix_rls_policies.sql
CREATE POLICY "Super admins view error logs" ON error_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "System inserts error logs" ON error_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- PART 3: SMS Automation
-- ============================================================

-- 1. SMS logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  automation_type TEXT NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  parent_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SMS automations config table
CREATE TABLE IF NOT EXISTS sms_automations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  automation_type TEXT NOT NULL CHECK (automation_type IN ('fee_overdue', 'absentee_alert', 'payment_confirmation', 'report_card_ready')),
  is_active BOOLEAN DEFAULT true,
  schedule_days INTEGER[] DEFAULT '{7, 14, 30}',
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, automation_type)
);

-- 3. SMS templates table
CREATE TABLE IF NOT EXISTS sms_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Schools view own SMS logs" ON sms_logs
  FOR SELECT USING (school_id IN (SELECT id FROM schools WHERE id = school_id));

CREATE POLICY "Schools insert SMS logs" ON sms_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Schools manage own SMS automations" ON sms_automations
  FOR ALL USING (school_id IN (SELECT id FROM schools WHERE id = school_id));

CREATE POLICY "Schools manage own SMS templates" ON sms_templates
  FOR ALL USING (school_id IN (SELECT id FROM schools WHERE id = school_id));

-- Default automations for demo school
INSERT INTO sms_automations (school_id, automation_type, is_active, schedule_days) VALUES
  ('00000000-0000-0000-0000-000000000001', 'fee_overdue', true, '{7, 14, 30}'),
  ('00000000-0000-0000-0000-000000000001', 'absentee_alert', true, '{}'),
  ('00000000-0000-0000-0000-000000000001', 'payment_confirmation', true, '{}'),
  ('00000000-0000-0000-0000-000000000001', 'report_card_ready', false, '{}')
ON CONFLICT (school_id, automation_type) DO NOTHING;

-- ============================================================
-- PART 4: Fix existing tables (missing columns)
-- ============================================================

-- Add password_reset_required to users if missing
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT false;

-- Add deleted_at to fee_structure for soft deletes
ALTER TABLE fee_structure ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- Done! All tables created successfully.
-- ============================================================
