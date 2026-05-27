import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

interface ScanEventLogInput {
  schoolId: string;
  entityType: "student_meal" | "staff_attendance";
  decision: "allowed" | "blocked";
  reasonCode: string;
  reasonMessage?: string;
  targetId?: string | null;
  operatorUserId?: string | null;
  scannerId?: string | null;
  source?: string;
  rawScanHash?: string | null;
  isSigned?: boolean;
  signatureValid?: boolean | null;
  mealType?: string | null;
  attendanceAction?: "check_in" | "check_out" | null;
  metadata?: Record<string, unknown>;
}

export function extractScannerContext(request: NextRequest, scannerIdFromBody?: string | null) {
  const scannerIdHeader = request.headers.get("x-scanner-id");
  const scannerId = (scannerIdFromBody || scannerIdHeader || "").trim() || null;
  const userAgent = request.headers.get("user-agent") || null;
  const forwardedFor = request.headers.get("x-forwarded-for") || null;

  return {
    scannerId,
    metadata: {
      userAgent,
      forwardedFor,
      endpoint: request.nextUrl.pathname,
    },
  };
}

export async function logScanEvent(
  supabase: any,
  input: ScanEventLogInput,
): Promise<void> {
  try {
    await supabase.from("scan_event_logs").insert({
      school_id: input.schoolId,
      entity_type: input.entityType,
      target_id: input.targetId || null,
      meal_type: input.mealType || null,
      attendance_action: input.attendanceAction || null,
      operator_user_id: input.operatorUserId || null,
      scanner_id: input.scannerId || null,
      source: input.source || "scanner",
      raw_scan_hash: input.rawScanHash || null,
      is_signed: Boolean(input.isSigned),
      signature_valid: input.signatureValid ?? null,
      decision: input.decision,
      reason_code: input.reasonCode,
      reason_message: input.reasonMessage || null,
      metadata: input.metadata || {},
    });
  } catch (error) {
    logger.warn("Failed to write scan_event_logs entry", error);
  }
}
