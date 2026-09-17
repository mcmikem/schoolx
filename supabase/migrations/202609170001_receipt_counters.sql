-- Per-school atomic receipt numbering.
-- Read-max-plus-one in the client raced when two devices receipted at once
-- (UNIQUE(school_id, receipt_number) turned the loser into a 500). This
-- counter makes the next number atomic: INSERT ... ON CONFLICT DO UPDATE
-- takes a row lock, so concurrent callers serialize and never collide.

CREATE TABLE IF NOT EXISTS receipt_counters (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE receipt_counters ENABLE ROW LEVEL SECURITY;
-- No permissive policies: only the SECURITY DEFINER function below touches it.

CREATE OR REPLACE FUNCTION next_receipt_number(p_school_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num INTEGER;
BEGIN
  INSERT INTO receipt_counters AS rc (school_id, last_number)
  VALUES (p_school_id, 1)
  ON CONFLICT (school_id) DO UPDATE SET last_number = rc.last_number + 1
  RETURNING last_number INTO v_num;
  RETURN 'RCP-' || LPAD(v_num::TEXT, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION next_receipt_number(UUID) TO authenticated;

-- Backfill from printed history so numbering continues per school instead of
-- restarting at RCP-000001 (auditors rely on sequential receipt books).
INSERT INTO receipt_counters (school_id, last_number)
SELECT
  school_id,
  COALESCE(MAX(CAST(NULLIF(regexp_replace(receipt_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0)
FROM receipts
GROUP BY school_id
ON CONFLICT (school_id) DO NOTHING;
