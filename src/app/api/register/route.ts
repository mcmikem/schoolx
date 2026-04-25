import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  apiSuccess,
  apiError,
  handleApiError,
  rateLimit,
} from "@/lib/api-utils";
import {
  PRIMARY_TEMPLATE,
  SECONDARY_TEMPLATE,
} from "@/lib/curriculum-templates";
import { normalizePlanType } from "@/lib/payments/subscription-client";
import {
  buildUgandaAcademicTerms,
  buildUgandaCalendarEvents,
} from "@/lib/uganda-school-calendar";
import { normalizeAuthPhone } from "@/lib/validation";
import { buildDefaultClasses, type SchoolSetupType } from "@/lib/school-setup";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Get default subjects based on school type
function getDefaultSubjects(schoolType: string) {
  if (schoolType === "primary") return PRIMARY_TEMPLATE.subjects;
  if (schoolType === "secondary") return SECONDARY_TEMPLATE.subjects;

  // Combined - merge both, avoiding duplicates by code
  const combined = [...PRIMARY_TEMPLATE.subjects];
  SECONDARY_TEMPLATE.subjects.forEach((s) => {
    if (!combined.find((c) => c.code === s.code && c.level === s.level)) {
      combined.push(s);
    }
  });
  return combined;
}

interface RegisterRequest {
  schoolName: string;
  district: string;
  subcounty: string;
  parish?: string;
  village?: string;
  schoolType: "primary" | "secondary" | "combined";
  ownership: "private" | "government" | "government_aided";
  selectedPackage?: string;
  phone?: string;
  email?: string;
  adminName: string;
  adminPhone: string;
  password: string;
}

// Generate a unique school code based on school name and district
function generateSchoolCode(schoolName: string, district: string): string {
  // Get first 2 letters of each word in school name (max 4 letters)
  const nameWords = schoolName
    .toUpperCase()
    .replace(/[^A-Z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  let nameCode = "";
  for (const word of nameWords.slice(0, 3)) {
    nameCode += word.substring(0, 2);
    if (nameCode.length >= 4) break;
  }
  nameCode = nameCode.substring(0, 4) || "SCHL";

  // Get first 2 letters of district
  const districtCode =
    district
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .substring(0, 2) || "UG";

  // Generate random 3-digit number
  const randomNum = Math.floor(100 + Math.random() * 900);

  return `${nameCode}${districtCode}${randomNum}`;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 registrations per IP per 10 minutes
    const { success } = rateLimit(request, 5, 600_000);
    if (!success) {
      return apiError(
        "Too many registration attempts. Please try again later.",
        429,
      );
    }

    if (!supabaseServiceKey) {
      return apiError(
        "Server configuration error: SUPABASE_SERVICE_ROLE_KEY not set",
        500,
      );
    }

    const body: RegisterRequest = await request.json();
    const {
      schoolName,
      district,
      subcounty,
      parish,
      village,
      schoolType,
      ownership,
      selectedPackage,
      phone,
      email,
      adminName,
      adminPhone,
      password,
    } = body;

    // Validate required fields
    if (
      !schoolName?.trim() ||
      !district?.trim() ||
      !subcounty?.trim() ||
      !adminName?.trim() ||
      !adminPhone?.trim() ||
      !password
    ) {
      return apiError("All required fields must be filled", 400);
    }

    const subscriptionPlan = normalizePlanType(selectedPackage || "basic");

    if (schoolName.trim().length < 3) {
      return apiError("School name must be at least 3 characters", 400);
    }

    if (adminName.trim().length < 2) {
      return apiError("Admin name must be at least 2 characters", 400);
    }

    if (password.length < 8) {
      return apiError(
        "Password must be at least 8 characters with one uppercase letter and one number",
        400,
      );
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return apiError(
        "Password must contain at least one uppercase letter and one number",
        400,
      );
    }

    // Validate email if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return apiError("Invalid email format", 400);
    }

    // Normalize phone number (remove spaces, dashes, keep only digits)
    const normalizedPhone = normalizeAuthPhone(adminPhone);

    if (normalizedPhone.length < 10 || normalizedPhone.length > 12) {
      return apiError(
        "Invalid phone number format. Please use Uganda format (e.g., 0700000000)",
        400,
      );
    }

    // Create admin client (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Check if phone number already exists
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("phone", normalizedPhone)
      .single();

    if (existingUser) {
      return apiError(
        "Registration could not be completed. If you already have an account, please sign in.",
        400,
      );
    }

    // 2. Generate unique school code
    // Generate unique school code with timestamp component to avoid race conditions
    let schoolCode = generateSchoolCode(schoolName, district);
    schoolCode = schoolCode + Date.now().toString(36).slice(-2).toUpperCase();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const { data: existingSchool } = await supabaseAdmin
        .from("schools")
        .select("id")
        .eq("school_code", schoolCode)
        .single();

      if (!existingSchool) break;

      // Generate new code if collision
      schoolCode = generateSchoolCode(schoolName, district);
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return apiError(
        "Unable to generate unique school code. Please try again.",
        400,
      );
    }

    // 3. Create auth user using admin client
    const emailForAuth = `${normalizedPhone}@omuto.org`;
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: emailForAuth,
        password: password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: adminName,
          phone: normalizedPhone,
          role: "school_admin",
        },
      });

    if (authError) {
      // Check if it's a duplicate email error
      if (
        authError.message.includes("already registered") ||
        authError.message.includes("duplicate")
      ) {
        return apiError(
          "Registration could not be completed. If you already have an account, please sign in.",
          400,
        );
      }
      throw authError;
    }

    // 4. Create school record
    const { data: schoolData, error: schoolError } = await supabaseAdmin
      .from("schools")
      .insert({
        name: schoolName,
        school_code: schoolCode,
        district,
        subcounty,
        parish: parish || null,
        village: village || null,
        school_type: schoolType,
        ownership,
        phone: phone || null,
        email: email || null,
        subscription_plan: subscriptionPlan,
        subscription_status: "trial",
        trial_ends_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        primary_color: "#1e3a5f",
      })
      .select()
      .single();

    if (schoolError) {
      // Cleanup: delete auth user if school creation fails
      if (authData?.user) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      }
      throw schoolError;
    }

    // 5. Create user record
    const { error: userError } = await supabaseAdmin.from("users").insert({
      auth_id: authData.user.id,
      school_id: schoolData.id,
      full_name: adminName,
      phone: normalizedPhone,
      email: email || null,
      role: "school_admin",
      is_active: true,
    });

    if (userError) {
      // Cleanup: delete auth user and school if user creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.from("schools").delete().eq("id", schoolData.id);
      throw userError;
    }

    // 6. Auto-seed essential curriculum data
    // Run setup and await it so the serverless function doesn't terminate and kill the process.
    try {
      const currentYear = new Date().getFullYear().toString();

      // Create subjects
      const defaultSubjects = getDefaultSubjects(schoolType);
      if (defaultSubjects.length > 0) {
        const subjectRecords = defaultSubjects.map((s) => ({
          school_id: schoolData.id,
          name: s.name,
          code: s.code,
          level: s.level,
          is_compulsory: s.is_compulsory,
        }));
        await supabaseAdmin.from("subjects").insert(subjectRecords);
      }

      // Create classes
      const defaultClasses = buildDefaultClasses(
        schoolData.id,
        schoolType as SchoolSetupType,
        currentYear,
      );
      if (defaultClasses.length > 0) {
        await supabaseAdmin.from("classes").insert(defaultClasses);
      }

      // Create academic year
      const { data: academicYear } = await supabaseAdmin
        .from("academic_years")
        .insert({
          school_id: schoolData.id,
          year: `${currentYear}`,
          is_current: true,
        })
        .select()
        .single();

      // Create terms
      if (academicYear) {
        const defaultAcademicTerms = buildUgandaAcademicTerms(
          schoolData.id,
          currentYear,
        );
        const defaultTermRows = defaultAcademicTerms.map((term) => ({
          school_id: schoolData.id,
          academic_year_id: academicYear.id,
          term_number: term.term_number,
          start_date: term.start_date,
          end_date: term.end_date,
          is_current: term.is_current,
        }));

        await supabaseAdmin.from("terms").insert(defaultTermRows);

        await supabaseAdmin
          .from("academic_terms")
          .upsert(defaultAcademicTerms, {
            onConflict: "school_id,academic_year,term_number",
          });
      }

      await supabaseAdmin
        .from("events")
        .insert(buildUgandaCalendarEvents(schoolData.id, currentYear));

      // Setup complete
      if (process.env.NODE_ENV !== "production") {
        console.log("[Setup] Auto-setup completed for new school");
      }
    } catch (setupError) {
      console.error("[Setup] Auto-setup failed:", setupError);
    }

    // Return success
    return apiSuccess(
      {
        schoolId: schoolData.id,
        userId: authData.user.id,
        schoolCode,
      },
      "Registration successful",
    );
  } catch (error) {
    console.error("[Register Error]", error);
    // Provide more specific error messages for common database issues
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("duplicate") ||
        msg.includes("unique") ||
        msg.includes("already exists")
      ) {
        return apiError(
          "Registration could not be completed. If you already have an account, please sign in.",
          400,
        );
      }
      if (msg.includes("relation") || msg.includes("does not exist")) {
        return apiError(
          "Database setup incomplete. Please contact support.",
          500,
        );
      }
      if (
        msg.includes("permission") ||
        msg.includes("rls") ||
        msg.includes("policy")
      ) {
        return apiError(
          "Server configuration error. Please contact support.",
          500,
        );
      }
    }
    return handleApiError(error);
  }
}
