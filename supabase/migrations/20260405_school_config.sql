-- School Configuration & Real-World Features
-- Run in Supabase SQL Editor

-- 1. Student ID format configuration
ALTER TABLE schools ADD COLUMN IF NOT EXISTS student_id_format TEXT DEFAULT 'STU{YYYY}{####}';
-- Format tokens: {YYYY}=year, {####}=sequential, {CLASS}=class code, {GENDER}=M/F

-- 2. House system
CREATE TABLE IF NOT EXISTS houses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  motto TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Student additional fields
ALTER TABLE students ADD COLUMN IF NOT EXISTS previous_school TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS boarding_status TEXT DEFAULT 'day'; -- day, boarding, weekly
ALTER TABLE students ADD COLUMN IF NOT EXISTS house_id UUID REFERENCES houses(id);
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_council_role TEXT; -- president, vice_president, secretary, etc.
ALTER TABLE students ADD COLUMN IF NOT EXISTS prefect_role TEXT; -- head_boy, head_girl, sports_prefect, etc.
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_class_monitor BOOLEAN DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS games_house TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS district_origin TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS sub_county TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parish TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS village TEXT;

-- 4. Class streams configuration
ALTER TABLE classes ADD COLUMN IF NOT EXISTS has_streams BOOLEAN DEFAULT false;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS stream_names TEXT[] DEFAULT '{A,B,C}';
-- e.g., {A, B, C} means P.7A, P.7B, P.7C

-- 5. School type configuration
ALTER TABLE schools ADD COLUMN IF NOT EXISTS has_boarding BOOLEAN DEFAULT false;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS has_houses BOOLEAN DEFAULT false;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS has_student_council BOOLEAN DEFAULT false;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS has_prefects BOOLEAN DEFAULT false;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'urban'; -- urban, peri_urban, rural

-- 6. Leadership roles table
CREATE TABLE IF NOT EXISTS student_leadership (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  role_type TEXT NOT NULL, -- class_monitor, prefect, councillor, class_teacher
  role_name TEXT NOT NULL, -- e.g., "Head Boy", "P.7A Monitor", "Sports Prefect"
  academic_year TEXT NOT NULL,
  term INTEGER NOT NULL,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, role_type, academic_year, term)
);

ALTER TABLE houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_leadership ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schools manage their houses" ON houses
  FOR ALL USING (school_id IN (SELECT id FROM schools WHERE id = school_id));

CREATE POLICY "Schools manage student leadership" ON student_leadership
  FOR ALL USING (school_id IN (SELECT id FROM schools WHERE id = school_id));

-- Default houses for demo school
INSERT INTO houses (school_id, name, color, motto) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Nile', '#3b82f6', 'Flowing Forward'),
  ('00000000-0000-0000-0000-000000000001', 'Victoria', '#ef4444', 'Victory Awaits'),
  ('00000000-0000-0000-0000-000000000001', 'Albert', '#22c55e', 'Strength in Unity'),
  ('00000000-0000-0000-0000-000000000001', 'Edward', '#f59e0b', 'Excellence Always')
ON CONFLICT DO NOTHING;
