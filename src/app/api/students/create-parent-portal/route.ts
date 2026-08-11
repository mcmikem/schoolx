import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeAuthPhone } from "@/lib/validation";
import { buildAuthEmailFromPhone } from "@/lib/auth-login";
import { logger } from "@/lib/logger";
import { sendParentPortalCredentials, isWhatsAppConfigured } from "@/lib/whatsapp";
import { requireUserWithSchool, assertSchoolScopeOrDeny, apiError } from "@/lib/api-utils";
import { randomBytes } from "crypto";

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey: string | undefined = process.env.SUPABASE_SERVICE_ROLE_KEY;

function generateTemporaryPassword(): string {
  const randomPart = randomBytes(10).toString("base64url");
  return `Sm!${randomPart}A9`;
}

export async function POST(request: NextRequest) {
  // Require authenticated school user
  const auth = await requireUserWithSchool(request);
  if (!auth.ok) return auth.response;

  if (!supabaseServiceKey) {
    return apiError(
      "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing. Add it to your .env.local file (get it from Supabase Dashboard → Settings → API → service_role key).",
      500,
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey!, {
    auth: { persistSession: false },
  });

  let studentId: string | undefined;
  let schoolId: string | undefined;
  let phone: string | undefined;
  let fullName: string | undefined;
  let relationship: string | undefined;
  let sendCredentials: boolean | undefined;

  try {
    const body = await request.json();
    studentId = body.studentId;
    schoolId = body.schoolId;
    phone = body.phone;
    fullName = body.fullName;
    relationship = body.relationship;
    sendCredentials = body.sendCredentials;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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
    .maybeSingle();

  if (studentError || !student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const rawPhone = phone || student.parent_phone;
  const parentPhone = rawPhone?.replace(/[^0-9]/g, "");
  if (!parentPhone || parentPhone.length < 9) {
    return NextResponse.json({ error: "Student has no valid parent phone number" }, { status: 400 });
  }

  // Check if parent account already exists for this school
  const phoneNormalized = normalizeAuthPhone(parentPhone);
  const { data: existingUser } = await supabaseAdmin
    .from("users")
    .select("id, role, auth_id")
    .eq("phone", phoneNormalized)
    .eq("school_id", schoolId)
    .maybeSingle();

  const parentName = fullName?.trim() || student.parent_name?.trim() || `Parent of ${student.first_name}`;
  const generatedPassword = generateTemporaryPassword();
  const authEmail = buildAuthEmailFromPhone(phoneNormalized);
  const e164Phone = phoneNormalized.startsWith("+") ? phoneNormalized : `+${phoneNormalized}`;

  // Fetch school name for WhatsApp message
  let schoolName = "SkoolMate";
  const { data: school } = await supabaseAdmin.from("schools").select("name").eq("id", schoolId).maybeSingle();
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

    const linkRelation = relationship || "parent";
    if (!existingLink) {
      const { error: linkError } = await supabaseAdmin.from("parent_students").insert({
        parent_id: existingUser.id,
        student_id: student.id,
        relationship: linkRelation,
      });
      if (linkError) {
        logger.error("[create-parent-portal] parent_students link failed:", linkError);
        return NextResponse.json({ error: "Failed to create student-parent link" }, { status: 500 });
      }
    }

    if (existingUser.auth_id) {
      const { error: rotatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.auth_id, {
        password: generatedPassword,
        user_metadata: {
          full_name: parentName,
          phone: phoneNormalized,
          role: "parent",
          must_change_password: true,
        },
      });

      if (rotatePasswordError) {
        logger.error("[create-parent-portal] Failed to rotate password for existing parent:", rotatePasswordError);
        return NextResponse.json({ error: "Failed to refresh parent credentials" }, { status: 500 });
      }
    }

    const shouldDeliver = sendCredentials !== false;
    let credentialsDelivered = false;
    if (shouldDeliver) {
      try {
        const waResult = await sendParentPortalCredentials(whatsappOpts);
        credentialsDelivered = Boolean(waResult.success && !waResult.demo);
      } catch {
        credentialsDelivered = false;
      }
    }

    return NextResponse.json({
      created: false,
      message: "Parent account already exists. Credentials refreshed and linked.",
      parentName,
      parentPhone: phoneNormalized,
      authEmail,
      credentialsDelivered,
      credentialsExposed: !shouldDeliver || !credentialsDelivered ? true : false,
      ...(shouldDeliver && credentialsDelivered ? {} : { generatedPassword }),
    });
  }

  // Some deployments have phone auth disabled; attempt with phone first, then retry with email-only.
  let { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: authEmail,
    phone: e164Phone,
    password: generatedPassword,
    email_confirm: true,
    user_metadata: {
      full_name: parentName,
      phone: phoneNormalized,
      role: "parent",
      must_change_password: true,
    },
  });

  if (authError) {
    logger.warn("[create-parent-portal] Auth create with phone failed, retrying email-only:", authError);
    ({ data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        full_name: parentName,
        phone: phoneNormalized,
        role: "parent",
        must_change_password: true,
      },
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

  const linkRelation = relationship || "parent";
  const { error: linkError } = await supabaseAdmin.from("parent_students").insert({
    parent_id: parentUserId,
    student_id: student.id,
    relationship: linkRelation,
  });

  if (linkError) {
    logger.warn("[create-parent-portal] parent_students link failed:", linkError);
    return NextResponse.json({ created: false, error: "Failed to create student-parent link" });
  }

  // Fetch linked children to return to frontend
  const { data: linkedChildren } = await supabaseAdmin
    .from("parent_students")
    .select("student:students(*, class:classes(name))")
    .eq("parent_id", parentUserId);

  const shouldDeliver = sendCredentials !== false;
  let credentialsDelivered = false;
  let whatsappSent = false;
  if (shouldDeliver) {
    try {
      if (isWhatsAppConfigured()) {
        const waResult = await sendParentPortalCredentials(whatsappOpts);
        credentialsDelivered = Boolean(waResult.success && !waResult.demo);
        whatsappSent = credentialsDelivered;
        if (waResult.success && !waResult.demo) {
          logger.info(`[create-parent-portal] WhatsApp credentials sent to ${phoneNormalized}`);
        }
      } else {
        const { generateWhatsAppShareLink } = await import("@/lib/whatsapp");
        const link = generateWhatsAppShareLink(
          phoneNormalized,
          `Hello ${parentName}! Your SkoolMate parent portal is ready.\n\nLogin: ${phoneNormalized}\nPassword: ${generatedPassword}\nLink: ${portalUrl}\n\n- ${schoolName}`,
        );
        logger.info(`[create-parent-portal] WhatsApp not configured — manual share link ready for ${phoneNormalized}`);
        void link;
      }
    } catch (e) {
      logger.warn("[create-parent-portal] WhatsApp send failed (non-blocking):", e);
    }
  }

  return NextResponse.json({
    created: true,
    message: `Parent portal created for ${parentName}`,
    parentName,
    parentPhone: phoneNormalized,
    credentialsDelivered,
    credentialsExposed: !shouldDeliver || !credentialsDelivered ? true : false,
    whatsappSent,
    ...(shouldDeliver && credentialsDelivered ? {} : { generatedPassword }),
    linkedChildren: linkedChildren || [],
  });
}
