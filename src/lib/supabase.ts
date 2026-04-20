import { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const allowMockClient =
  process.env.NODE_ENV === "test" ||
  process.env.ALLOW_SUPABASE_MOCK === "true";
const isValidHttpUrl = (value?: string | null) => {
  if (!value || value.includes("your-supabase-url")) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const isValidAnonKey = (key?: string) => {
  if (!key) return false;
  const sbPublishable = key.startsWith("sb_publishable_") && key.length > 20;
  const eyJ = key.startsWith("eyJ") && key.length > 50;
  return sbPublishable || eyJ;
};

const hasUsableSupabaseConfig =
  isValidHttpUrl(supabaseUrl) && isValidAnonKey(supabaseAnonKey);

const createMockQueryBuilder = () => {
  const listResult = { data: [], error: null, count: 0 };
  const itemResult = { data: null, error: null, count: 0 };

  const builder: Record<string, any> = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,
    eq: () => builder,
    neq: () => builder,
    gt: () => builder,
    gte: () => builder,
    lt: () => builder,
    lte: () => builder,
    like: () => builder,
    ilike: () => builder,
    in: () => builder,
    contains: () => builder,
    overlaps: () => builder,
    is: () => builder,
    or: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    match: () => builder,
    abortSignal: () => builder,
    then: (resolve: (value: typeof listResult) => unknown) =>
      Promise.resolve(resolve(listResult)),
    catch: () => Promise.resolve(listResult),
    finally: () => Promise.resolve(listResult),
    single: async () => itemResult,
    maybeSingle: async () => itemResult,
  };

  return builder;
};

const createMockClient = (): SupabaseClient => {
  const mock = {
    from: () => createMockQueryBuilder(),
    auth: {
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: null,
      }),
      signUp: async () => ({
        data: { user: null, session: null },
        error: null,
      }),
      signOut: async () => ({ error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
        createBucket: async () => ({ data: null, error: null }),
      }),
    },
  };
  return mock as unknown as SupabaseClient;
};

const createUnavailableClient = (): SupabaseClient => {
  const error = () =>
    new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or explicitly enable ALLOW_SUPABASE_MOCK for non-production demo use.",
    );

  const throwUnavailable = async () => {
    throw error();
  };

  const throwSyncUnavailable = () => {
    throw error();
  };

  const unavailableBuilder: Record<string, any> = {
    select: throwSyncUnavailable,
    insert: throwSyncUnavailable,
    update: throwSyncUnavailable,
    upsert: throwSyncUnavailable,
    delete: throwSyncUnavailable,
    eq: throwSyncUnavailable,
    neq: throwSyncUnavailable,
    gt: throwSyncUnavailable,
    gte: throwSyncUnavailable,
    lt: throwSyncUnavailable,
    lte: throwSyncUnavailable,
    like: throwSyncUnavailable,
    ilike: throwSyncUnavailable,
    in: throwSyncUnavailable,
    contains: throwSyncUnavailable,
    overlaps: throwSyncUnavailable,
    is: throwSyncUnavailable,
    or: throwSyncUnavailable,
    order: throwSyncUnavailable,
    limit: throwSyncUnavailable,
    range: throwSyncUnavailable,
    match: throwSyncUnavailable,
    abortSignal: throwSyncUnavailable,
    then: throwUnavailable,
    catch: throwUnavailable,
    finally: throwUnavailable,
    single: throwUnavailable,
    maybeSingle: throwUnavailable,
  };

  return {
    from: () => unavailableBuilder,
    auth: {
      signInWithPassword: throwUnavailable,
      signUp: throwUnavailable,
      signOut: throwUnavailable,
      getSession: throwUnavailable,
      getUser: throwUnavailable,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    storage: {
      from: () => ({
        upload: throwUnavailable,
        getPublicUrl: throwSyncUnavailable,
        createBucket: throwUnavailable,
      }),
    },
  } as unknown as SupabaseClient;
};

// Export a flag so application boundaries can show a setup screen instead of crashing
export const isSupabaseConfigured = hasUsableSupabaseConfig;

if (!hasUsableSupabaseConfig && process.env.NODE_ENV === "production") {
  // Log a clear error but do NOT throw at module evaluation time.
  // Throwing here causes the entire Next.js app to crash with a 500 error
  // rather than rendering a user-friendly configuration page.
  console.error(
    "[Supabase] CRITICAL: Supabase configuration missing/invalid. " +
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

const realClient = hasUsableSupabaseConfig
  ? createBrowserClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

// Debug output
export const supabase =
  realClient ||
  (allowMockClient ? createMockClient() : createUnavailableClient());

export type Database = {
  public: {
    Tables: {
      schools: {
        Row: {
          id: string;
          name: string;
          school_code: string;
          district: string;
          subcounty: string;
          parish: string;
          village: string;
          school_type: "primary" | "secondary" | "combined";
          ownership: "private" | "government" | "government_aided";
          phone: string | null;
          email: string | null;
          logo_url: string | null;
          primary_color: string;
          uneab_center_number: string | null;
          subscription_plan:
            | "starter"
            | "growth"
            | "enterprise"
            | "lifetime"
            | "free_trial";
          subscription_status:
            | "active"
            | "expired"
            | "trial"
            | "past_due"
            | "canceled"
            | "unpaid"
            | "suspended";
          trial_ends_at: string | null;
          paypal_subscription_id: string | null;
          last_payment_at: string | null;
          last_payment_attempt: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["schools"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["schools"]["Row"]>;
      };
      users: {
        Row: {
          id: string;
          auth_id: string;
          school_id: string | null;
          full_name: string;
          phone: string;
          email: string | null;
          role:
            | "super_admin"
            | "school_admin"
            | "admin"
            | "board"
            | "headmaster"
            | "dean_of_studies"
            | "bursar"
            | "teacher"
            | "secretary"
            | "dorm_master"
            | "student"
            | "parent";
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["users"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>;
      };
      students: {
        Row: {
          id: string;
          school_id: string;
          user_id: string | null;
          student_number: string;
          first_name: string;
          last_name: string;
          gender: "M" | "F";
          date_of_birth: string;
          parent_name: string;
          parent_phone: string;
          parent_phone2: string | null;
          address: string | null;
          class_id: string;
          admission_date: string;
          ple_index_number: string | null;
          status: "active" | "transferred" | "dropped" | "completed";
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["students"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["students"]["Row"]>;
      };
      classes: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          level: string;
          stream: string | null;
          class_teacher_id: string | null;
          max_students: number;
          academic_year: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["classes"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["classes"]["Row"]>;
      };
      subjects: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          code: string;
          level: "primary" | "secondary";
          is_compulsory: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["subjects"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["subjects"]["Row"]>;
      };
      attendance: {
        Row: {
          id: string;
          student_id: string;
          class_id: string;
          date: string;
          status: "present" | "absent" | "late" | "excused";
          remarks: string | null;
          recorded_by: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["attendance"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["attendance"]["Row"]>;
      };
      grades: {
        Row: {
          id: string;
          student_id: string;
          subject_id: string;
          class_id: string;
          assessment_type:
            | "ca1"
            | "ca2"
            | "ca3"
            | "ca4"
            | "project"
            | "aoi"
            | "exam";
          score: number;
          max_score: number;
          term: number;
          academic_year: string;
          recorded_by: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["grades"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["grades"]["Row"]>;
      };
      fees: {
        Row: {
          id: string;
          school_id: string;
          class_id: string | null;
          name: string;
          amount: number;
          term: number;
          academic_year: string;
          due_date: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["fees"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["fees"]["Row"]>;
      };
      fee_payments: {
        Row: {
          id: string;
          student_id: string;
          fee_id: string;
          amount_paid: number;
          payment_method: "cash" | "mobile_money" | "bank" | "installment";
          payment_reference: string | null;
          paid_by: string;
          notes: string | null;
          payment_date: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["fee_payments"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["fee_payments"]["Row"]>;
      };
      fee_structure: {
        Row: {
          id: string;
          school_id: string;
          class_id: string | null;
          name: string;
          amount: number;
          term: number;
          academic_year: string;
          due_date: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["fee_structure"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<Database["public"]["Tables"]["fee_structure"]["Row"]>;
      };
    };
  };
};
