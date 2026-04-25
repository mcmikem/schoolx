SELECT 'academic_terms' as tbl, EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='academic_terms' AND table_schema='public') as exists
UNION ALL
SELECT 'subscription_payments', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='subscription_payments' AND table_schema='public')
UNION ALL
SELECT 'pending_mobile_payments', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='pending_mobile_payments' AND table_schema='public')
UNION ALL
SELECT 'setup_checklist', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='setup_checklist' AND table_schema='public')
UNION ALL
SELECT 'rate_limit_log', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='rate_limit_log' AND table_schema='public')
UNION ALL
SELECT 'students', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='students' AND table_schema='public');