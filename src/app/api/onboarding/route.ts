import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { rateLimit } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/validation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface OnboardingAction {
  action: "saveTerms" | "saveFees" | "saveGrading" | "saveReportBranding" | "saveOnboardingComplete";
  data: Record<string, unknown>;
  schoolId: string;
}

async function getSupabaseAdmin(request: NextRequest) {
  return createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { success: rlOk } = rateLimit(request, 30, 60000);
    if (!rlOk) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const supabaseAdmin = await getSupabaseAdmin(request);

    const {
      data: { user: authUser },
    } = await supabaseAdmin.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: OnboardingAction = await request.json();
    const { action, data, schoolId } = body;

    if (!schoolId) {
      return NextResponse.json({ error: "School ID required" }, { status: 400 });
    }

    const { data: userProfile } = await supabaseAdmin
      .from("users")
      .select("school_id, role")
      .eq("auth_id", authUser.id)
      .single();

    if (!userProfile || userProfile.school_id !== schoolId) {
      return NextResponse.json({ error: "Access denied to this school" }, { status: 403 });
    }

    switch (action) {
      case "saveTerms": {
        const terms = data.terms as Array<{
          name: string;
          code: string;
          term_number: number;
          start: string;
          end: string;
        }>;
        const termRows = terms
          .filter((term) => term.start && term.end)
          .map((term) => ({
            school_id: schoolId,
            name: term.name,
            code: term.code || `T${term.term_number}-${new Date().getFullYear()}`,
            term_number: term.term_number || 0,
            start_date: term.start,
            end_date: term.end,
            academic_year: new Date().getFullYear().toString(),
            is_current: false,
          }));

        if (termRows.length > 0) {
          const { error } = await supabaseAdmin
            .from("academic_terms")
            .upsert(termRows, {
              onConflict: "school_id,term_number,academic_year",
            });
          if (error) throw error;
        }
        return NextResponse.json({ success: true });
      }

      case "saveFees": {
        const fees = data.fees as Array<{
          name: string;
          amount: string;
          category: string;
        }>;
        const year = new Date().getFullYear().toString();
        const feeRows = fees
          .filter((fee) => fee.name && parseFloat(fee.amount) > 0)
          .map((fee) => ({
            school_id: schoolId,
            name: fee.name,
            amount: parseFloat(fee.amount),
            category: fee.category,
            class_id: null,
            term: 1,
            academic_year: year,
          }));

        if (feeRows.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from("fee_structure")
            .insert(feeRows);
          if (insertError) throw insertError;
        }
        return NextResponse.json({ success: true });
      }

      case "saveGrading": {
        const passingMark = data.passingMark as number;
        const grades = data.grades as Array<{ label: string; min: number; max: number }>;

        const { error: pmError } = await supabaseAdmin
          .from("school_settings")
          .upsert(
            { school_id: schoolId, key: "passing_mark", value: String(passingMark) },
            { onConflict: "school_id,key" },
          );
        if (pmError) throw pmError;

        const { error: gradesError } = await supabaseAdmin
          .from("school_settings")
          .upsert(
            { school_id: schoolId, key: "grade_labels", value: JSON.stringify(grades) },
            { onConflict: "school_id,key" },
          );
        if (gradesError) throw gradesError;

        return NextResponse.json({ success: true });
      }

      case "saveReportBranding": {
        const { header, footer, receiptFooter, showPosition, showConduct, showAttendance, showRemarks } = data;

        const { error } = await supabaseAdmin
          .from("schools")
          .update({
            report_header_text: header || null,
            report_footer_text: footer || null,
            receipt_footer_text: receiptFooter || null,
            show_position_in_report: showPosition,
            show_conduct_in_report: showConduct,
            show_attendance_in_report: showAttendance,
            show_remarks_in_report: showRemarks,
          })
          .eq("id", schoolId);
        if (error) throw error;

        return NextResponse.json({ success: true });
      }

      case "saveOnboardingComplete": {
        const { schoolType, name, district, subcounty, parish, village, primaryColor, accentColor, logoUrl, motto, phone, email, unebCenterNumber, ownership, featureStage, selectedSubjects, completedSteps } = data;

        const completionTimestamp = new Date().toISOString();
        const { error: updateError } = await supabaseAdmin
          .from("schools")
          .update({
            school_type: schoolType || "primary",
            name: name || undefined,
            district: district || undefined,
            subcounty: subcounty || undefined,
            parish: parish || null,
            village: village || null,
            primary_color: primaryColor || undefined,
            accent_color: accentColor || null,
            logo_url: logoUrl || null,
            motto: motto || null,
            phone: phone || null,
            email: email || null,
            uneb_center_number: unebCenterNumber || null,
            ownership: ownership || undefined,
            feature_stage: featureStage || "core",
            onboarding_completed: true,
            onboarding_completed_at: completionTimestamp,
            setup_progress: JSON.stringify({
              completed: ["branding", "features", "activation"],
              skipped: [],
            }),
          })
          .eq("id", schoolId);

        if (updateError) {
          throw updateError;
        }

        const checklistItems = [
          { item_key: "academic_calendar", item_label: "Academic Calendar" },
          { item_key: "class_structure", item_label: "Class & Stream Setup" },
          { item_key: "fee_structure", item_label: "Fee Structure" },
          { item_key: "staff_accounts", item_label: "Staff Accounts" },
          { item_key: "student_import", item_label: "Import Students" },
          { item_key: "sms_templates", item_label: "SMS Templates" },
          { item_key: "payment_methods", item_label: "Payment Methods" },
          { item_key: "grading_config", item_label: "Grading System" },
        ];

        const { error: checklistError } = await supabaseAdmin
          .from("setup_checklist")
          .upsert(
            checklistItems.map((item) => ({ ...item, school_id: schoolId })),
            { onConflict: "school_id,item_key" },
          );

        if (checklistError) {
          logger.warn("Checklist upsert failed:", checklistError);
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    logger.error("[Onboarding API] Error:", getErrorMessage(error));
    return NextResponse.json(
      { error: getErrorMessage(error, "Operation failed") },
      { status: 500 },
    );
  }
}