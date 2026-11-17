import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClientOrThrow } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

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
      out.push(...(await listAll(admin, bucket, `${prefix}${item.name}/`)));
    }
  }
  return out;
}

export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClientOrThrow();
  const { data: schools } = await admin.from("schools").select("id");
  let deleted = 0;
  for (const school of schools || []) {
    const sid = school.id;
    const referenced = new Set<string>();
    const { data: students } = await admin.from("students").select("photo_url, passport_photo_url").eq("school_id", sid);
    for (const s of students || []) {
      for (const url of [s.photo_url, s.passport_photo_url]) {
        const path = extractPath(url, "student-photos");
        if (path) referenced.add(`student-photos:${path}`);
      }
    }
    const { data: schoolRows } = await admin.from("schools").select("logo_url, signature_headteacher_url, signature_class_teacher_url").eq("id", sid);
    for (const sc of schoolRows || []) {
      for (const url of [sc.logo_url, sc.signature_headteacher_url, sc.signature_class_teacher_url]) {
        const path = extractPath(url, "school-logos");
        if (path) referenced.add(`school-logos:${path}`);
      }
    }

    for (const bucket of ["student-photos", "school-logos"] as const) {
      const prefix = bucket === "student-photos" ? `${sid}/` : `schools/${sid}/`;
      const files = await listAll(admin, bucket, prefix);
      const orphans = files.filter((f) => !referenced.has(`${bucket}:${f}`));
      if (orphans.length > 0) {
        await admin.storage.from(bucket).remove(orphans);
        deleted += orphans.length;
      }
    }
  }

  logger.info(`[cron] storage cleanup deleted ${deleted} files`);
  return NextResponse.json({ ok: true, deleted });
}