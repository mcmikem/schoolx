-- Add boarding_type column to fee_structure table
-- Allows differentiation between day scholars and boarding students

ALTER TABLE fee_structure ADD COLUMN IF NOT EXISTS boarding_type TEXT
  CHECK (boarding_type IN ('day', 'all', 'boarding')) DEFAULT 'day';

-- Add a comment for documentation
COMMENT ON COLUMN fee_structure.boarding_type IS 'Determines if fee applies to day scholars, all students, or boarding students only';
