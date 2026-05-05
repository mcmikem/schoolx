-- Add missing nationality column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Ugandan';