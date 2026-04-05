-- SMS Automation Tables
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

ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schools view own SMS logs" ON sms_logs
  FOR SELECT USING (school_id IN (SELECT id FROM schools WHERE id = school_id));

CREATE POLICY "Schools insert SMS logs" ON sms_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Schools manage own SMS automations" ON sms_automations
  FOR ALL USING (school_id IN (SELECT id FROM schools WHERE id = school_id));

CREATE POLICY "Schools manage own SMS templates" ON sms_templates
  FOR ALL USING (school_id IN (SELECT id FROM schools WHERE id = school_id));

-- Insert default automations for demo school
INSERT INTO sms_automations (school_id, automation_type, is_active, schedule_days) VALUES
  ('00000000-0000-0000-0000-000000000001', 'fee_overdue', true, '{7, 14, 30}'),
  ('00000000-0000-0000-0000-000000000001', 'absentee_alert', true, '{}'),
  ('00000000-0000-0000-0000-000000000001', 'payment_confirmation', true, '{}'),
  ('00000000-0000-0000-0000-000000000001', 'report_card_ready', false, '{}')
ON CONFLICT (school_id, automation_type) DO NOTHING;
