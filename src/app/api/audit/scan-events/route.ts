import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertApiAccessOrDeny, requireUserWithSchool } from "@/lib/api-utils";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type ScanDecision = "allowed" | "blocked";
type ScanEntityType = "student_meal" | "staff_attendance";

type ScanEventRow = {
  id: string;
  created_at: string;
  entity_type: ScanEntityType;
  target_id: string | null;
  meal_type: string | null;
  attendance_action: "check_in" | "check_out" | null;
  operator_user_id: string | null;
  scanner_id: string | null;
  source: string | null;
  raw_scan_hash: string | null;
  is_signed: boolean | null;
  signature_valid: boolean | null;
  decision: ScanDecision;
  reason_code: string;
  reason_message: string | null;
  metadata: Record<string, unknown> | null;
};

type EnrichedScanEventRow = ScanEventRow & {
  operator_name: string;
  operator_role: string | null;
  target_label: string;
};

type ScanEventFilters = {
  decision?: string;
  entityType?: string;
  reasonCode?: string;
  scannerId?: string;
  operatorId?: string;
  dateFrom?: string;
  dateTo?: string;
};

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function applyFilters(query: any, filters: { decision?: string; entityType?: string; reasonCode?: string; scannerId?: string; operatorId?: string; dateFrom?: string; dateTo?: string; }) {
  if (filters.decision && filters.decision !== "all") {
    query = query.eq("decision", filters.decision);
  }
  if (filters.entityType && filters.entityType !== "all") {
    query = query.eq("entity_type", filters.entityType);
  }
  if (filters.reasonCode && filters.reasonCode !== "all") {
    query = query.eq("reason_code", filters.reasonCode);
  }
  if (filters.scannerId && filters.scannerId !== "all") {
    query = query.eq("scanner_id", filters.scannerId);
  }
  if (filters.operatorId && filters.operatorId !== "all") {
    query = query.eq("operator_user_id", filters.operatorId);
  }
  if (filters.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("created_at", filters.dateTo);
  }
  return query;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

function formatTargetLabel(
  row: ScanEventRow,
  studentMap: Map<string, string>,
  userMap: Map<string, string>,
) {
  if (!row.target_id) return "Unknown target";

  if (row.entity_type === "student_meal") {
    return studentMap.get(row.target_id) || row.target_id;
  }

  return userMap.get(row.target_id) || row.target_id;
}

function escapeCsvValue(value: unknown) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function buildCsv(events: EnrichedScanEventRow[]) {
  const headers = [
    "Timestamp",
    "Entity",
    "Target",
    "Decision",
    "Reason Code",
    "Reason Message",
    "Operator",
    "Operator Role",
    "Scanner ID",
    "Signature",
    "Meal Type",
    "Attendance Action",
    "Source",
  ];

  const rows = events.map((event) => [
    event.created_at,
    event.entity_type,
    event.target_label,
    event.decision,
    event.reason_code,
    event.reason_message || "",
    event.operator_name,
    event.operator_role || "",
    event.scanner_id || "",
    event.signature_valid === true
      ? "verified"
      : event.signature_valid === false
        ? "rejected"
        : event.is_signed
          ? "signed"
          : "unsigned",
    event.meal_type || "",
    event.attendance_action || "",
    event.source || "",
  ]);

  return [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\n");
}

export async function GET(request: NextRequest) {
  const auth = await requireUserWithSchool(request);
  if (!auth.ok) return auth.response;

  const accessCheck = assertApiAccessOrDeny({
    userRole: auth.context.user.role,
    permission: "settings",
  });
  if (!accessCheck.ok) return accessCheck.response;

  const emptyResponse = NextResponse.json({
    success: true,
    events: [],
    total: 0,
    summary: {
      allowed: 0,
      blocked: 0,
      invalidSignatures: 0,
    },
  });

  if (process.env.NODE_ENV === "development" && (!supabaseUrl || !supabaseServiceKey)) {
    const format = request.nextUrl.searchParams.get("format") || "json";
    if (format === "csv") {
      const csv = buildCsv([]);
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="scan-events-empty.csv"',
        },
      });
    }

    return NextResponse.json({
      success: true,
      events: [],
      total: 0,
      summary: {
        allowed: 0,
        blocked: 0,
        invalidSignatures: 0,
      },
    });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Scan events service configuration is missing" },
      { status: 500 },
    );
  }

  const schoolId = auth.context.schoolId;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const params = request.nextUrl.searchParams;
  const format = params.get("format") || "json";
  const isCsv = format === "csv";
  const decision = params.get("decision") || "all";
  const entityType = params.get("entityType") || "all";
  const reasonCode = params.get("reasonCode") || "all";
  const scannerId = params.get("scannerId") || "all";
  const operatorId = params.get("operatorId") || "all";
  const page = clampInt(params.get("page"), 1, 1, 10_000);
  const limit = clampInt(params.get("limit"), isCsv ? 5000 : 25, 1, isCsv ? 5000 : 100);
  const offset = isCsv ? 0 : (page - 1) * limit;
  const dateFrom = params.get("dateFrom") || "";
  const dateTo = params.get("dateTo") || "";

  const baseFilters = { decision, entityType, reasonCode, scannerId, operatorId, dateFrom, dateTo };
  const countFilters = { ...baseFilters };

  const totalQuery = applyFilters(
    supabase.from("scan_event_logs").select("id", { count: "exact", head: true }),
    countFilters,
  );
  const allowedQuery = applyFilters(
    supabase.from("scan_event_logs").select("id", { count: "exact", head: true }),
    { ...countFilters, decision: "allowed" },
  );
  const blockedQuery = applyFilters(
    supabase.from("scan_event_logs").select("id", { count: "exact", head: true }),
    { ...countFilters, decision: "blocked" },
  );
  const invalidQuery = applyFilters(
    supabase.from("scan_event_logs").select("id", { count: "exact", head: true }),
    { ...countFilters },
  ).eq("signature_valid", false);

  const eventsQuery = applyFilters(
    supabase
      .from("scan_event_logs")
      .select(
        "id, created_at, entity_type, target_id, meal_type, attendance_action, operator_user_id, scanner_id, source, raw_scan_hash, is_signed, signature_valid, decision, reason_code, reason_message, metadata",
      ),
    baseFilters,
  )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const [totalResult, allowedResult, blockedResult, invalidResult, eventsResult] = await Promise.all([
    totalQuery.eq("school_id", schoolId),
    allowedQuery.eq("school_id", schoolId),
    blockedQuery.eq("school_id", schoolId),
    invalidQuery.eq("school_id", schoolId),
    eventsQuery.eq("school_id", schoolId),
  ]);

    if (eventsResult.error) {
      if (process.env.NODE_ENV === "development") return emptyResponse;
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const rows = (eventsResult.data || []) as ScanEventRow[];
  const operatorIds = uniqueStrings(rows.map((row) => row.operator_user_id));
  const studentIds = uniqueStrings(
    rows.filter((row) => row.entity_type === "student_meal").map((row) => row.target_id),
  );
  const staffTargetIds = uniqueStrings(
    rows.filter((row) => row.entity_type === "staff_attendance").map((row) => row.target_id),
  );

  const [operatorsResult, studentsResult, staffTargetsResult] = await Promise.all([
    operatorIds.length
      ? supabase.from("users").select("id, full_name, role").eq("school_id", schoolId).in("id", operatorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; role: string | null }>, error: null }),
    studentIds.length
      ? supabase
          .from("students")
          .select("id, first_name, last_name, student_number")
          .eq("school_id", schoolId)
          .in("id", studentIds)
      : Promise.resolve({ data: [] as Array<{ id: string; first_name: string | null; last_name: string | null; student_number: string | null }>, error: null }),
    staffTargetIds.length
      ? supabase.from("users").select("id, full_name, role").eq("school_id", schoolId).in("id", staffTargetIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; role: string | null }>, error: null }),
  ]);

  if (operatorsResult.error) {
    if (process.env.NODE_ENV === "development") return emptyResponse;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (studentsResult.error) {
    if (process.env.NODE_ENV === "development") return emptyResponse;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  if (staffTargetsResult.error) {
    if (process.env.NODE_ENV === "development") return emptyResponse;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const operatorMap = new Map(
    (operatorsResult.data || []).map((user) => [
      user.id,
      user.full_name?.trim() || user.role || user.id,
    ]),
  );
  const studentMap = new Map(
    (studentsResult.data || []).map((student) => [
      student.id,
      [student.student_number, [student.first_name, student.last_name].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(" • ") || student.id,
    ]),
  );
  const staffTargetMap = new Map(
    (staffTargetsResult.data || []).map((user) => [
      user.id,
      user.full_name?.trim() || user.role || user.id,
    ]),
  );

  const events: EnrichedScanEventRow[] = rows.map((row) => ({
    ...row,
    operator_name: row.operator_user_id ? operatorMap.get(row.operator_user_id) || row.operator_user_id : "System",
    operator_role: row.operator_user_id
      ? (operatorsResult.data || []).find((user) => user.id === row.operator_user_id)?.role || null
      : null,
    target_label: formatTargetLabel(row, studentMap, staffTargetMap),
  }));

  if (isCsv) {
    return new NextResponse(buildCsv(events), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="scan-events-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    events,
    total: totalResult.count || 0,
    summary: {
      allowed: allowedResult.count || 0,
      blocked: blockedResult.count || 0,
      invalidSignatures: invalidResult.count || 0,
    },
    page,
    limit,
  });
}
