import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { supabaseClientOptions } from "@/lib/api-utils";

const REQUEST_STATUSES = new Set(["open", "in_review", "needs_information", "completed", "declined"]);

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Privacy request storage is not configured");
  return createClient(url, serviceKey, supabaseClientOptions({ auth: { persistSession: false } }));
}

async function authenticatePrivacyOperator(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return { error: "Unauthorized", status: 401 as const };
  const admin = createAdminClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await admin.auth.getUser(authorization.slice(7));
  if (authError || !authUser) return { error: "Invalid session", status: 401 as const };
  const { data: profile, error } = await admin
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.id)
    .maybeSingle();
  if (error || !profile) return { error: "Account profile not found", status: 403 as const };
  if (profile.role !== "super_admin") return { error: "Forbidden", status: 403 as const };
  return { admin, profile };
}

export async function GET(request: NextRequest) {
  try {
    const result = await authenticatePrivacyOperator(request);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const { data, error } = await result.admin
      .from("privacy_requests")
      .select(
        "id, reference_code, requester_user_id, school_id, request_type, details, status, assigned_to, follow_up_at, resolution_note, created_at, updated_at, resolved_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const requesterIds = [...new Set((data ?? []).map((row) => row.requester_user_id).filter(Boolean))] as string[];
    const schoolIds = [...new Set((data ?? []).map((row) => row.school_id).filter(Boolean))] as string[];
    const [users, schools] = await Promise.all([
      requesterIds.length
        ? result.admin.from("users").select("id, full_name, email, phone, role").in("id", requesterIds)
        : Promise.resolve({ data: [], error: null }),
      schoolIds.length
        ? result.admin.from("schools").select("id, name").in("id", schoolIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (users.error) throw users.error;
    if (schools.error) throw schools.error;
    const usersById = new Map((users.data ?? []).map((user) => [user.id, user]));
    const schoolsById = new Map((schools.data ?? []).map((school) => [school.id, school]));

    return NextResponse.json(
      {
        requests: (data ?? []).map((row) => ({
          ...row,
          requester: row.requester_user_id ? (usersById.get(row.requester_user_id) ?? null) : null,
          school: row.school_id ? (schoolsById.get(row.school_id) ?? null) : null,
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    logger.error("[super-admin/privacy-requests] Failed to load privacy queue", error);
    return NextResponse.json({ error: "Could not load privacy request queue" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await authenticatePrivacyOperator(request);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    const body = (await request.json().catch(() => null)) as {
      id?: unknown;
      status?: unknown;
      resolutionNote?: unknown;
      followUpAt?: unknown;
    } | null;
    if (typeof body?.id !== "string" || typeof body.status !== "string" || !REQUEST_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Provide a valid request id and status." }, { status: 400 });
    }
    const resolutionNote = typeof body.resolutionNote === "string" ? body.resolutionNote.trim() : "";
    if (resolutionNote.length > 2000)
      return NextResponse.json({ error: "Resolution note must be 2,000 characters or fewer." }, { status: 400 });
    if ((body.status === "completed" || body.status === "declined") && !resolutionNote) {
      return NextResponse.json({ error: "Add a resolution note before closing this request." }, { status: 400 });
    }
    const followUpAt = typeof body.followUpAt === "string" && body.followUpAt ? new Date(body.followUpAt) : null;
    if (followUpAt && Number.isNaN(followUpAt.getTime()))
      return NextResponse.json({ error: "Follow-up date is invalid." }, { status: 400 });
    const status = body.status;
    const { data, error } = await result.admin
      .from("privacy_requests")
      .update({
        status,
        assigned_to: status === "open" ? null : result.profile.id,
        follow_up_at: followUpAt?.toISOString() ?? null,
        resolution_note: resolutionNote || null,
        resolved_at: status === "completed" || status === "declined" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .select("id, reference_code, status, resolution_note, updated_at, resolved_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Privacy request not found" }, { status: 404 });
    return NextResponse.json({ request: data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    logger.error("[super-admin/privacy-requests] Failed to update privacy request", error);
    return NextResponse.json({ error: "Could not update privacy request" }, { status: 500 });
  }
}
