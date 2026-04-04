-- School Customization & Report Branding
-- Run in Supabase SQL Editor

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

-- 5. Enable RLS on new tables
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_conduct ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
CREATE POLICY "Super admins can manage support tickets" ON support_tickets
  FOR ALL USING (true);

CREATE POLICY "Schools can view their own tickets" ON support_tickets
  FOR SELECT USING (school_id IN (SELECT id FROM schools WHERE id = school_id));

CREATE POLICY "Schools can manage their report templates" ON report_templates
  FOR ALL USING (school_id IN (SELECT id FROM schools WHERE id = school_id));

CREATE POLICY "Schools can manage their student conduct" ON student_conduct
  FOR ALL USING (school_id IN (SELECT id FROM schools WHERE id = school_id));

-- 7. Insert default report templates
INSERT INTO report_templates (school_id, name, template_type, config, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Default Report Card', 'report_card', '{"style": "classic", "show_logo": true, "show_motto": true, "show_signatures": true}', true),
  ('00000000-0000-0000-0000-000000000001', 'Modern Report Card', 'report_card', '{"style": "modern", "show_logo": true, "show_motto": true, "show_signatures": true}', false);
