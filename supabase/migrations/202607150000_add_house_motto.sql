-- Add motto column to houses table
-- The settings UI already supports house mottos, but the column was never created

ALTER TABLE houses
ADD COLUMN IF NOT EXISTS motto TEXT;
