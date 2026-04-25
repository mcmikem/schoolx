-- Check missing columns
SELECT 'feature_stage' as col, EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='feature_stage') as exists
UNION ALL
SELECT 'onboarding_completed', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='onboarding_completed')
UNION ALL
SELECT 'setup_progress', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='schools' AND column_name='setup_progress')
UNION ALL
SELECT 'blood_type', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='blood_type')
UNION ALL
SELECT 'religion', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='religion');