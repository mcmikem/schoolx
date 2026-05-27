CREATE TABLE IF NOT EXISTS scan_event_logs (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
	entity_type TEXT NOT NULL CHECK (entity_type IN ('student_meal', 'staff_attendance')),
	target_id UUID,
	meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'supper')),
	attendance_action TEXT CHECK (attendance_action IN ('check_in', 'check_out')),
	operator_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
	scanner_id TEXT,
	source TEXT NOT NULL DEFAULT 'scanner',
	raw_scan_hash TEXT,
	is_signed BOOLEAN NOT NULL DEFAULT false,
	signature_valid BOOLEAN,
	decision TEXT NOT NULL CHECK (decision IN ('allowed', 'blocked')),
	reason_code TEXT NOT NULL,
	reason_message TEXT,
	metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_event_logs_school_created ON scan_event_logs (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_event_logs_target_created ON scan_event_logs (target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_event_logs_reason_code ON scan_event_logs (reason_code);

ALTER TABLE scan_event_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school users can read scan_event_logs" ON scan_event_logs;
CREATE POLICY "school users can read scan_event_logs"
ON scan_event_logs
FOR SELECT
TO authenticated
USING (school_id = my_school_id());

DROP POLICY IF EXISTS "school users can insert scan_event_logs" ON scan_event_logs;
CREATE POLICY "school users can insert scan_event_logs"
ON scan_event_logs
FOR INSERT
TO authenticated
WITH CHECK (school_id = my_school_id());

DROP POLICY IF EXISTS "school admins can delete scan_event_logs" ON scan_event_logs;
CREATE POLICY "school admins can delete scan_event_logs"
ON scan_event_logs
FOR DELETE
TO authenticated
USING (school_id = my_school_id() AND is_school_admin());
