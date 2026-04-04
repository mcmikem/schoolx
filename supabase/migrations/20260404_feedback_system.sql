-- Feedback & Support System + Error Logging
-- Run in Supabase SQL Editor

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

-- Users can view their own school's feedback
CREATE POLICY "Users view own school feedback" ON feedbacks
  FOR SELECT USING (true);

-- Users can create feedback
CREATE POLICY "Users create feedback" ON feedbacks
  FOR INSERT WITH CHECK (true);

-- Users can update their own feedback
CREATE POLICY "Users update own feedback" ON feedbacks
  FOR UPDATE USING (true);

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

CREATE POLICY "Super admins view error logs" ON error_logs
  FOR SELECT USING (true);

CREATE POLICY "System inserts error logs" ON error_logs
  FOR INSERT WITH CHECK (true);
