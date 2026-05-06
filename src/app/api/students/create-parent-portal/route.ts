import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeAuthPhone } from "@/lib/validation";
import { buildAuthEmailFromPhone } from "@/lib/auth-login";
import { logger } from "@/lib/logger";
import { sendParentPortalCredentials, isWhatsAppConfigured } from "@/lib/whatsapp";
import { requireUserWithSchool, assertSchoolScopeOrDeny } from "@/lib/api-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(request: NextRequest) {
  // Require authenticated school user
  const auth = await requireUserWithSchool(request);
  if (!auth.ok) return auth.response;

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const body = await request.json();
  const { studentId, schoolId } = body as { studentId?: string; schoolId?: string };
  if (!studentId || !schoolId) {
    return NextResponse.json({ error: "studentId and schoolId required" }, { status: 400 });
  }

  // Ensure caller belongs to the school they are acting on
  const scope = assertSchoolScopeOrDeny({
    userSchoolId: auth.context.schoolId,
    requestedSchoolId: schoolId,
  });
  if (!scope.ok) return scope.response;

  // Fetch student record
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, first_name, last_name, parent_name, parent_phone")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .single();

  if (studentError || !student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const parentPhone = student.parent_phone?.replace(/[^0-9]/g, "");
  if (!parentPhone || parentPhone.length < 9) {
    return NextResponse.json({ error: "Student has no valid parent phone number" }, { status: 400 });
  }

  // Check if parent account already exists for this school
  const phoneNormalized = normalizeAuthPhone(parentPhone);
  const { data: existingUser } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("phone", phoneNormalized)
    .eq("school_id", schoolId)
    .maybeSingle();

  const parentName = student.parent_name?.trim() || `Parent of ${student.first_name}`;
  const generatedPassword = `parent${parentPhone.slice(-4)}`;
  const authEmail = buildAuthEmailFromPhone(phoneNormalized);
  const e164Phone = phoneNormalized.startsWith("+")
    ? phoneNormalized
    : `+${phoneNormalized}`;

  // Fetch school name for WhatsApp message
  let schoolName = "SkoolMate";
  const { data: school } = await supabaseAdmin
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();
  if (school?.name) schoolName = school.name;

  const portalUrl = `${request.nextUrl.origin}/parent-portal`;
  const whatsappOpts = {
    parentName,
    parentPhone: phoneNormalized,
    studentName: `${student.first_name} ${student.last_name}`,
    password: generatedPassword,
    portalUrl,
    schoolName,
  };

  if (existingUser) {
    // Parent exists — ensure link to this student
    const { data: existingLink } = await supabaseAdmin
      .from("parent_students")
      .select("id")
      .eq("parent_id", existingUser.id)
      .eq("student_id", student.id)
      .maybeSingle();

    if (!existingLink) {
      await supabaseAdmin.from("parent_students").insert({
        parent_id: existingUser.id,
        student_id: student.id,
        relationship: "parent",
      });
    }

    // Generate WhatsApp share link for existing parent credentials
    let whatsappLink: string | undefined;
    try {
      const { generateWhatsAppShareLink } = await import("@/lib/whatsapp");
      whatsappLink = generateWhatsAppShareLink(phoneNormalized, `Hello ${parentName}! Your SkoolMate parent portal credentials.\n\nLogin: ${phoneNormalized}\nPassword: ${generatedPassword}\nLink: ${portalUrl}\n\n- ${schoolName}`);
    } catch {
      whatsappLink = undefined;
    }

    return NextResponse.json({
      created: false,
      message: "Parent account already exists and is linked",
      parentName,
      parentPhone: phoneNormalized,
      generatedPassword,
      authEmail,
      whatsappLink,
    });
  }

  // Some deployments have phone auth disabled; attempt with phone first, then retry with email-only.
  let { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: authEmail,
    phone: e164Phone,
    password: generatedPassword,
    email_confirm: true,
    user_metadata: { full_name: parentName, phone: phoneNormalized, role: "parent" },
  });

  if (authError) {
    logger.warn("[create-parent-portal] Auth create with phone failed, retrying email-only:", authError);
    ({ data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: { full_name: parentName, phone: phoneNormalized, role: "parent" },
    }));
  }

  if (authError) {
    logger.error("[create-parent-portal] Auth creation failed:", authError);
    return NextResponse.json({ error: "Failed to create auth account" }, { status: 500 });
  }

  if (!authData.user) {
    return NextResponse.json({ error: "Auth user not returned" }, { status: 500 });
  }

  // Insert into users table and capture primary key for parent_students linkage.
  const { data: insertedUser, error: userError } = await supabaseAdmin
    .from("users")
    .insert({
      auth_id: authData.user.id,
      school_id: schoolId,
      full_name: parentName,
      phone: phoneNormalized,
      email: authEmail,
      role: "parent",
      is_active: true,
    })
    .select("id")
    .single();

  if (userError) {
    logger.error("[create-parent-portal] Users insert failed:", userError);
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 });
  }

  // Link parent to student
  const parentUserId = insertedUser?.id;
  if (!parentUserId) {
    logger.error("[create-parent-portal] Inserted user id missing after users insert");
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: "Failed to create parent profile" }, { status: 500 });
  }

  const { error: linkError } = await supabaseAdmin.from("parent_students").insert({
    parent_id: parentUserId,
    student_id: student.id,
    relationship: "parent",
  });

  if (linkError) {
    logger.warn("[create-parent-portal] parent_students link failed:", linkError);
  }

  // Auto-send via WhatsApp if configured
  let whatsappLink: string | undefined;
  let whatsappSent = false;
  try {
    if (isWhatsAppConfigured()) {
      const waResult = await sendParentPortalCredentials(whatsappOpts);
      whatsappLink = waResult.shareLink;
      whatsappSent = waResult.success && !waResult.demo;
      if (waResult.success && !waResult.demo) {
        logger.info(`[create-parent-portal] WhatsApp credentials sent to ${phoneNormalized}`);
      }
    } else {
      const { generateWhatsAppShareLink } = await import("@/lib/whatsapp");
      whatsappLink = generateWhatsAppShareLink(phoneNormalized, `Hello ${parentName}! Your SkoolMate parent portal is ready.\n\nLogin: ${phoneNormalized}\nPassword: ${generatedPassword}\nLink: ${portalUrl}\n\n- ${schoolName}`);
    }
  } catch (e) {
    logger.warn("[create-parent-portal] WhatsApp send failed (non-blocking):", e);
  }

  return NextResponse.json({
    created: true,
    message: `Parent portal created for ${parentName}`,
    parentName,
    parentPhone: phoneNormalized,
    generatedPassword,
    whatsappLink,
    whatsappSent,
  });
}
