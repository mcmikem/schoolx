'use client'
import { useState } from 'react'
import { Database, CheckCircle, XCircle, Loader2, Copy, ExternalLink, Shield, Activity, Zap, Star, ChevronRight } from 'lucide-react'
import BackgroundBlobs from '@/components/BackgroundBlobs'

const SQL_SCRIPT = `-- ============================================
-- OMUTO SCHOOL MANAGEMENT SYSTEM (V3 CORE)
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. PRE-REQUISITE: SQL EXECUTION PROTOCOL
-- Run this FIRST if you want the "Execute Audit" button to work
-- create or replace function exec_sql(sql text)
-- returns void
-- language plpgsql
-- security definer
-- as $$
-- begin
--   execute sql;
-- end;
-- $$;

-- 1. SCHOOLS
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  school_code TEXT UNIQUE NOT NULL,
  district TEXT NOT NULL,
  subcounty TEXT,
  parish TEXT,
  village TEXT,
  school_type TEXT CHECK (school_type IN ('primary', 'secondary', 'combined')) NOT NULL,
  ownership TEXT CHECK (ownership IN ('private', 'government', 'government_aided')) DEFAULT 'private',
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#5D2FFB',
  uneab_center_number TEXT,
  subscription_plan TEXT CHECK (subscription_plan IN ('free', 'basic', 'premium')) DEFAULT 'free',
  subscription_status TEXT CHECK (subscription_status IN ('active', 'expired', 'trial')) DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  role TEXT CHECK (role IN ('super_admin', 'school_admin', 'teacher', 'student', 'parent')) NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CLASSES
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT NOT NULL,
  stream TEXT,
  class_teacher_id UUID,
  max_students INTEGER DEFAULT 60,
  academic_year TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SUBJECTS
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  level TEXT CHECK (level IN ('primary', 'secondary', 'both')) DEFAULT 'both',
  is_compulsory BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. STUDENTS
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID,
  student_number TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('M', 'F')) NOT NULL,
  date_of_birth DATE,
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_phone2 TEXT,
  parent_email TEXT,
  address TEXT,
  class_id UUID REFERENCES classes(id),
  admission_date DATE DEFAULT CURRENT_DATE,
  ple_index_number TEXT,
  uneab_number TEXT,
  blood_type TEXT,
  religion TEXT,
  nationality TEXT DEFAULT 'Ugandan',
  photo_url TEXT,
  status TEXT CHECK (status IN ('active', 'transferred', 'dropped', 'completed')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, student_number)
);

-- 6. ATTENDANCE
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT CHECK (status IN ('present', 'absent', 'late', 'excused')) NOT NULL,
  remarks TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- 7. GRADES
CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  assessment_type TEXT CHECK (assessment_type IN ('ca1', 'ca2', 'ca3', 'ca4', 'project', 'exam')) NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) DEFAULT 100,
  term INTEGER CHECK (term IN (1, 2, 3)) NOT NULL,
  academic_year TEXT NOT NULL,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_id, assessment_type, term, academic_year)
);

-- 8. FEE STRUCTURE
CREATE TABLE IF NOT EXISTS fee_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  term INTEGER CHECK (term IN (1, 2, 3)) NOT NULL,
  academic_year TEXT NOT NULL,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. FEE PAYMENTS
CREATE TABLE IF NOT EXISTS fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  fee_id UUID REFERENCES fee_structure(id) ON DELETE CASCADE,
  amount_paid NUMERIC(12,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash', 'mobile_money', 'bank', 'installment')) NOT NULL,
  payment_reference TEXT,
  paid_by TEXT,
  notes TEXT,
  payment_date DATE DEFAULT CURRENT_DATE,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. EVENTS
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT CHECK (event_type IN ('exam', 'meeting', 'holiday', 'event', 'academic')) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  recipient_type TEXT CHECK (recipient_type IN ('individual', 'class', 'all')) NOT NULL,
  recipient_id UUID,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'sent', 'delivered', 'failed')) DEFAULT 'pending',
  sent_by UUID,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. PARENT-STUDENT LINK
CREATE TABLE IF NOT EXISTS parent_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'parent',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, student_id)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes(school_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to access their school data
CREATE POLICY "School access" ON students FOR ALL USING (
  school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "School access" ON classes FOR ALL USING (
  school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "School access" ON attendance FOR ALL USING (
  class_id IN (SELECT id FROM classes WHERE school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()))
);

CREATE POLICY "School access" ON grades FOR ALL USING (
  class_id IN (SELECT id FROM classes WHERE school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()))
);`;

export default function SetupPage() {
  const [copied, setCopied] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, string>>({})

  const copySQL = () => {
    navigator.clipboard.writeText(SQL_SCRIPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResults({})

    try {
      const response = await fetch('/api/setup', { method: 'POST' })
      const data = await response.json()
      setTestResults(data.results || {})
    } catch (error) {
      setTestResults({ error: 'Failed to connect' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-12 pb-24 animate-fade-in relative z-10">
      <BackgroundBlobs />
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
           <div className="flex items-center gap-3 mb-3">
             <div className="w-8 h-8 rounded-lg bg-primary-800 flex items-center justify-center shadow-lg shadow-primary-500/20">
               <Database className="w-4 h-4 text-white fill-white" />
             </div>
             <span className="text-[10px] font-black text-primary-800 uppercase tracking-[4px]">System Architecture</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Database Provisioning</h1>
          <p className="text-gray-400 font-bold mt-2 text-base max-w-lg">Initialize the high-fidelity cloud schema and security protocols for Omuto SMS.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Step-by-Step Architecture Guide */}
        <div className="lg:col-span-8 space-y-8">
          {/* Step 1 */}
          <div className="bg-white/70 backdrop-blur-xl rounded-[48px] border border-white shadow-2xl shadow-gray-200/10 p-10 group hover:bg-white transition-all duration-500">
            <div className="flex items-center gap-6 mb-8 text-primary-800">
               <div className="w-14 h-14 bg-primary-800 text-white rounded-[24px] flex items-center justify-center text-xl font-black shadow-xl shadow-primary-500/20 group-hover:rotate-6 transition-all">1</div>
               <div>
                  <h2 className="text-2xl font-black text-gray-900 leading-tight tracking-tight">Access Cloud Editor</h2>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[3px] mt-1 leading-none italic">Supabase SQL Protocol Termination</p>
               </div>
            </div>
            <p className="text-gray-500 font-bold text-sm leading-relaxed mb-8 max-w-lg">
              Navigate to the localized Supabase architecture dashboard and initiate a fresh SQL command sequence.
            </p>
            <a
              href="https://gucxpmgwvnbqykevucbi.supabase.co/project/_/sql/new"
              target="_blank"
              rel="noopener noreferrer"
              className="h-16 px-10 bg-black text-white rounded-[24px] font-black text-xs uppercase tracking-[3px] flex items-center gap-4 hover:bg-primary-800 transition-all shadow-2xl active:scale-95 w-fit"
            >
              <ExternalLink className="w-5 h-5" />
              Initiate SQL Console
            </a>
          </div>

          {/* Step 2 */}
          <div className="bg-white/70 backdrop-blur-xl rounded-[48px] border border-white shadow-2xl shadow-gray-200/10 p-10 group hover:bg-white transition-all duration-500">
            <div className="flex items-center gap-6 mb-8 text-primary-800">
               <div className="w-14 h-14 bg-primary-800 text-white rounded-[24px] flex items-center justify-center text-xl font-black shadow-xl shadow-primary-500/20 group-hover:rotate-6 transition-all">2</div>
               <div>
                  <h2 className="text-2xl font-black text-gray-900 leading-tight tracking-tight">Inject Core Schema</h2>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[3px] mt-1 leading-none italic">Data Matrix Provisioning</p>
               </div>
            </div>
            <p className="text-gray-500 font-bold text-sm leading-relaxed mb-8 max-w-lg">
              Synchronize the specialized Omuto V3 schema with your cloud environment via total script injection.
            </p>
            <button
              onClick={copySQL}
              className="h-16 px-10 bg-primary-800 text-white rounded-[24px] font-black text-xs uppercase tracking-[3px] flex items-center gap-4 hover:bg-black transition-all shadow-2xl shadow-primary-500/30 active:scale-95 w-fit"
            >
              {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copied ? 'Payload Copied' : 'Copy SQL Protocol'}
            </button>
            <div className="mt-8 relative group">
               <pre className="bg-gray-950 text-emerald-400/80 p-10 rounded-[40px] text-xs font-mono overflow-x-auto max-h-60 overflow-y-auto leading-relaxed border border-gray-800 shadow-2xl">
                 {SQL_SCRIPT.substring(0, 500)}...
               </pre>
               <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 to-transparent pointer-events-none rounded-[40px]" />
               <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-black text-gray-500 uppercase tracking-[4px]">Full Protocol Stored in Buffer</div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white/70 backdrop-blur-xl rounded-[48px] border border-white shadow-2xl shadow-gray-200/10 p-10 group hover:bg-white transition-all duration-500">
            <div className="flex items-center gap-6 mb-8 text-primary-800">
               <div className="w-14 h-14 bg-primary-800 text-white rounded-[24px] flex items-center justify-center text-xl font-black shadow-xl shadow-primary-500/20 group-hover:rotate-6 transition-all">3</div>
               <div>
                  <h2 className="text-2xl font-black text-gray-900 leading-tight tracking-tight">Connection Audit</h2>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[3px] mt-1 leading-none italic">Interface Validation Protocol</p>
               </div>
            </div>
            <p className="text-gray-500 font-bold text-sm leading-relaxed mb-8 max-w-lg">
              Execute a global audit to verify that all V3 operational matrices have been successfully instantiated.
            </p>
            <button
              onClick={testConnection}
              disabled={testing}
              className="h-16 px-10 bg-black text-white rounded-[24px] font-black text-xs uppercase tracking-[3px] flex items-center gap-4 hover:bg-emerald-600 transition-all shadow-2xl active:scale-95 disabled:opacity-50 w-fit"
            >
              {testing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
              {testing ? 'Auditing Matrix...' : 'Execute Audit'}
            </button>

            {Object.keys(testResults).length > 0 && (
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-4 duration-500">
                {Object.entries(testResults).map(([table, status]) => (
                  <div key={table} className="flex items-center justify-between p-5 bg-white rounded-2xl border border-gray-50 shadow-sm transition-all group hover:border-emerald-100">
                    <div className="flex items-center gap-4">
                       <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${status === 'Created' || status === 'Exists' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                          {status === 'Created' || status === 'Exists' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                       </div>
                       <span className="text-xs font-black text-gray-700 tracking-tight uppercase group-hover:text-emerald-600 transition-smooth">{table}</span>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-[2px] ${status === 'Created' || status === 'Exists' ? 'text-emerald-500' : 'text-red-600'}`}>
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Temporal Sidebar Stats */}
        <div className="lg:col-span-4 space-y-8">
           <div className="bg-primary-900/90 backdrop-blur-xl rounded-[48px] p-10 text-white shadow-2xl shadow-primary-500/30 relative overflow-hidden group">
              <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-8 opacity-60">
                    <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="text-[10px] font-black uppercase tracking-[3px]">Next Operations</span>
                 </div>
                 <ul className="space-y-6">
                    {[
                      { step: 'Scholastic Registration', route: '/register' },
                      { step: 'Data Ingestion', route: '/dashboard/import' },
                      { step: 'Financial Configuration', route: '/dashboard/fees' },
                      { step: 'Institutional Identity', route: '/dashboard/settings' },
                    ].map((item, i) => (
                      <li key={i} className="group/item">
                        <a href={item.route} className="flex items-center justify-between group-hover/item:translate-x-2 transition-all duration-500">
                           <div>
                              <div className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-1">STAIR {i+1}</div>
                              <div className="text-sm font-black tracking-tight">{item.step}</div>
                           </div>
                           <ChevronRight className="w-5 h-5 text-white/20 group-hover/item:text-white transition-smooth" />
                        </a>
                      </li>
                    ))}
                 </ul>
              </div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full blur-3xl group-hover:scale-150 transition-all duration-1000" />
           </div>

           <div className="bg-white/70 backdrop-blur-xl rounded-[48px] border border-white shadow-2xl shadow-gray-200/20 p-10 space-y-8">
              <div className="flex items-center gap-3">
                 <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                 <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[4px]">System Integrity</h3>
              </div>
              <p className="text-sm font-bold text-gray-500 leading-relaxed italic">
                Omuto V3 utilizes specialized high-fidelity indexing to ensure sub-millisecond data retrieval across the entire educational cloud ecosystem.
              </p>
              <div className="pt-6 border-t border-gray-50">
                 <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-300">
                    <span>SECURITY GRID</span>
                    <span className="text-emerald-500">ACTIVE</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
