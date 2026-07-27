-- Add digitization_fee as a valid earning_type for marketer_earnings
ALTER TABLE marketer_earnings DROP CONSTRAINT IF EXISTS marketer_earnings_earning_type_check;
ALTER TABLE marketer_earnings ADD CONSTRAINT marketer_earnings_earning_type_check
  CHECK (earning_type IN ('onboarding_bonus', 'subscription_commission', 'performance_bonus', 'adjustment', 'digitization_fee'));
