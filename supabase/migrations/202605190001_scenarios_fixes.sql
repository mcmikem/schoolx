-- Migration to address scenarios 5, 11, 18, 19

-- 1. Scenario #5: Ghost Student
-- Add 'pending' to students status check constraint
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;
ALTER TABLE students ADD CONSTRAINT students_status_check CHECK (status IN ('active', 'transferred', 'dropped', 'completed', 'pending'));

-- 2. Scenario #11: Simultaneous Attendance
-- Add period_number to attendance table to support multiple sessions per day
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS period_number INTEGER DEFAULT 1;
-- Drop old unique constraint and add new one including period
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_date_key;
ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_date_period_key UNIQUE(student_id, date, period_number);

-- 3. Scenario #18: Missing NIN
-- Add NIN column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS nin TEXT;

-- 4. Scenario #19: Co-curricular Ignore
-- Create co_curricular_activities table
CREATE TABLE IF NOT EXISTS co_curricular_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    activity_name TEXT NOT NULL,
    description TEXT,
    date DATE,
    achievements TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE co_curricular_activities ENABLE ROW LEVEL SECURITY;

-- Create policy for school users
DROP POLICY IF EXISTS "School users co_curricular all" ON co_curricular_activities;
CREATE POLICY "School users co_curricular all" ON co_curricular_activities FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_id = auth.uid()
      AND users.school_id IN (SELECT school_id FROM students WHERE students.id = co_curricular_activities.student_id)
  )
);
