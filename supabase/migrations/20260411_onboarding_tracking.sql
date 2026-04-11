-- Onboarding Setup Tracking System
-- Tracks school setup progress and reminders

-- 1. Add onboarding tracking fields to schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS setup_completed JSONB DEFAULT '{}'::jsonb;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE schools ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;

-- 2. Create setup checklist items table for more detailed tracking
CREATE TABLE IF NOT EXISTS setup_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  item_label TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  skipped BOOLEAN DEFAULT false,
  skipped_at TIMESTAMPTZ,
  UNIQUE(school_id, item_key)
);

-- 3. Create default onboarding checklist items for new schools
CREATE OR REPLACE FUNCTION create_default_checklist(school_uuid UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO setup_checklist (school_id, item_key, item_label) VALUES
    (school_uuid, 'academic_calendar', 'Academic Calendar'),
    (school_uuid, 'class_structure', 'Class & Stream Setup'),
    (school_uuid, 'fee_structure', 'Fee Structure'),
    (school_uuid, 'staff_accounts', 'Staff Accounts'),
    (school_uuid, 'student_import', 'Import Students'),
    (school_uuid, 'sms_templates', 'SMS Templates'),
    (school_uuid, 'payment_methods', 'Payment Methods'),
    (school_uuid, 'grading_config', 'Grading System')
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 4. Create view for setup progress
CREATE VIEW setup_progress AS
SELECT 
  school_id,
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE is_completed = true) as completed_items,
  ROUND(COUNT(*) FILTER (WHERE is_completed = true)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as progress_percent
FROM setup_checklist
GROUP BY school_id;

-- 5. Add RLS policies for setup_checklist
ALTER TABLE setup_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School admins manage checklist" ON setup_checklist 
  FOR ALL USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid() AND role = 'school_admin'));