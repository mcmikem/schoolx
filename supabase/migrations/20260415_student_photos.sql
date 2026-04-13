-- Add student photo capabilities
ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS passport_photo_url TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_students_photo ON students(photo_url) WHERE photo_url IS NOT NULL;

COMMENT ON COLUMN students.photo_url IS 'Student passport photo URL';
COMMENT ON COLUMN students.passport_photo_url IS 'Alternative passport photo for ID cards';