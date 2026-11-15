import { NextRequest } from "next/server";
import {
  apiSuccess,
  apiError,
  requireUserWithSchool,
  assertUserRoleOrDeny,
  createServiceRoleClientOrThrow,
} from "@/lib/api-utils";

const ALLOWED = ["super_admin", "school_admin", "admin", "headmaster"];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;
    const roleCheck = assertUserRoleOrDeny({ userRole: auth.context.user.role, allowedRoles: ALLOWED });
    if (!roleCheck.ok) return roleCheck.response;
    if (!auth.context.schoolId) return apiError("School context required", 403);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const dryRun = body?.dryRun !== false;
    const schoolId = auth.context.schoolId;

    const admin = createServiceRoleClientOrThrow();

    // Collect referenced paths from DB.
    const referenced = new Set<string>();
    const { data: students } = await admin
      .from("students")
      .select("photo_url, passport_photo_url")
      .eq("school_id", schoolId);
    for (const s of students || []) {
      for (const url of [s.photo_url, s.passport_photo_url]) {
        const path = extractPath(url, "student-photos");
        if (path) referenced.add(`student-photos:${path}`);
      }
    }
    const { data: schools } = await admin
      .from("schools")
      .select("logo_url, signature_headteacher_url, signature_class_teacher_url")
      .eq("id", schoolId);
    for (const sc of schools || []) {
      for (const url of [sc.logo_url, sc.signature_headteacher_url, sc.signature_class_teacher_url]) {
        const path = extractPath(url, "school-logos");
        if (path) referenced.add(`school-logos:${path}`);
      }
    }

    const buckets = ["student-photos", "school-logos"] as const;
    const orphaned: { bucket: string; path: string }[] = [];

    for (const bucket of buckets) {
      const prefix = bucket === "student-photos" ? `${schoolId}/` : `schools/${schoolId}/`;
      const { data: files } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
      const flat = await listAll(admin, bucket, prefix);
      for (const f of flat) {
        const key = `${bucket}:${f}`;
        if (!referenced.has(key)) orphaned.push({ bucket, path: f });
      }
    }

    if (!dryRun) {
      for (const o of orphaned) {
        await admin.storage.from(o.bucket).remove([o.path]);
      }
    }

    return apiSuccess(
      { dryRun, orphanedCount: orphaned.length, orphaned: dryRun ? orphaned : undefined },
      dryRun ? "Dry run complete" : "Cleanup complete",
    );
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Cleanup failed", 500);
  }
}

function extractPath(url: string | null, bucket: string): string | null {
  if (!url) return null;
  const marker = `${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length).split("?")[0] || null;
}

async function listAll(admin: any, bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  const { data } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (!data) return out;
  for (const item of data) {
    if (item.id) {
      out.push(`${prefix}${item.name}`);
    } else {
      // folder
      out.push(...(await listAll(admin, bucket, `${prefix}${item.name}/`)));
    }
  }
  return out;
}
