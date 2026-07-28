import { NextRequest, NextResponse } from "next/server";
import { requireUserWithSchool } from "@/lib/api-utils";
import { rateLimit } from "@/lib/api-utils";
import { sendWelcomeEmail, sendPasswordResetEmail, sendReceiptEmail } from "@/lib/email/service";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const { success: rlOk } = rateLimit(request, 10, 60000);
    if (!rlOk) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { type, to, ...params } = body as {
      type: "welcome" | "password_reset" | "receipt";
      to: string;
      name?: string;
      schoolName?: string;
      resetToken?: string;
      studentName?: string;
      amount?: number;
      receiptNumber?: string;
    };

    if (!to || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let result;
    switch (type) {
      case "welcome":
        result = await sendWelcomeEmail(to, params.name || "Parent", params.schoolName || "Your School");
        break;
      case "password_reset":
        result = await sendPasswordResetEmail(to, params.resetToken || "", params.schoolName || "School");
        break;
      case "receipt":
        result = await sendReceiptEmail(
          to,
          params.studentName || "",
          params.amount || 0,
          params.schoolName || "School",
          params.receiptNumber || "",
        );
        break;
      default:
        return NextResponse.json({ error: "Invalid email type" }, { status: 400 });
    }

    if (result.success) {
      return NextResponse.json({ success: true, messageId: result.messageId });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error) {
    logger.error("[Email Send] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}
