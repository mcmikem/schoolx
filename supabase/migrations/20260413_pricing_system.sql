-- ============================================
-- Pricing & Subscription System Update
-- Matches landing page pricing: Starter, Growth, Enterprise, Lifetime
-- ============================================

-- 1. Update schools table with new plan values and pricing fields
ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_subscription_plan_check;
ALTER TABLE schools ADD CONSTRAINT schools_subscription_plan_check 
  CHECK (subscription_plan IN ('starter', 'growth', 'enterprise', 'lifetime', 'free_trial'));

-- Add pricing-specific columns
ALTER TABLE schools ADD COLUMN IF NOT EXISTS price_per_student INTEGER DEFAULT 2000;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS payment_frequency TEXT CHECK (payment_frequency IN ('term', 'annual', 'one_time')) DEFAULT 'term';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS student_count INTEGER DEFAULT 0;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS admin_users_allowed INTEGER DEFAULT 3;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS sms_quota_monthly INTEGER DEFAULT 0;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS lifetime_license BOOLEAN DEFAULT FALSE;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS source_code_license BOOLEAN DEFAULT FALSE;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS white_label BOOLEAN DEFAULT FALSE;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS on_premise BOOLEAN DEFAULT FALSE;

-- 2. Create feature flags table to track what's enabled per plan
CREATE TABLE IF NOT EXISTS plan_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan TEXT NOT NULL CHECK (plan IN ('starter', 'growth', 'enterprise', 'lifetime')),
    feature_key TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    included BOOLEAN DEFAULT TRUE,
    limit_value INTEGER,
    unit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert plan feature definitions
INSERT INTO plan_features (plan, feature_key, feature_name, included, limit_value, unit) VALUES
-- STARTER (UGX 2,000/student/term)
('starter', 'student_records', 'Student records & profiles', TRUE, NULL, NULL),
('starter', 'daily_attendance', 'Daily attendance', TRUE, NULL, NULL),
('starter', 'ca_grades', 'CA grades & report cards', TRUE, NULL, NULL),
('starter', 'fee_collection', 'Fee collection & tracking', TRUE, NULL, NULL),
('starter', 'momo_payment', 'MoMo/Airtel payment', TRUE, NULL, NULL),
('starter', 'offline_sync', 'Basic offline sync', TRUE, NULL, NULL),
('starter', 'id_cards', 'ID card generation', TRUE, NULL, NULL),
('starter', 'admin_users', 'Admin users', TRUE, 3, 'users'),
('starter', 'bulk_sms', 'Bulk SMS', FALSE, NULL, NULL),
('starter', 'parent_portal', 'Parent portal', FALSE, NULL, NULL),
('starter', 'syllabus', 'Syllabus & scheme of work', FALSE, NULL, NULL),
('starter', 'lesson_plans', 'Lesson plans & homework', FALSE, NULL, NULL),
('starter', 'dorm_management', 'Dorm management', FALSE, NULL, NULL),
('starter', 'transport', 'Transport modules', FALSE, NULL, NULL),
('starter', 'library', 'Library management', FALSE, NULL, NULL),
('starter', 'budgets', 'Finance enhanced (budgets)', FALSE, NULL, NULL),
('starter', 'uneb_registration', 'UNEB registration', FALSE, NULL, NULL),
('starter', 'moes_exports', 'MoES exports', FALSE, NULL, NULL),
('starter', 'payroll', 'Full payroll management', FALSE, NULL, NULL),
('starter', 'staff_leave', 'Staff leave & substitutions', FALSE, NULL, NULL),
('starter', 'ai_insights', 'AI insights & DNA analysis', FALSE, NULL, NULL),
('starter', 'workflow_automation', 'Workflow automation', FALSE, NULL, NULL),
('starter', 'audit_logs', 'Full audit logs', FALSE, NULL, NULL),
('starter', 'api_access', 'API access', FALSE, NULL, NULL),
('starter', 'multi_branch', 'Multi-branch support', FALSE, NULL, NULL),

-- GROWTH (UGX 3,500/student/term)
('growth', 'student_records', 'Student records & profiles', TRUE, NULL, NULL),
('growth', 'daily_attendance', 'Daily attendance', TRUE, NULL, NULL),
('growth', 'ca_grades', 'CA grades & report cards', TRUE, NULL, NULL),
('growth', 'fee_collection', 'Fee collection & tracking', TRUE, NULL, NULL),
('growth', 'momo_payment', 'MoMo/Airtel payment', TRUE, NULL, NULL),
('growth', 'offline_sync', 'Basic offline sync', TRUE, NULL, NULL),
('growth', 'id_cards', 'ID card generation', TRUE, NULL, NULL),
('growth', 'admin_users', 'Admin users', TRUE, 10, 'users'),
('growth', 'bulk_sms', 'Bulk SMS', TRUE, 500, 'sms_per_term'),
('growth', 'parent_portal', 'Parent portal', TRUE, NULL, NULL),
('growth', 'syllabus', 'Syllabus & scheme of work', TRUE, NULL, NULL),
('growth', 'lesson_plans', 'Lesson plans & homework', TRUE, NULL, NULL),
('growth', 'dorm_management', 'Dorm management', TRUE, NULL, NULL),
('growth', 'transport', 'Transport modules', TRUE, NULL, NULL),
('growth', 'library', 'Library management', TRUE, NULL, NULL),
('growth', 'budgets', 'Finance enhanced (budgets)', TRUE, NULL, NULL),
('growth', 'uneb_registration', 'UNEB registration', FALSE, NULL, NULL),
('growth', 'moes_exports', 'MoES exports', FALSE, NULL, NULL),
('growth', 'payroll', 'Full payroll management', FALSE, NULL, NULL),
('growth', 'staff_leave', 'Staff leave & substitutions', FALSE, NULL, NULL),
('growth', 'ai_insights', 'AI insights & DNA analysis', FALSE, NULL, NULL),
('growth', 'workflow_automation', 'Workflow automation', FALSE, NULL, NULL),
('growth', 'audit_logs', 'Full audit logs', FALSE, NULL, NULL),
('growth', 'api_access', 'API access', FALSE, NULL, NULL),
('growth', 'multi_branch', 'Multi-branch support', FALSE, NULL, NULL),

-- ENTERPRISE (UGX 5,500/student/term)
('enterprise', 'student_records', 'Student records & profiles', TRUE, NULL, NULL),
('enterprise', 'daily_attendance', 'Daily attendance', TRUE, NULL, NULL),
('enterprise', 'ca_grades', 'CA grades & report cards', TRUE, NULL, NULL),
('enterprise', 'fee_collection', 'Fee collection & tracking', TRUE, NULL, NULL),
('enterprise', 'momo_payment', 'MoMo/Airtel payment', TRUE, NULL, NULL),
('enterprise', 'offline_sync', 'Basic offline sync', TRUE, NULL, NULL),
('enterprise', 'id_cards', 'ID card generation', TRUE, NULL, NULL),
('enterprise', 'admin_users', 'Admin users', TRUE, -1, 'unlimited'),
('enterprise', 'bulk_sms', 'Bulk SMS', TRUE, -1, 'unlimited'),
('enterprise', 'parent_portal', 'Parent portal', TRUE, NULL, NULL),
('enterprise', 'syllabus', 'Syllabus & scheme of work', TRUE, NULL, NULL),
('enterprise', 'lesson_plans', 'Lesson plans & homework', TRUE, NULL, NULL),
('enterprise', 'dorm_management', 'Dorm management', TRUE, NULL, NULL),
('enterprise', 'transport', 'Transport modules', TRUE, NULL, NULL),
('enterprise', 'library', 'Library management', TRUE, NULL, NULL),
('enterprise', 'budgets', 'Finance enhanced (budgets)', TRUE, NULL, NULL),
('enterprise', 'uneb_registration', 'UNEB registration', TRUE, NULL, NULL),
('enterprise', 'moes_exports', 'MoES exports', TRUE, NULL, NULL),
('enterprise', 'payroll', 'Full payroll management', TRUE, NULL, NULL),
('enterprise', 'staff_leave', 'Staff leave & substitutions', TRUE, NULL, NULL),
('enterprise', 'ai_insights', 'AI insights & DNA analysis', TRUE, NULL, NULL),
('enterprise', 'workflow_automation', 'Workflow automation', TRUE, NULL, NULL),
('enterprise', 'audit_logs', 'Full audit logs', TRUE, NULL, NULL),
('enterprise', 'api_access', 'API access', TRUE, NULL, NULL),
('enterprise', 'multi_branch', 'Multi-branch support', TRUE, NULL, NULL),

-- LIFETIME (UGX 8-15M one-time)
('lifetime', 'all_growth_features', 'All Growth features', TRUE, NULL, NULL),
('lifetime', 'all_enterprise_features', 'All Enterprise features', TRUE, NULL, NULL),
('lifetime', 'source_code', 'Source code license', TRUE, NULL, NULL),
('lifetime', 'on_premise', 'On-premise deployment', TRUE, NULL, NULL),
('lifetime', 'white_label', 'White-label option', TRUE, NULL, NULL),
('lifetime', 'dedicated_onboarding', '2-day dedicated onboarding', TRUE, NULL, NULL),
('lifetime', 'support_1year', '1-year support included', TRUE, NULL, NULL);

-- 3. Create subscription payments history table
CREATE TABLE IF NOT EXISTS subscription_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    plan TEXT NOT NULL CHECK (plan IN ('starter', 'growth', 'enterprise', 'lifetime')),
    amount_paid INTEGER NOT NULL,
    currency TEXT DEFAULT 'UGX',
    payment_method TEXT CHECK (payment_method IN ('momo', 'bank', 'cash', 'card', 'paypal')),
    transaction_id TEXT,
    payment_status TEXT CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_for_term TEXT,
    student_count INTEGER,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create plan limits helper view
CREATE OR REPLACE VIEW plan_limits AS
SELECT 
    s.id as school_id,
    s.subscription_plan,
    s.price_per_student,
    s.payment_frequency,
    s.student_count,
    s.admin_users_allowed,
    s.sms_quota_monthly,
    s.lifetime_license,
    pf.feature_key,
    pf.feature_name,
    pf.included,
    pf.limit_value,
    pf.unit
FROM schools s
LEFT JOIN plan_features pf ON pf.plan = s.subscription_plan;

-- 5. Function to check if a feature is enabled for a school
CREATE OR REPLACE FUNCTION has_feature(school_id UUID, feature_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    plan_val TEXT;
    included_val BOOLEAN;
BEGIN
    SELECT s.subscription_plan INTO plan_val FROM schools s WHERE s.id = school_id;
    
    SELECT pf.included INTO included_val 
    FROM plan_features pf 
    WHERE pf.plan = plan_val AND pf.feature_key = feature_key;
    
    RETURN COALESCE(included_val, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to get SMS quota remaining
CREATE OR REPLACE FUNCTION get_sms_quota(school_id UUID)
RETURNS INTEGER AS $$
DECLARE
    plan_val TEXT;
    quota INTEGER;
    used INTEGER;
BEGIN
    SELECT s.subscription_plan, COALESCE(s.sms_quota_monthly, 0)
    INTO plan_val, quota
    FROM schools s WHERE s.id = school_id;
    
    -- Get used count from last 30 days
    SELECT COUNT(*) INTO used FROM sms_logs 
    WHERE school_id = school_id 
    AND created_at > NOW() - INTERVAL '30 days';
    
    RETURN quota - used;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant permissions
GRANT SELECT ON plan_features TO authenticated;
GRANT SELECT ON subscription_history TO authenticated;
GRANT SELECT ON plan_limits TO authenticated;
GRANT SELECT ON has_feature TO authenticated;
GRANT SELECT ON get_sms_quota TO authenticated;

-- 8. Update existing demo school to starter plan
UPDATE schools SET subscription_plan = 'starter', price_per_student = 2000, admin_users_allowed = 3 WHERE name LIKE '%Demo%';

-- 9. Add indexes
CREATE INDEX IF NOT EXISTS idx_plan_features_plan ON plan_features(plan);
CREATE INDEX IF NOT EXISTS idx_subscription_history_school ON subscription_history(school_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_status ON subscription_history(payment_status);

-- 10. Add RLS policies
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schools can view own plan features" ON plan_features
    FOR SELECT USING (TRUE);
    
CREATE POLICY "Schools can view own subscription history" ON subscription_history
    FOR SELECT USING (school_id = (SELECT school_id FROM users WHERE auth_id = auth.uid()) OR role = 'super_admin');

-- ============================================
-- Migration complete
-- ============================================