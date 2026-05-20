-- Migration: co_curricular_activities
-- Creates table to track co‑curricular activities per student and RLS policies

CREATE TABLE IF NOT EXISTS co_curricular_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  period TEXT, -- e.g., "2023 Q1"
  score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS: allow Headmaster and admins full access, teachers read‑only, others none
DROP POLICY IF EXISTS co_curricular_select ON co_curricular_activities;
CREATE POLICY co_curricular_select ON co_curricular_activities
  FOR SELECT USING (auth.role() = 'headmaster' OR auth.role() = 'admin' OR auth.role() = 'teacher');

DROP POLICY IF EXISTS co_curricular_insert ON co_curricular_activities;
CREATE POLICY co_curricular_insert ON co_curricular_activities
  FOR INSERT WITH CHECK (auth.role() = 'headmaster' OR auth.role() = 'admin');

DROP POLICY IF EXISTS co_curricular_update ON co_curricular_activities;
CREATE POLICY co_curricular_update ON co_curricular_activities
  FOR UPDATE USING (auth.role() = 'headmaster' OR auth.role() = 'admin');

DROP POLICY IF EXISTS co_curricular_delete ON co_curricular_activities;
CREATE POLICY co_curricular_delete ON co_curricular_activities
  FOR DELETE USING (auth.role() = 'headmaster' OR auth.role() = 'admin');

-- Migration tracking handled by Supabase CLI; manual INSERT removed
