'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const SQL_SCRIPT = `-- SchoolX Database Setup
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schools table
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  school_code TEXT UNIQUE NOT NULL,
  district TEXT NOT NULL,
  subcounty TEXT,
  parish TEXT,
  village TEXT,
  school_type TEXT DEFAULT 'primary',
  ownership TEXT DEFAULT 'private',
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1e40af',
  uneab_center_number TEXT,
  subscription_plan TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id UUID UNIQUE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'teacher',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID,
  student_number TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('M', 'F')),
  date_of_birth DATE,
  parent_name TEXT,
  parent_phone TEXT,
  parent_phone2 TEXT,
  parent_email TEXT,
  address TEXT,
  class_id UUID,
  admission_date DATE DEFAULT CURRENT_DATE,
  ple_index_number TEXT,
  uneab_number TEXT,
  blood_type TEXT,
  religion TEXT,
  nationality TEXT DEFAULT 'Ugandan',
  photo_url TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT,
  stream TEXT,
  class_teacher_id UUID,
  max_students INTEGER DEFAULT 50,
  academic_year TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  level TEXT DEFAULT 'both',
  is_compulsory BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT CHECK (status IN ('present', 'absent', 'late', 'excused')),
  remarks TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- Grades table
CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  assessment_type TEXT CHECK (assessment_type IN ('ca1', 'ca2', 'ca3', 'ca4', 'project', 'exam')),
  score NUMERIC DEFAULT 0,
  max_score NUMERIC DEFAULT 100,
  term INTEGER CHECK (term IN (1, 2, 3)),
  academic_year TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_id, assessment_type, term, academic_year)
);

-- Fee structure table
CREATE TABLE IF NOT EXISTS fee_structure (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  term INTEGER CHECK (term IN (1, 2, 3)),
  academic_year TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fee payments table
CREATE TABLE IF NOT EXISTS fee_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  fee_id UUID REFERENCES fee_structure(id) ON DELETE CASCADE,
  amount_paid NUMERIC NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  payment_reference TEXT,
  paid_by TEXT,
  notes TEXT,
  payment_date DATE DEFAULT CURRENT_DATE,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'event',
  start_date DATE NOT NULL,
  end_date DATE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  recipient_type TEXT CHECK (recipient_type IN ('individual', 'class', 'all')),
  recipient_id UUID,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_by UUID,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timetable table
CREATE TABLE IF NOT EXISTS timetable (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES users(id),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Topic coverage table
CREATE TABLE IF NOT EXISTS topic_coverage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  topic_name TEXT NOT NULL,
  status TEXT DEFAULT 'not_started',
  teacher_id UUID REFERENCES users(id),
  term INTEGER,
  academic_year TEXT,
  date_completed TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id);

-- Enable RLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_coverage ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to access their data
CREATE POLICY "Allow all for authenticated" ON schools FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON users FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON students FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON classes FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON attendance FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON grades FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON fee_structure FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON fee_payments FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON events FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON messages FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON timetable FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON topic_coverage FOR ALL USING (true);`

export default function SetupPage() {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, string>>({})

  const copySQL = () => {
    navigator.clipboard.writeText(SQL_SCRIPT)
    setCopied(true)
    toast.success('SQL copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResults({})

    try {
      const response = await fetch('/api/setup', { method: 'POST' })
      const data = await response.json()
      setTestResults(data.results || {})
      toast.success('Setup complete')
    } catch (error) {
      setTestResults({ error: 'Failed to connect' })
      toast.error('Setup failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Database Setup</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Set up your Supabase database tables</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SQL Section */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">SQL Schema</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Copy this SQL and run it in your Supabase SQL Editor to create all required tables.
          </p>
          
          <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto mb-4">
            <pre className="text-xs text-green-400 whitespace-pre-wrap">{SQL_SCRIPT.substring(0, 1000)}...</pre>
          </div>
          
          <div className="flex gap-3">
            <button onClick={copySQL} className="btn btn-primary flex-1">
              {copied ? 'Copied!' : 'Copy Full SQL'}
            </button>
            <a 
              href="https://gucxpmgwvnbqykevucbi.supabase.co/project/_/sql/new"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary flex-1"
            >
              Open SQL Editor
            </a>
          </div>
        </div>

        {/* Actions Section */}
        <div className="space-y-6">
          {/* Test Connection */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Run Setup</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Click the button below to create all required database tables automatically.
            </p>
            
            <button 
              onClick={testConnection} 
              disabled={testing}
              className="btn btn-primary w-full"
            >
              {testing ? 'Running Setup...' : 'Run Setup'}
            </button>

            {Object.keys(testResults).length > 0 && (
              <div className="mt-4 space-y-2">
                {Object.entries(testResults).map(([table, status]) => (
                  <div key={table} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{table}</span>
                    <span className={`badge ${status === 'Created' || status === 'Exists' ? 'badge-success' : 'badge-danger'}`}>
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Steps */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Setup Steps</h2>
            <div className="space-y-3">
              {[
                { step: 'Create Supabase Project', description: 'Go to supabase.com and create a project' },
                { step: 'Copy Environment Variables', description: 'Add URL and keys to .env.local' },
                { step: 'Run SQL Schema', description: 'Copy SQL above and run in SQL Editor' },
                { step: 'Run Setup', description: 'Click button above to create tables' },
                { step: 'Register School', description: 'Go to /register to create your school' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 dark:text-blue-300 text-xs font-bold">{i + 1}</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{item.step}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
