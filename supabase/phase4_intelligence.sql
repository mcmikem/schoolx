-- ============================================
-- PHASE 4: INTELLIGENCE & COMMUNICATION
-- ============================================

-- ============================================
-- SMS TRIGGERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sms_triggers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Fee Reminder", "Absentee Alert"
    event_type TEXT CHECK (event_type IN ('fee_overdue', 'student_absent', 'staff_absent', 'exam_results')) NOT NULL,
    threshold_days INTEGER DEFAULT 0, -- e.g. 15 days overdue
    template_id UUID REFERENCES sms_templates(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUTOMATED MESSAGE LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS automated_message_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    trigger_id UUID REFERENCES sms_triggers(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id),
    status TEXT CHECK (status IN ('sent', 'failed')) DEFAULT 'sent',
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS POLICIES
ALTER TABLE sms_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage triggers" ON sms_triggers FOR ALL USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid() AND role IN ('school_admin', 'super_admin')));
CREATE POLICY "Admins view logs" ON automated_message_logs FOR SELECT USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid() AND role IN ('school_admin', 'super_admin')));

-- VIEW for Revenue Projections (Simplified)
CREATE OR REPLACE VIEW revenue_projections AS
SELECT 
    school_id,
    academic_year,
    term,
    SUM(amount) as total_expected,
    (SELECT SUM(amount_paid) FROM fee_payments fp WHERE fp.fee_id IN (SELECT id FROM fee_structure fs2 WHERE fs2.school_id = fs.school_id)) as total_collected
FROM fee_structure fs
GROUP BY school_id, academic_year, term;
