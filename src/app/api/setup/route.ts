import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  apiSuccess,
  apiError,
  handleApiError,
  requireCronSecretOrDeny,
  requireDevelopmentRouteOrDeny,
} from "@/lib/api-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const devOnly = requireDevelopmentRouteOrDeny();
    if (!devOnly.ok) return devOnly.response;

    const cron = requireCronSecretOrDeny(request);
    if (!cron.ok) return cron.response;

    if (!supabaseServiceKey) {
      return apiError(
        "SUPABASE_SERVICE_ROLE_KEY not set. Add it to .env.local",
        400,
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const results: Record<string, string> = {};

    const tables = [
      {
        name: "schools",
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
            subscription_plan TEXT CHECK (subscription_plan IN ('starter', 'growth', 'enterprise', 'lifetime', 'free_trial')) DEFAULT 'free_trial',
            subscription_status TEXT CHECK (subscription_status IN ('active', 'expired', 'trial', 'past_due', 'canceled', 'unpaid', 'suspended')) DEFAULT 'trial',
            paypal_subscription_id TEXT,
            last_payment_at TIMESTAMPTZ,
            last_payment_attempt TIMESTAMPTZ,
            trial_ends_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `,
      },
      {
        name: "users",
        sql: `
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            auth_id UUID,
            school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
            full_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            role TEXT CHECK (role IN ('super_admin', 'school_admin', 'admin', 'board', 'headmaster', 'dean_of_studies', 'bursar', 'teacher', 'secretary', 'dorm_master', 'student', 'parent')) NOT NULL,
            avatar_url TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `,
      },
      {
        name: "classes",
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
        name: "subjects",
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
        name: "students",
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
        name: "attendance",
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
        name: "grades",
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
        name: "fee_structure",
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
        name: "fee_payments",
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
        name: "events",
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
        name: "messages",
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
        name: "parent_students",
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
      {
        name: "notices",
        sql: `
          CREATE TABLE IF NOT EXISTS notices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true,
            priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
            expiry_date DATE,
            created_by UUID,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `,
      },
      {
        name: "parent_messages",
        sql: `
          CREATE TABLE IF NOT EXISTS parent_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
            parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
            student_id UUID REFERENCES students(id) ON DELETE SET NULL,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            sender_role TEXT CHECK (sender_role IN ('parent', 'school')) NOT NULL,
            is_read BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `,
      },
      {
        name: "student_wallets",
        sql: `
          CREATE TABLE IF NOT EXISTS student_wallets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
            student_id UUID REFERENCES students(id) ON DELETE CASCADE UNIQUE,
            balance NUMERIC(12,2) DEFAULT 0,
            daily_spend_limit NUMERIC(12,2),
            last_topup_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
        `,
      },
      {
        name: "wallet_transactions",
        sql: `
          CREATE TABLE IF NOT EXISTS wallet_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
            wallet_id UUID REFERENCES student_wallets(id) ON DELETE CASCADE,
            amount NUMERIC(12,2) NOT NULL,
            transaction_type TEXT CHECK (transaction_type IN ('topup', 'spend', 'refund', 'adjustment')) NOT NULL,
            reference_id TEXT,
            description TEXT,
            recorded_by UUID,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `,
      },
      {
        name: "topup_rpc",
        sql: `
          CREATE OR REPLACE FUNCTION topup_student_wallet(
            p_student_id UUID,
            p_amount NUMERIC,
            p_description TEXT,
            p_ref TEXT
          ) RETURNS VOID AS $$
          DECLARE
            v_wallet_id UUID;
            v_school_id UUID;
          BEGIN
            SELECT school_id INTO v_school_id
            FROM students
            WHERE id = p_student_id;

            IF v_school_id IS NULL THEN
              RAISE EXCEPTION USING MESSAGE = 'Cannot top up wallet: student ' || p_student_id || ' does not belong to any school';
            END IF;

            -- Ensure wallet exists
            INSERT INTO student_wallets (student_id, school_id, balance, last_topup_at)
            VALUES (p_student_id, v_school_id, p_amount, NOW())
            ON CONFLICT (student_id) DO UPDATE
            SET school_id = EXCLUDED.school_id,
                balance = student_wallets.balance + p_amount,
                last_topup_at = NOW(),
                updated_at = NOW()
            RETURNING id INTO v_wallet_id;

            -- Record transaction
            INSERT INTO wallet_transactions (school_id, wallet_id, amount, transaction_type, description, reference_id)
            VALUES (v_school_id, v_wallet_id, p_amount, 'topup', p_description, p_ref);
          END;
          $$ LANGUAGE plpgsql;
        `,
      },
    ];

    for (const table of tables) {
      try {
        const { error } = await supabase.rpc("exec_sql", { sql: table.sql });
        if (error) {
          const { error: directError } = await supabase
            .from(table.name)
            .select("id")
            .limit(1);
          if (directError) {
            results[table.name] = `Error: ${error.message}`;
          } else {
            results[table.name] = "Exists";
          }
        } else {
          results[table.name] = "Created";
        }
      } catch (e: any) {
        results[table.name] = `Error: ${e.message}`;
      }
    }

    // Migration: Add unique constraints to existing tables
    const migrations = [
      `ALTER TABLE IF EXISTS classes ADD CONSTRAINT classes_school_id_name_academic_year_key UNIQUE (school_id, name, academic_year);`,
      `ALTER TABLE IF EXISTS fee_structure ADD CONSTRAINT fee_structure_school_id_class_id_name_term_academic_year_key UNIQUE (school_id, class_id, name, term, academic_year);`,
      `ALTER TABLE IF EXISTS student_wallets ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;`,
      `ALTER TABLE IF EXISTS student_wallets ADD COLUMN IF NOT EXISTS daily_spend_limit NUMERIC(12,2);`,
      `ALTER TABLE IF EXISTS student_wallets ADD COLUMN IF NOT EXISTS last_topup_at TIMESTAMPTZ;`,
      `ALTER TABLE IF EXISTS wallet_transactions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;`,
      `ALTER TABLE IF EXISTS wallet_transactions ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES student_wallets(id) ON DELETE CASCADE;`,
      `ALTER TABLE IF EXISTS wallet_transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT;`,
      `ALTER TABLE IF EXISTS wallet_transactions ADD COLUMN IF NOT EXISTS reference_id TEXT;`,
      `UPDATE student_wallets sw SET school_id = students.school_id FROM students WHERE sw.student_id = students.id AND sw.school_id IS NULL AND students.school_id IS NOT NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_parent_messages_parent_id ON parent_messages(parent_id);`,
      `CREATE INDEX IF NOT EXISTS idx_student_wallets_school_id ON student_wallets(school_id);`,
      `CREATE INDEX IF NOT EXISTS idx_wallet_transactions_school_id ON wallet_transactions(school_id);`,
      `ALTER TABLE IF EXISTS parent_messages ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE IF EXISTS student_wallets ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE IF EXISTS wallet_transactions ENABLE ROW LEVEL SECURITY;`,
      `DROP POLICY IF EXISTS parent_messages_parent_select ON parent_messages;`,
      `CREATE POLICY parent_messages_parent_select ON parent_messages FOR SELECT USING (parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));`,
      `DROP POLICY IF EXISTS parent_messages_parent_insert ON parent_messages;`,
      `CREATE POLICY parent_messages_parent_insert ON parent_messages FOR INSERT WITH CHECK (parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));`,
      `DROP POLICY IF EXISTS parent_linked_wallets_select ON student_wallets;`,
      `DROP POLICY IF EXISTS "School users manage student wallets" ON student_wallets;`,
      `CREATE POLICY "School users manage student wallets" ON student_wallets FOR ALL TO authenticated USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())) WITH CHECK (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));`,
      `CREATE POLICY parent_linked_wallets_select ON student_wallets FOR SELECT USING (student_id IN (SELECT student_id FROM parent_students WHERE parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid())));`,
      `DROP POLICY IF EXISTS parent_linked_wallets_insert ON student_wallets;`,
      `CREATE POLICY parent_linked_wallets_insert ON student_wallets FOR INSERT WITH CHECK (student_id IN (SELECT student_id FROM parent_students WHERE parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid())));`,
      `DROP POLICY IF EXISTS parent_linked_wallets_update ON student_wallets;`,
      `CREATE POLICY parent_linked_wallets_update ON student_wallets FOR UPDATE USING (student_id IN (SELECT student_id FROM parent_students WHERE parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))) WITH CHECK (student_id IN (SELECT student_id FROM parent_students WHERE parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid())));`,
      `DROP POLICY IF EXISTS parent_linked_wallet_transactions_select ON wallet_transactions;`,
      `DROP POLICY IF EXISTS "School users manage wallet transactions" ON wallet_transactions;`,
      `CREATE POLICY "School users manage wallet transactions" ON wallet_transactions FOR ALL TO authenticated USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())) WITH CHECK (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));`,
      `CREATE POLICY parent_linked_wallet_transactions_select ON wallet_transactions FOR SELECT USING (wallet_id IN (SELECT id FROM student_wallets WHERE student_id IN (SELECT student_id FROM parent_students WHERE parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))));`,
      `DROP POLICY IF EXISTS parent_linked_wallet_transactions_insert ON wallet_transactions;`,
      `CREATE POLICY parent_linked_wallet_transactions_insert ON wallet_transactions FOR INSERT WITH CHECK (wallet_id IN (SELECT id FROM student_wallets WHERE student_id IN (SELECT student_id FROM parent_students WHERE parent_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))));`,
    ];

    for (const sql of migrations) {
      await supabase.rpc("exec_sql", { sql }); // Errors are handled within the RPC or ignored visually
    }

    // Only seed demo data if explicitly enabled via environment variable
    const shouldSeedDemo = process.env.SEED_DEMO_DATA === "true";
    if (shouldSeedDemo) {
      const { seedDemoData } = await import("@/lib/seed-demo");
      const seedResult = await seedDemoData();
      if (seedResult.error) {
        results["demo_seeding"] = `Error: ${seedResult.error}`;
      } else {
        results["demo_seeding"] = "Seeded";
      }
    } else {
      results["demo_seeding"] = "Skipped (not enabled)";
    }

    return apiSuccess(results, "Setup complete");
  } catch (error) {
    return handleApiError(error);
  }
}
