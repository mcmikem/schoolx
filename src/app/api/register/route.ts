import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import {
  PRIMARY_TEMPLATE,
  SECONDARY_TEMPLATE,
} from "@/lib/curriculum-templates";
import { parseUgandaPhone } from "@/lib/auth-phone";

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

// Get default classes based on school type
function getDefaultClasses(schoolType: string, schoolId: string) {
  const currentYear = new Date().getFullYear().toString();
  const mapClasses = (template: any[], level: string) =>
    template.map((c) => ({
      school_id: schoolId,
      name: c.name,
      level: level,
      academic_year: currentYear,
    }));

  if (schoolType === "primary")
    return mapClasses(PRIMARY_TEMPLATE.classes, "primary");
  if (schoolType === "secondary")
    return mapClasses(SECONDARY_TEMPLATE.classes, "secondary");

  return [
    ...mapClasses(PRIMARY_TEMPLATE.classes, "primary"),
    ...mapClasses(SECONDARY_TEMPLATE.classes, "secondary"),
  ];
}

interface RegisterRequest {
  schoolName: string;
  district: string;
  subcounty: string;
  schoolType: "primary" | "secondary" | "combined";
  ownership: "private" | "government" | "government_aided";
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
      schoolType,
      ownership,
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

    if (schoolName.trim().length < 3) {
      return apiError("School name must be at least 3 characters", 400);
    }

    if (adminName.trim().length < 2) {
      return apiError("Admin name must be at least 2 characters", 400);
    }

    if (password.length < 6) {
      return apiError("Password must be at least 6 characters", 400);
    }

    // Validate email if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return apiError("Invalid email format", 400);
    }

    const parsedPhone = parseUgandaPhone(adminPhone);
    if (!parsedPhone) {
      return apiError(
        "Invalid phone number format. Please use Uganda format (e.g., 0700000000)",
        400,
      );
    }
    const normalizedPhone = parsedPhone.canonical;

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
      .in("phone", parsedPhone.variants)
      .single();

    if (existingUser) {
      return apiError(
        "This phone number is already registered. Please sign in or use a different number.",
        400,
      );
    }

    // 2. Generate unique school code
    let schoolCode = generateSchoolCode(schoolName, district);
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
    const emailForAuth = `${parsedPhone.canonical}@omuto.org`;
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
          "This phone number is already registered. Please sign in.",
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
        school_type: schoolType,
        ownership,
        phone: phone || null,
        email: email || null,
        subscription_plan: "free_trial",
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
      const defaultClasses = getDefaultClasses(schoolType, schoolData.id);
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
        await supabaseAdmin.from("terms").insert([
          {
            school_id: schoolData.id,
            academic_year_id: academicYear.id,
            term_number: 1,
            start_date: `${currentYear}-02-01`,
            end_date: `${currentYear}-04-30`,
            is_current: true,
          },
          {
            school_id: schoolData.id,
            academic_year_id: academicYear.id,
            term_number: 2,
            start_date: `${currentYear}-05-01`,
            end_date: `${currentYear}-07-31`,
            is_current: false,
          },
          {
            school_id: schoolData.id,
            academic_year_id: academicYear.id,
            term_number: 3,
            start_date: `${currentYear}-08-01`,
            end_date: `${currentYear}-11-30`,
            is_current: false,
          },
        ]);
      }

      console.log("[Setup] Auto-setup completed for school:", schoolData.id);
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
    return handleApiError(error);
  }
}
