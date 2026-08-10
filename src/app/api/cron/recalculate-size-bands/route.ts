import { NextRequest, NextResponse } from "next/server";
import { requireCronSecretOrDeny, createServiceRoleClientOrThrow } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

const SMALL_MAX = 150;
const MEDIUM_MAX = 600;

export async function GET(request: NextRequest) {
  const cron = requireCronSecretOrDeny(request);
  if (!cron.ok) return cron.response;

  try {
    const supabase = createServiceRoleClientOrThrow();
    const now = new Date().toISOString();

    const { data: schools, error: fetchError } = await supabase.from("schools").select("id, school_size_band");

    if (fetchError) {
      logger.error("Recalculate-size-bands: fetch error:", fetchError);
      return NextResponse.json({ success: false, error: "Failed to fetch schools" }, { status: 500 });
    }

    if (!schools || schools.length === 0) {
      return NextResponse.json({ success: true, timestamp: now, updated: 0, message: "No schools found" });
    }

    const studentCounts: Record<string, number> = {};
    const schoolIds = schools.map((s) => s.id);

    for (let i = 0; i < schoolIds.length; i += 50) {
      const batch = schoolIds.slice(i, i + 50);
      const { data: counts } = await supabase.from("students").select("school_id").in("school_id", batch);

      if (counts) {
        for (const row of counts) {
          studentCounts[row.school_id] = (studentCounts[row.school_id] || 0) + 1;
        }
      }
    }

    const updates: { id: string; oldBand: string; newBand: string; studentCount: number }[] = [];

    for (const school of schools) {
      const count = studentCounts[school.id] || 0;
      let newBand: string;
      if (count <= SMALL_MAX) newBand = "small";
      else if (count <= MEDIUM_MAX) newBand = "medium";
      else newBand = "large";

      if (newBand !== school.school_size_band) {
        updates.push({ id: school.id, oldBand: school.school_size_band, newBand, studentCount: count });
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: true,
        timestamp: now,
        updated: 0,
        message: "All schools already in correct size band",
      });
    }

    let updatedCount = 0;
    const failedIds: string[] = [];

    for (const u of updates) {
      const { error: updateError } = await supabase
        .from("schools")
        .update({ school_size_band: u.newBand })
        .eq("id", u.id);

      if (updateError) {
        logger.error(`Recalculate-size-bands: failed to update school ${u.id}:`, updateError);
        failedIds.push(u.id);
      } else {
        updatedCount++;
      }
    }

    if (failedIds.length === updates.length) {
      return NextResponse.json({ success: false, error: "All size band updates failed" }, { status: 500 });
    }

    const logEntries = updates
      .filter((u) => !failedIds.includes(u.id))
      .map((u) => ({
        provider: "system",
        event_type: "size_band_changed",
        event_id: `size-${u.id}-${Date.now()}`,
        raw_body: {
          school_id: u.id,
          previous_band: u.oldBand,
          new_band: u.newBand,
          student_count: u.studentCount,
        },
        status: "processed" as const,
        processed_at: now,
      }));

    if (logEntries.length > 0) {
      const { error: logError } = await supabase.from("webhook_events").insert(logEntries);
      if (logError) {
        logger.error("Recalculate-size-bands: failed to write audit log:", logError);
      }
    }

    logger.info(`Updated size bands for ${updatedCount} schools (${failedIds.length} failed)`);

    return NextResponse.json({
      success: failedIds.length === 0,
      timestamp: now,
      updated: updatedCount,
      failed: failedIds.length,
      changes: updates
        .filter((u) => !failedIds.includes(u.id))
        .map((u) => ({
          schoolId: u.id,
          from: u.oldBand,
          to: u.newBand,
          students: u.studentCount,
        })),
    });
  } catch (error: any) {
    logger.error("Recalculate-size-bands: unexpected error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
