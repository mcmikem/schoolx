-- Parent Portal Notifications Table
CREATE TABLE IF NOT EXISTS parent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('grade_posted', 'payment_received', 'attendance_alert', 'fee_due', 'report_card', 'message', 'general')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_parent_notifications_parent ON parent_notifications(parent_id, created_at DESC);
CREATE INDEX idx_parent_notifications_unread ON parent_notifications(parent_id, is_read) WHERE is_read = false;

-- Enable RLS
ALTER TABLE parent_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: parents can view their own notifications
CREATE POLICY "Parents can view own notifications" ON parent_notifications
  FOR SELECT USING (parent_id = auth.uid());

-- Policy: school admins can manage notifications
CREATE POLICY "School admins can manage notifications" ON parent_notifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('school_admin', 'admin', 'headmaster'))
  );