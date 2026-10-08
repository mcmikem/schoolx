"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  getQuerySchoolId,
  withTimeout,
  getLocalDateString,
  isDashboardStatsDirty,
  clearDashboardStatsDirty,
  dedupeRead,
} from "./utils";
import { isDemoSchool } from "@/lib/demo-utils";
import { offlineDB } from "@/lib/offline";
import { logger } from "@/lib/logger";
import { normalizeFeeSummary, feeSummaryCacheKey, type FeeSummary } from "./fees";
import { getOrFetchCached, getCachedData, setCachedData } from "./queryCache";

interface DashboardStats {
  /** Every student on the roster — active, transferred, dropped, completed and
   *  pending alike. This is the one headline number every screen agrees on;
   *  showing it only for `status = 'active'` here is what made the Student Hub
   *  say 320 while the dashboards said 295. */
  totalStudents: number;
  maleStudents: number;
  femaleStudents: number;
  /** Active-only head count. Attendance is only marked for students still
   *  enrolled, so this — not `totalStudents` — is the denominator of every
   *  attendance rate. */
  activeStudents: number;
  /** Present count for today. -1 means "unknown" (query timed out); the UI must
   *  show "--" rather than a misleading 0, and must NOT flag "attendance not
   *  taken yet" until a successful query confirms it really is 0. */
  presentToday: number;
  feesCollected: number;
  feesBalance: number;
  totalClasses: number;
  totalTeachers: number;
}

const EMPTY_STATS: DashboardStats = {
  totalStudents: 0,
  maleStudents: 0,
  femaleStudents: 0,
  activeStudents: 0,
  presentToday: -1,
  feesCollected: 0,
  feesBalance: 0,
  totalClasses: 0,
  totalTeachers: 0,
};

const DEMO_STATS: DashboardStats = {
  totalStudents: 847,
  maleStudents: 423,
  femaleStudents: 424,
  activeStudents: 847,
  presentToday: 798,
  feesCollected: 45000000,
  feesBalance: 12500000,
  totalClasses: 12,
  totalTeachers: 24,
};

// Cached stats are considered "fresh" for this long. While fresh, revisits
// render instantly from the IndexedDB cache and no background re-fetch runs —
// this is what stops the dashboard from reloading the whole board every time
// the tab regains focus or the user navigates back. In-app mutations (saving
// attendance/fees) force an immediate refresh via `dashboard-stats:refresh`,
// so a generous TTL is safe and keeps revisits fast on 3G — and keeps a room
// full of phones from re-running the full 8-query batch every few minutes.
const STATS_TTL = 15 * 60 * 1000;

const STATS_CACHE_PREFIX = "dashboard-stats:";

interface CachedStats {
  stats: DashboardStats;
  savedAt: number;
}

async function readCachedStats(cacheKey: string): Promise<CachedStats | null> {
  try {
    const cached = (await offlineDB.get("dashboard_cache", cacheKey)) as { payload?: CachedStats } | null;
    const payload = cached?.payload;
    if (!payload || typeof payload.savedAt !== "number" || !payload.stats) return null;
    // Snapshots written before `activeStudents` existed arrive without it;
    // spreading the empty defaults keeps rate maths from dividing by undefined.
    return { ...payload, stats: { ...EMPTY_STATS, ...payload.stats } };
  } catch {
    return null;
  }
}

async function writeCachedStats(cacheKey: string, stats: DashboardStats): Promise<void> {
  try {
    await offlineDB.cacheFromServer("dashboard_cache", [
      { id: cacheKey, payload: { stats, savedAt: Date.now() } } as unknown as Record<string, unknown>,
    ]);
  } catch (err) {
    logger.error("Failed to cache dashboard stats:", err);
  }
}

// Returned by withTimeout() when a head-count missed its deadline. Never
// rendered: computeStats turns it into a rejection so the dashboard keeps the
// last figure it actually verified instead of showing 0.
const COUNT_UNKNOWN = -1;

/**
 * Count students, optionally narrowed to one status and/or gender.
 *
 * A head-count instead of `select(...)` + `.length`: PostgREST caps a request
 * at 1000 rows, so the array version silently stopped growing and reported
 * exactly 1000 students for a school that had 1,001.
 */
function countStudents(schoolId: string, options?: { status?: string; gender?: "M" | "F" }) {
  let query = supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId);
  if (options?.status) query = query.eq("status", options.status);
  if (options?.gender) query = query.eq("gender", options.gender);

  return withTimeout(
    query.then((r) => {
      if (r.error) throw r.error;
      return r.count ?? 0;
    }),
    15000,
    COUNT_UNKNOWN,
  );
}

async function computeStats(
  schoolId: string,
  term?: number | null,
  academicYear?: string | null,
): Promise<DashboardStats> {
  // Local date — must match the date the attendance UI marks with. Using UTC
  // via toISOString() would shift a day for schools ahead of UTC (e.g. Uganda).
  const today = getLocalDateString();

  // All eight feed-queries run in parallel so the wall-clock time is bounded by
  // the slowest single query, not their sum — this is the single biggest
  // latency win on slow 3G links.
  //
  // Money comes from fee_summary(), the same function the Bursar dashboard
  // reads. Summing fee_structure x students-by-class here produced a different
  // answer for a different reason (it counted every term's fees at once while
  // the Bursar was scoped to the term in the header), so the two boards
  // disagreed about the collection rate with nothing to explain why. It also
  // capped out at 1000 payment rows, so "collected" stopped growing on a busy
  // school. Two queries disappear from the request and the answer is now
  // computed over the whole school in one round trip.
  const [feeSummary, rosterTotal, maleCount, femaleCount, activeTotal, presentCount, classCount, teacherCount] =
    await Promise.all([
      // Same key the Bursar panel's useFeeSummary reads under: when both mount
      // in the same tick the second caller joins the first one's in-flight
      // promise instead of firing a duplicate fee_summary() call, and a panel
      // opened minutes earlier leaves a warm cache behind. A rejection is
      // never cached, so a timeout still falls through to null below and the
      // board keeps its previous snapshot.
      getOrFetchCached<FeeSummary>(feeSummaryCacheKey(schoolId, term, academicYear), async () => {
        const summary = await withTimeout(
          supabase
            .rpc("fee_summary", {
              p_school_id: schoolId,
              p_term: term ?? null,
              p_academic_year: academicYear ?? null,
            })
            .maybeSingle()
            .then((r) => {
              if (r.error) throw r.error;
              const normalized = normalizeFeeSummary(r.data);
              if (!normalized) throw new Error("fee_summary() returned no row");
              return normalized;
            }),
          15000,
          null,
        );
        if (summary === null) throw new Error("Timed out reading fee_summary()");
        return summary;
      })
        .then((r) => r.data)
        .catch(() => null),
      countStudents(schoolId),
      countStudents(schoolId, { gender: "M" }),
      countStudents(schoolId, { gender: "F" }),
      countStudents(schoolId, { status: "active" }),
      // presentToday is counted directly on the attendance table. RLS already
      // scopes rows to this school's classes, so there is no need to first fetch
      // every student id and pass a huge IN(...) list (which could time out or
      // exceed URL length limits on large schools, silently reporting 0 present).
      // A timed-out count returns -1 ("unknown") so the dashboard never claims
      // attendance wasn't taken when the server was just slow.
      withTimeout(
        supabase
          .from("attendance")
          .select("id", { count: "exact", head: true })
          .eq("date", today)
          .eq("status", "present")
          .then((r) => {
            if (r.error) throw r.error;
            return r.count ?? 0;
          }),
        15000,
        -1,
      ),
      withTimeout(
        supabase
          .from("classes")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .then((r) => r.count),
        15000,
        0,
      ),
      withTimeout(
        supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId)
          .eq("role", "teacher")
          .then((r) => r.count),
        15000,
        0,
      ),
    ]);

  // Unknown money or student counts must not be written into the cache as
  // zero. Reject instead: fetchStats keeps the previous snapshot (and its
  // OfflineDB copy) and the caller keeps rendering something it stands behind.
  if (!feeSummary) throw new Error("Timed out reading fee_summary()");
  if (rosterTotal < 0 || maleCount < 0 || femaleCount < 0 || activeTotal < 0) {
    throw new Error("Timed out reading student counts");
  }

  return {
    totalStudents: rosterTotal,
    maleStudents: maleCount,
    femaleStudents: femaleCount,
    activeStudents: activeTotal,
    presentToday: presentCount,
    feesCollected: feeSummary.collectedTotal,
    feesBalance: Math.max(0, feeSummary.expectedTotal - feeSummary.collectedTotal),
    totalClasses: classCount || 0,
    totalTeachers: teacherCount || 0,
  };
}

/**
 * Dashboard headline stats with stale-while-revalidate behaviour:
 *  1. Seeds instantly from the IndexedDB cache (no full-screen spinner on
 *     revisits — data is "held" and remembered across refreshes).
 *  2. Revalidates in the background at most once per STATS_TTL.
 *  3. `refetch({ force: true })`/the `dashboard-stats:refresh` window event
 *     (fired after attendance/fees are saved) refresh immediately.
 */
export function useDashboardStats(schoolId?: string, options?: { term?: number | null; academicYear?: string | null }) {
  const term = options?.term ?? null;
  const academicYear = options?.academicYear ?? null;
  const { isDemo } = useAuth();
  // Scoped to the term, because fee_summary() is: the same school in Term 1
  // and Term 3 owes different amounts, and one cache entry for both would show
  // the previous term's collection rate after a switch.
  const cacheKey = schoolId ? `${STATS_CACHE_PREFIX}${schoolId}:${term ?? "all"}:${academicYear ?? "all"}` : "";
  // Synchronous memory seed. The IndexedDB seed below is async, so without
  // this every revisit flashes skeletons until it lands. The memory cache
  // mirrors every successful fetch with the same 5-minute TTL, so a fresh
  // entry paints real numbers on the very first render with loading already
  // false — the IndexedDB seed and background revalidation proceed unchanged.
  const [stats, setStats] = useState<DashboardStats>(() => {
    if (!schoolId || isDemo || isDemoSchool(schoolId)) return EMPTY_STATS;
    return getCachedData<CachedStats>(cacheKey)?.stats ?? EMPTY_STATS;
  });
  const [loading, setLoading] = useState(() => {
    if (!schoolId || isDemo || isDemoSchool(schoolId)) return false;
    return !getCachedData<CachedStats>(cacheKey);
  });
  const inFlightRef = useRef(false);

  const fetchStats = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!schoolId) {
        setLoading(false);
        return;
      }

      if (isDemo || isDemoSchool(schoolId)) {
        setStats(DEMO_STATS);
        setLoading(false);
        return;
      }

      if (inFlightRef.current) return;

      const querySchoolId = getQuerySchoolId(schoolId, isDemo);
      if (!querySchoolId) {
        setLoading(false);
        return;
      }

      if (!opts?.force) {
        const cached = await readCachedStats(cacheKey);
        if (cached && Date.now() - cached.savedAt < STATS_TTL) {
          // Still fresh — nothing to do; keep whatever is already shown.
          setLoading(false);
          return;
        }
      }

      inFlightRef.current = true;
      try {
        // Collapse simultaneous identical batches (two components mounting in
        // the same tick, StrictMode remounts) into one database round trip.
        // In-flight only — nothing stale is ever served from this.
        const next = await dedupeRead(cacheKey, () => computeStats(querySchoolId, term, academicYear));
        // A timed-out presentToday (-1) must not be cached (it would overwrite a
        // last-known-good snapshot) and must not downgrade the currently shown
        // value to "unknown". The UI keeps the previous value and shows "--".
        const presentKnown = next.presentToday >= 0;
        if (presentKnown) {
          setStats(next);
          await writeCachedStats(cacheKey, next);
          // Mirror into the synchronous memory cache so the next mount paints
          // instantly without waiting for the IndexedDB read.
          setCachedData(cacheKey, { stats: next, savedAt: Date.now() });
        } else {
          setStats((prev) => ({ ...next, presentToday: prev.presentToday }));
        }
      } catch (err) {
        logger.error("Error fetching stats:", err);
      } finally {
        inFlightRef.current = false;
        setLoading(false);
      }
    },
    [schoolId, isDemo, cacheKey, term, academicYear],
  );

  // Seed from cache on mount, then revalidate in the background.
  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }

    if (isDemo || isDemoSchool(schoolId)) {
      setStats(DEMO_STATS);
      setLoading(false);
      return;
    }

    let cancelled = false;
    readCachedStats(cacheKey).then((cached) => {
      if (cancelled) return;
      const lastSaved = cached?.savedAt || 0;
      if (cached) {
        setStats(cached.stats);
        setLoading(false);
      }
      // Force a refresh when attendance/fees were saved while this page was
      // unmounted (e.g. bulk-marked attendance, then navigated here).
      const dirty = isDashboardStatsDirty(schoolId, lastSaved);
      fetchStats({ force: dirty }).then(() => {
        if (dirty) clearDashboardStatsDirty(schoolId);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [schoolId, isDemo, cacheKey, fetchStats]);

  // Revalidate on focus/visibility ONLY when the cached stats have gone stale.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const maybeRevalidate = () => {
      readCachedStats(cacheKey).then((cached) => {
        if (!cached || Date.now() - cached.savedAt >= STATS_TTL) void fetchStats();
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") maybeRevalidate();
    };
    const handleFocus = () => maybeRevalidate();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [cacheKey, fetchStats]);

  // Refresh immediately when attendance/fees change elsewhere in the app.
  useEffect(() => {
    const handleRefresh = () => {
      void fetchStats({ force: true });
      if (schoolId) clearDashboardStatsDirty(schoolId);
    };
    window.addEventListener("dashboard-stats:refresh", handleRefresh);
    return () => window.removeEventListener("dashboard-stats:refresh", handleRefresh);
  }, [fetchStats, schoolId]);

  return { stats, loading, refetch: () => fetchStats({ force: true }) };
}

export function useAnalytics(schoolId?: string) {
  const [data, setData] = useState<any>({
    attendanceTrends: [],
    classPerformance: [],
    subjectPerformance: [],
    feeCollection: [],
    genderDistribution: [],
    revenueProjections: [],
    atRiskStudents: [],
    stats: { totalStudents: 0, avgAttendance: 0, avgGrade: 0, feeCollectionRate: 0, projectedRevenue: 0 },
  });
  const [loading, setLoading] = useState(true);
  const { isDemo } = useAuth();

  useEffect(() => {
    async function fetchAnalytics() {
      if (!schoolId) return;

      if (isDemo || isDemoSchool(schoolId)) {
        setData({
          genderDistribution: [
            { name: "Boys", value: 423, color: "#3b82f6" },
            { name: "Girls", value: 424, color: "#ec4899" },
          ],
          revenueProjections: [
            { name: "Collected", value: 45000000 },
            { name: "Outstanding", value: 12500000 },
          ],
          atRiskStudents: [
            {
              student_id: "demo-1",
              full_name: "John Okello",
              class_name: "Primary 4",
              risk_reason: "low_attendance",
              attendance_rate: 62,
              avg_score: 78,
            },
            {
              student_id: "demo-2",
              full_name: "Sarah Nabukeera",
              class_name: "Primary 5",
              risk_reason: "low_grades",
              attendance_rate: 88,
              avg_score: 42,
            },
          ],
          attendanceTrends: [
            { name: "Week 1", value: 94 },
            { name: "Week 2", value: 92 },
            { name: "Week 3", value: 89 },
            { name: "Week 4", value: 91 },
          ],
          classPerformance: [
            { name: "Primary 1", value: 78 },
            { name: "Primary 2", value: 82 },
            { name: "Primary 3", value: 75 },
            { name: "Primary 4", value: 71 },
          ],
          subjectPerformance: [
            { name: "Mathematics", value: 74 },
            { name: "English", value: 78 },
            { name: "Science", value: 72 },
            { name: "Social Studies", value: 68 },
          ],
          feeCollection: [
            { name: "Term 1", value: 45000000 },
            { name: "Term 2", value: 42000000 },
            { name: "Term 3", value: 38000000 },
          ],
          stats: {
            totalStudents: 847,
            avgAttendance: 92,
            avgGrade: 74,
            feeCollectionRate: 78,
            projectedRevenue: 57500000,
          },
        });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Use proper joins - attendance and grades don't have school_id directly
        const [
          { data: students },
          { data: feeStructure },
          { data: attendance },
          { data: grades },
          rosterCount,
          rosterMale,
          rosterFemale,
        ] = await Promise.all([
          supabase
            .from("students")
            .select("id, first_name, last_name, gender, class_id, classes(name)")
            .eq("school_id", schoolId)
            .eq("status", "active"),
          supabase.from("fee_structure").select("id, amount").eq("school_id", schoolId),
          supabase
            .from("attendance")
            .select("student_id, status, date, students!inner(school_id)")
            .eq("students.school_id", schoolId)
            .order("date", { ascending: false })
            .limit(2000),
          supabase
            .from("grades")
            .select("student_id, score, class_id, students!inner(school_id), classes(name)")
            .eq("students.school_id", schoolId),
          // Head counts over the whole roster (all statuses). The row query
          // above is active-only and stops at PostgREST's 1000-row ceiling, so
          // `students.length` was neither the same definition nor the same
          // number as the dashboard headline.
          countStudents(schoolId),
          countStudents(schoolId, { gender: "M" }),
          countStudents(schoolId, { gender: "F" }),
        ]);

        const genderLevels = { M: 0, F: 0 };
        students?.forEach((s: any) => {
          if (s.gender === "M") genderLevels.M++;
          else if (s.gender === "F") genderLevels.F++;
        });
        if (rosterMale >= 0 && rosterFemale >= 0) {
          genderLevels.M = rosterMale;
          genderLevels.F = rosterFemale;
        }
        const genderDistribution = [
          { name: "Boys", value: genderLevels.M, color: "#3b82f6" },
          { name: "Girls", value: genderLevels.F, color: "#ec4899" },
        ];

        const feeIds = feeStructure?.map((f: any) => f.id) || [];
        let totalCollected = 0;
        if (feeIds.length > 0) {
          const { data: payments } = await supabase.from("fee_payments").select("amount_paid").in("fee_id", feeIds);
          totalCollected = payments?.reduce((acc, p) => acc + (p.amount_paid || 0), 0) || 0;
        }
        const totalExpected = feeStructure?.reduce((acc: number, f: any) => acc + (f.amount || 0), 0) || 0;
        const revenueProjections = [
          { name: "Collected", value: totalCollected },
          { name: "Outstanding", value: Math.max(0, totalExpected - totalCollected) },
        ];

        const attendanceMap: Record<string, { present: number; total: number }> = {};
        attendance?.forEach((a: any) => {
          if (!attendanceMap[a.student_id]) attendanceMap[a.student_id] = { present: 0, total: 0 };
          attendanceMap[a.student_id].total++;
          if (a.status === "present") attendanceMap[a.student_id].present++;
        });
        const gradesMap: Record<string, { sum: number; count: number }> = {};
        grades?.forEach((g: any) => {
          if (!gradesMap[g.student_id]) gradesMap[g.student_id] = { sum: 0, count: 0 };
          gradesMap[g.student_id].sum += g.score;
          gradesMap[g.student_id].count++;
        });
        const atRiskStudents = students
          ?.map((s: any) => {
            const att = attendanceMap[s.id];
            const attRate = att ? (att.present / att.total) * 100 : 100;
            const grd = gradesMap[s.id];
            const avgScore = grd ? grd.sum / grd.count : 100;
            if (attRate < 75 || avgScore < 50)
              return {
                student_id: s.id,
                full_name: `${s.first_name} ${s.last_name}`,
                class_name: s.classes?.[0]?.name || "N/A",
                risk_reason: attRate < 75 && avgScore < 50 ? "both" : attRate < 75 ? "low_attendance" : "low_grades",
                attendance_rate: attRate,
                avg_score: avgScore,
              };
            return null;
          })
          .filter((s: any) => s !== null);

        // Compute real average attendance rate across all students with records
        const allAttRates = Object.values(attendanceMap).map((a) => (a.present / a.total) * 100);
        const realAvgAttendance =
          allAttRates.length > 0 ? Math.round(allAttRates.reduce((s, v) => s + v, 0) / allAttRates.length) : 0;

        // Compute real average grade across all students with grades
        const allGradeAvgs = Object.values(gradesMap).map((g) => g.sum / g.count);
        const realAvgGrade =
          allGradeAvgs.length > 0 ? Math.round(allGradeAvgs.reduce((s, v) => s + v, 0) / allGradeAvgs.length) : 0;

        // Compute health score as weighted average of fee collection rate and attendance rate
        const feeRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;
        const healthScore = Math.round(realAvgAttendance * 0.5 + feeRate * 0.3 + realAvgGrade * 0.2);

        // Compute weekly attendance trends from the last 4 weeks
        const weeklyAttendance: Record<string, { present: number; total: number }> = {};
        attendance?.forEach((a: any) => {
          if (!a.date) return;
          const d = new Date(a.date);
          // ISO week: number of weeks since a fixed reference Monday
          const startOfYear = new Date(d.getFullYear(), 0, 1);
          const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
          const key = `W${weekNum}`;
          if (!weeklyAttendance[key]) weeklyAttendance[key] = { present: 0, total: 0 };
          weeklyAttendance[key].total++;
          if (a.status === "present") weeklyAttendance[key].present++;
        });
        const attendanceTrends = Object.entries(weeklyAttendance)
          .slice(-4)
          .map(([name, v]) => ({ name, value: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0 }));

        // Compute class performance from grades grouped by class
        const classGradesMap: Record<string, { name: string; sum: number; count: number }> = {};
        grades?.forEach((g: any) => {
          const className = (g.classes as any)?.name || g.class_id || "Unknown";
          if (!classGradesMap[className]) classGradesMap[className] = { name: className, sum: 0, count: 0 };
          classGradesMap[className].sum += g.score;
          classGradesMap[className].count++;
        });
        const classPerformance = Object.values(classGradesMap)
          .map((c) => ({ name: c.name, value: c.count > 0 ? Math.round(c.sum / c.count) : 0 }))
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, 8);

        setData({
          genderDistribution,
          revenueProjections,
          atRiskStudents: atRiskStudents || [],
          attendanceTrends,
          classPerformance,
          subjectPerformance: [],
          feeCollection: [],
          stats: {
            totalStudents: rosterCount >= 0 ? rosterCount : students?.length || 0,
            avgAttendance: realAvgAttendance,
            avgGrade: realAvgGrade,
            feeCollectionRate: feeRate,
            projectedRevenue: totalExpected,
            healthScore,
          },
        });
      } catch (err) {
        logger.error("Analytics Error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [schoolId, isDemo]);

  return { data, loading };
}
