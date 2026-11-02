-- Launch promo as a redeemable code (in addition to the always-on
-- PLATFORM_PROMO_PERCENT applied at quote time). Lets marketing retire or
-- replace the launch offer without a deploy: set active = false.
INSERT INTO promo_codes (code, description, percent_off, applies_to_plan, active, created_by)
VALUES ('LAUNCH30', 'Launch offer — 30% off any plan or module', 30, NULL, TRUE, NULL)
ON CONFLICT (code) DO NOTHING;
