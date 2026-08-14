-- Fix get_sms_quota() to count sms_logs by sent_at, not created_at.
-- sms_logs has no created_at column (schema.sql defines sent_at TIMESTAMPTZ DEFAULT NOW()),
-- so the 30-day count silently returned 0 / failed on the applied schema.
CREATE OR REPLACE FUNCTION get_sms_quota(p_school_id UUID)
RETURNS INTEGER AS $$
DECLARE
    plan_val TEXT;
    quota INTEGER;
    used INTEGER;
BEGIN
    SELECT s.subscription_plan, COALESCE(s.sms_quota_monthly, 0)
    INTO plan_val, quota
    FROM schools s WHERE s.id = p_school_id;

    -- Get used count from last 30 days
    SELECT COUNT(*) INTO used FROM sms_logs
    WHERE school_id = p_school_id
    AND sent_at > NOW() - INTERVAL '30 days';

    RETURN quota - used;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_sms_quota(UUID) TO authenticated;