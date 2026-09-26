import { NextRequest, NextResponse } from "next/server";
import {
  apiError,
  apiSuccess,
  createServiceRoleClientOrThrow,
  handleApiError,
  requireUserWithSchool,
  assertUserRoleOrDeny,
  withSecurity,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";

const REVIEW_ROLES = ["super_admin", "school_admin", "admin", "headmaster", "bursar"];
const CLAIM_METHODS = new Set(["mobile_money", "cash", "bank", "in_kind"]);

type Action = "submit" | "list" | "review";

/**
 * Postgres raises 42P01 (undefined_table) / 42703 (undefined_column) when
 * fee_payment_claims has not been applied yet. Parents must never see a raw
 * 500 for this — they would have no way to tell the school they paid. Return
 * an actionable message and let them fall back to paying at the office.
 */
const MISSING_SCHEMA_CODES = new Set(["42P01", "42703", "PGRST204"]);

function isMissingSchema(error: { code?: string } | null | undefined): boolean {
  return !!error && MISSING_SCHEMA_CODES.has(error.code ?? "");
}

const SCHEMA_MISSING_RESPONSE = () =>
  apiError(
    "Online payment reporting is not switched on yet. Please pay at the school office, or use the number they gave you.",
    503,
  );

async function handlePost(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = (body.action as Action) || "submit";
    const schoolId = auth.context.schoolId;

    if (action === "submit") {
      const studentId = typeof body.studentId === "string" ? body.studentId : "";
      const amount = Number(body.amount);

      if (!studentId) return apiError("studentId is required", 400);
      if (!Number.isFinite(amount) || amount <= 0) return apiError("A valid amount is required", 400);

      const method = typeof body.method === "string" ? body.method : "mobile_money";
      if (!CLAIM_METHODS.has(method)) return apiError("Unsupported payment method", 400);

      // A parent may only claim a payment for a child linked to their account.
      const supabase = createServiceRoleClientOrThrow();
      const { data: student, error: studentError } = await withTimeout(
        supabase
          .from("students")
          .select("id, first_name, last_name, school_id, class:classes(name)")
          .eq("id", studentId)
          .eq("school_id", schoolId)
          .maybeSingle(),
        15000,
        timeoutFallback(),
      );

      if (studentError) {
        if (isMissingSchema(studentError)) return SCHEMA_MISSING_RESPONSE();
        logger.error("fee-payment-claims: student lookup failed", studentError);
        return apiError("Could not verify the student", 500);
      }
      if (!student) return apiError("Student not found", 404);

      if (auth.context.user.role === "parent") {
        const { data: link } = await supabase
          .from("parent_students")
          .select("student_id")
          .eq("parent_id", auth.context.user.id)
          .eq("student_id", studentId)
          .maybeSingle();
        if (!link) return apiError("You are not linked to this student", 403);
      }

      // One open claim per student — surface the existing one instead of failing
      // with a raw unique-constraint error the parent can't act on.
      const { data: open, error: openError } = await withTimeout(
        supabase
          .from("fee_payment_claims")
          .select("id, amount, created_at")
          .eq("student_id", studentId)
          .eq("status", "pending")
          .maybeSingle(),
        15000,
        timeoutFallback(),
      );

      if (isMissingSchema(openError)) return SCHEMA_MISSING_RESPONSE();

      if (open) {
        return apiError("You already have a payment awaiting confirmation. The school will confirm it shortly.", 409);
      }

      const { data: inserted, error: insertError } = await withTimeout(
        supabase
          .from("fee_payment_claims")
          .insert({
            school_id: schoolId,
            student_id: studentId,
            amount,
            claimed_method: method,
            reference: typeof body.reference === "string" ? body.reference.trim().slice(0, 120) || null : null,
            note: typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null,
            status: "pending",
            submitted_by: auth.context.user.id,
          })
          .select("id, amount, status, created_at")
          .single(),
        15000,
        timeoutFallback(),
      );

      if (insertError) {
        if (isMissingSchema(insertError)) return SCHEMA_MISSING_RESPONSE();
        logger.error("fee-payment-claims: insert failed", insertError);
        return apiError("Could not submit your payment. Please try again.", 500);
      }

      return apiSuccess({
        claim: inserted,
        message: "Payment submitted. The school will confirm it once they have received it.",
      });
    }

    if (action === "list") {
      const supabase = createServiceRoleClientOrThrow();
      const status = typeof body.status === "string" ? body.status : "pending";

      const { data, error } = await withTimeout(
        supabase
          .from("fee_payment_claims")
          .select(
            "id, amount, claimed_method, reference, note, status, created_at, student_id, students!inner(first_name, last_name, class:classes(name))",
          )
          .eq("school_id", schoolId)
          .eq("status", status)
          .order("created_at", { ascending: false })
          .limit(100),
        15000,
        timeoutFallback(),
      );

      if (error) {
        // Missing table just means there is nothing to review yet.
        if (isMissingSchema(error)) return apiSuccess({ claims: [] });
        logger.error("fee-payment-claims: list failed", error);
        return apiError("Could not load payment claims", 500);
      }

      return apiSuccess({ claims: data ?? [] });
    }

    // review
    const roleCheck = assertUserRoleOrDeny({
      userRole: auth.context.user.role,
      allowedRoles: REVIEW_ROLES,
    });
    if (!roleCheck.ok) return roleCheck.response;

    const claimId = typeof body.claimId === "string" ? body.claimId : "";
    const decision = body.decision === "approve" ? "approved" : body.decision === "reject" ? "rejected" : null;
    if (!claimId || !decision) return apiError("claimId and decision (approve|reject) are required", 400);

    const supabase = createServiceRoleClientOrThrow();
    const { data: claim, error: claimError } = await withTimeout(
      supabase
        .from("fee_payment_claims")
        .select("id, student_id, amount, claimed_method, reference, status, school_id")
        .eq("id", claimId)
        .eq("school_id", schoolId)
        .maybeSingle(),
      15000,
      timeoutFallback(),
    );

    if (claimError) {
      if (isMissingSchema(claimError)) return SCHEMA_MISSING_RESPONSE();
      logger.error("fee-payment-claims: claim lookup failed", claimError);
      return apiError("Could not load that claim", 500);
    }
    if (!claim) return apiError("Claim not found", 404);
    if (claim.status !== "pending") return apiError(`This claim was already ${claim.status}`, 409);

    if (decision === "rejected") {
      const { error: rejectError } = await withTimeout(
        supabase
          .from("fee_payment_claims")
          .update({
            status: "rejected",
            reviewed_by: auth.context.user.id,
            reviewed_at: new Date().toISOString(),
            review_note: typeof body.reviewNote === "string" ? body.reviewNote.slice(0, 500) : null,
          })
          .eq("id", claimId)
          .eq("status", "pending"),
        15000,
        timeoutFallback(),
      );
      if (rejectError) {
        logger.error("fee-payment-claims: reject failed", rejectError);
        return apiError("Could not reject the claim", 500);
      }
      return apiSuccess({ message: "Claim rejected" });
    }

    // Approve → create the real fee payment. NOTE: fee_payments in this schema
    // has no school_id column (schema.sql is out of date) — the school is
    // reached through the student. Including school_id made every approval
    // fail with 42703.
    const paymentMethod = CLAIM_METHODS.has(claim.claimed_method)
      ? (claim.claimed_method as "cash" | "mobile_money" | "bank" | "installment" | "in_kind")
      : "mobile_money";

    // Attach the claim to the student's oldest still-open fee term so the
    // payment reduces a real balance rather than floating unallocated.
    let studentFeeTermId: string | null = null;
    try {
      const { data: openTerm } = await withTimeout(
        supabase
          .from("student_fee_terms")
          .select("id")
          .eq("student_id", claim.student_id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        10000,
        timeoutFallback(),
      );
      studentFeeTermId = (openTerm as { id?: string } | null)?.id ?? null;
    } catch {
      studentFeeTermId = null;
    }

    const { data: payment, error: paymentError } = await withTimeout(
      supabase
        .from("fee_payments")
        .insert({
          student_id: claim.student_id,
          amount_paid: claim.amount,
          payment_method: paymentMethod,
          // Carried through so the bursar can match it against the Momo/Airtel
          // statement. fee_payments.payment_reference is uniquely indexed, which
          // also blocks the same reference being paid twice.
          payment_reference: claim.reference ?? null,
          student_fee_term_id: studentFeeTermId,
          paid_by: "Parent (claimed in portal)",
          notes: "Confirmed from parent portal claim",
          payment_date: new Date().toISOString().split("T")[0],
          recorded_by: auth.context.user.id,
        })
        .select("id")
        .single(),
      15000,
      timeoutFallback(),
    );

    if (paymentError) {
      // 23505 on the unique payment_reference index means this Momo/Airtel
      // reference was already recorded — a likely double-count the bursar
      // needs to see, not a generic failure.
      if (paymentError.code === "23505") {
        logger.warn("fee-payment-claims: duplicate payment reference", paymentError);
        return apiError(
          `A payment with reference "${claim.reference ?? ""}" was already recorded. Check for a duplicate payment.`,
          409,
        );
      }
      logger.error("fee-payment-claims: payment insert failed", paymentError);
      return apiError("Could not record the payment", 500);
    }

    const { error: updateError } = await withTimeout(
      supabase
        .from("fee_payment_claims")
        .update({
          status: "approved",
          reviewed_by: auth.context.user.id,
          reviewed_at: new Date().toISOString(),
          approved_payment_id: payment.id,
          review_note: typeof body.reviewNote === "string" ? body.reviewNote.slice(0, 500) : null,
        })
        .eq("id", claimId)
        .eq("status", "pending"),
      15000,
      timeoutFallback(),
    );

    if (updateError) {
      // The payment exists but the claim is still open. Surface it loudly
      // rather than leaving a silent duplicate risk for the bursar.
      logger.error("fee-payment-claims: payment created but claim update failed", updateError);
      return apiError("Payment was recorded but the claim could not be closed. Please contact support.", 500);
    }

    return apiSuccess({ message: "Payment confirmed", paymentId: payment.id });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withSecurity(handlePost, { rateLimit: { limit: 20, windowMs: 60_000 } });
