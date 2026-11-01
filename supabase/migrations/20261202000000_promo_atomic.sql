-- Atomic, cap-aware promo redemption counter.
-- Returns: 1 = redeemed, 0 = cap reached, -1 = code not found / inactive.
CREATE OR REPLACE FUNCTION increment_promo_redemption(p_code TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INTEGER;
  v_current INTEGER;
BEGIN
  SELECT max_redemptions, times_redeemed
    INTO v_max, v_current
    FROM promo_codes
    WHERE code = p_code AND active
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  IF v_max IS NOT NULL AND v_current >= v_max THEN
    RETURN 0;
  END IF;

  UPDATE promo_codes
     SET times_redeemed = times_redeemed + 1
   WHERE code = p_code;

  RETURN 1;
END $$;
