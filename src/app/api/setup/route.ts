import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { apiSuccess, apiError, handleApiError } from '@/lib/api-utils'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST() {
  try {
    if (!supabaseServiceKey) {
      return apiError('SUPABASE_SERVICE_ROLE_KEY not set. Add it to .env.local', 400)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const results: Record<string, string> = {}

    const tables = [
      {
        name: 'schools',
        sql: `
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
            primary_color TEXT DEFAULT '#1e3a5f',
            uneab_center_number TEXT,
            subscription_plan TEXT CHECK (subscription_plan IN ('free', 'basic', 'premium')) DEFAULT 'free',
            subscription_status TEXT CHECK (subscription_status IN ('active', 'expired', 'trial')) DEFAULT 'trial',
            trial_ends_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `,
      },
      {
        name: 'users',
        sql: `
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
        `,
      },
      {
        name: 'classes',
        sql: `
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
        `,
      },
      {
        name: 'subjects',
        sql: `
          CREATE TABLE IF NOT EXISTS subjects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            code TEXT NOT NULL,
            level TEXT CHECK (level IN ('primary', 'secondary', 'both')) DEFAULT 'both',
            is_compulsory BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `,
      },
      {
        name: 'students',
        sql: `
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
        `,
      },
      {
        name: 'attendance',
        sql: `
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
        `,
      },
      {
        name: 'grades',
        sql: `
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
        `,
      },
      {
        name: 'fee_structure',
        sql: `
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
        `,
      },
      {
        name: 'fee_payments',
        sql: `
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
        `,
      },
      {
        name: 'events',
        sql: `
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
        `,
      },
      {
        name: 'messages',
        sql: `
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
        `,
      },
      {
        name: 'parent_students',
        sql: `
          CREATE TABLE IF NOT EXISTS parent_students (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            parent_id UUID,
            student_id UUID REFERENCES students(id) ON DELETE CASCADE,
            relationship TEXT DEFAULT 'parent',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(parent_id, student_id)
          );
        `,
      },
    ]

    for (const table of tables) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: table.sql })
        if (error) {
          const { error: directError } = await supabase.from(table.name).select('id').limit(1)
          if (directError) {
            results[table.name] = `Error: ${error.message}`
          } else {
            results[table.name] = 'Exists'
          }
        } else {
          results[table.name] = 'Created'
        }
      } catch (e: any) {
        results[table.name] = `Error: ${e.message}`
      }
    }

    // Migration: Add unique constraints to existing tables
    const migrations = [
      `ALTER TABLE IF EXISTS classes ADD CONSTRAINT classes_school_id_name_academic_year_key UNIQUE (school_id, name, academic_year);`,
      `ALTER TABLE IF EXISTS fee_structure ADD CONSTRAINT fee_structure_school_id_class_id_name_term_academic_year_key UNIQUE (school_id, class_id, name, term, academic_year);`
    ]

    for (const sql of migrations) {
      await supabase.rpc('exec_sql', { sql }).catch(() => {}) // Ignore if already exists
    }

    // New: Seed demo data after tables are set up
    const { seedDemoData } = await import('@/lib/seed-demo')
    const seedResult = await seedDemoData()
    if (seedResult.error) {
      results['demo_seeding'] = `Error: ${seedResult.error}`
    } else {
      results['demo_seeding'] = 'Seeded'
    }

    return apiSuccess(results, 'Setup complete')
  } catch (error) {
    return handleApiError(error)
  }
}
