import { NextRequest, NextResponse } from "next/server";
import { requireCronSecretOrDeny, createServiceRoleClientOrThrow } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

export async function GET(request: NextRequest) {
  const cron = requireCronSecretOrDeny(request);
  if (!cron.ok) return cron.response;

  const supabase = createServiceRoleClientOrThrow();
  const results = { schools: 0, files: 0, errors: [] as string[] };

  // Ensure bucket exists (ignore "already exists").
  try {
    await supabase.storage.createBucket("school-backups", { public: false });
  } catch {
    // ignore
  }

  const { data: schools, error: schoolsError } = await supabase.from("schools").select("id, name");
  if (schoolsError) {
    return NextResponse.json({ error: schoolsError.message }, { status: 500 });
  }

  const date = new Date().toISOString().split("T")[0];

  for (const school of schools || []) {
    results.schools += 1;
    try {
      const { data: students } = await supabase.from("students").select("*").eq("school_id", school.id);
      const { data: attendance } = await supabase
        .from("attendance")
        .select("*")
        .gte("date", new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]);

      // Filter attendance to this school's classes.
      const { data: classes } = await supabase.from("classes").select("id").eq("school_id", school.id);
      const classIds = new Set((classes || []).map((c: any) => c.id));
      const schoolAttendance = (attendance || []).filter((a: any) => classIds.has(a.class_id));

      const studentsCsv = toCsv((students || []) as Record<string, unknown>[]);
      const attendanceCsv = toCsv(schoolAttendance as Record<string, unknown>[]);

      const base = `${school.id}/${date}`;
      if (studentsCsv) {
        const { error } = await supabase.storage
          .from("school-backups")
          .upload(`${base}/students.csv`, new Blob([studentsCsv], { type: "text/csv" }), { upsert: true });
        if (!error) results.files += 1;
      }
      if (attendanceCsv) {
        const { error } = await supabase.storage
          .from("school-backups")
          .upload(`${base}/attendance.csv`, new Blob([attendanceCsv], { type: "text/csv" }), { upsert: true });
        if (!error) results.files += 1;
      }
    } catch (e) {
      results.errors.push(`${school.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  logger.info(`[Cron Backup] ${results.schools} schools, ${results.files} files`);
  return NextResponse.json(results);
}
