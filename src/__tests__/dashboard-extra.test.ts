import fs from "node:fs";
import path from "node:path";
import { localMidnightIso, payloadFromRpc } from "@/lib/hooks/useDashboardExtraData";

// The dashboards used to fire eight parallel PostgREST requests per load and
// sum the rows in the browser. Two of them silently cap at 1000 rows, so a
// school past that limit computed dropout risk from a truncated sample, and
// eight TLS handshakes is a lot on 3G. dashboard_extra() returns the same
// numbers in one statement.

const fullExtra = {
  class_attendance: {
    "class-a": { present: 28, total: 30 },
    "class-b": { present: 10, total: 30 },
  },
  low_attendance_classes: 1,
  at_risk_students: [{ id: "s1", first_name: "A", last_name: "B", classes: { name: "P.4" } }],
  sms_sent_today: 8,
  sms_delivered_today: 7,
  fees_today: 250000,
  fees_week: 1500000,
  fees_term: 9000000,
  staff_on_duty: 14,
  pending_expenses: 3,
  pending_leave: 2,
  dropout_risk_count: 4,
  overdue_count: 12,
};

describe("payloadFromRpc", () => {
  it("maps every field the dashboards read", () => {
    const p = payloadFromRpc(fullExtra);
    expect(p.classAttendance).toEqual(fullExtra.class_attendance);
    expect(p.atRiskStudents).toEqual(fullExtra.at_risk_students);
    expect(p.smsStats).toEqual({ sentToday: 8, deliveryRate: 88, remaining: 0, total: 0 });
    expect(p.pendingExpenses).toBe(3);
    expect(p.pendingLeave).toBe(2);
    expect(p.feesToday).toBe(250000);
    expect(p.feesThisWeek).toBe(1500000);
    expect(p.feesThisTerm).toBe(9000000);
    expect(p.staffOnDuty).toBe(14);
    expect(p.overdueFeeCount).toBe(12);
    expect(p.lowAttendanceClasses).toBe(1);
    expect(p.dropoutRiskCount).toBe(4);
  });

  it("rounds the delivery rate and reports 0% when nothing was sent", () => {
    expect(payloadFromRpc({ ...fullExtra, sms_sent_today: 8, sms_delivered_today: 7 }).smsStats.deliveryRate).toBe(88);
    expect(payloadFromRpc({ ...fullExtra, sms_sent_today: 8, sms_delivered_today: 4 }).smsStats.deliveryRate).toBe(50);
    // Division by zero must not surface as NaN — the old code guarded this too.
    expect(payloadFromRpc({ ...fullExtra, sms_sent_today: 0, sms_delivered_today: 0 }).smsStats.deliveryRate).toBe(0);
  });

  it("treats missing figures as zero rather than undefined", () => {
    const p = payloadFromRpc({
      class_attendance: {},
      low_attendance_classes: 0,
      at_risk_students: [],
      sms_sent_today: 0,
      sms_delivered_today: 0,
      fees_today: 0,
      fees_week: 0,
      fees_term: 0,
      staff_on_duty: 0,
      pending_expenses: 0,
      pending_leave: 0,
      dropout_risk_count: 0,
      overdue_count: 0,
    } as never);
    expect(p.classAttendance).toEqual({});
    expect(p.atRiskStudents).toEqual([]);
    expect(p.overdueFeeCount).toBe(0);
    expect(p.dropoutRiskCount).toBe(0);
  });

  it("coerces numeric strings PostgREST may return for money", () => {
    const p = payloadFromRpc({ ...fullExtra, fees_today: "250000" as never, fees_term: undefined as never });
    expect(p.feesToday).toBe(250000);
    expect(p.feesThisTerm).toBe(0);
  });
});

describe("localMidnightIso", () => {
  it("is local midnight, not UTC midnight", () => {
    // 01:30 local on a machine set to UTC+3: toISOString() of `now` would be
    // 22:30 the previous day, which is exactly the shift this avoids.
    const now = new Date(2026, 9, 7, 1, 30, 0);
    const iso = localMidnightIso(now);
    const back = new Date(iso);
    expect(back.getFullYear()).toBe(2026);
    expect(back.getMonth()).toBe(9);
    expect(back.getDate()).toBe(7);
    expect(back.getHours()).toBe(0);
    expect(back.getMinutes()).toBe(0);
  });

  it("is midnight for the last hour of the year too", () => {
    const now = new Date(2026, 11, 31, 23, 59, 0);
    const back = new Date(localMidnightIso(now));
    expect(back.getFullYear()).toBe(2026);
    expect(back.getMonth()).toBe(11);
    expect(back.getDate()).toBe(31);
    expect(back.getHours()).toBe(0);
  });
});

describe("useDashboardExtraData uses the SQL function first", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "src/lib/hooks/useDashboardExtraData.ts"), "utf8");

  it("asks for one aggregate instead of eight row sets", () => {
    expect(src).toContain('supabase.rpc("dashboard_extra"');
    for (const param of [
      "p_school_id",
      "p_academic_year",
      "p_term",
      "p_today",
      "p_week_start",
      "p_term_start",
      "p_dropout_start",
      "p_today_ts",
    ]) {
      expect(src).toContain(param);
    }
  });

  it("keeps the eight-query path as a fallback when the function is missing", () => {
    expect(src).toContain("function computePayloadLegacy(");
    expect(src).toContain(
      "computePayloadLegacy(schoolId, students, feeStructure, currentTerm, academicYear, fallback)",
    );
    expect(src).toContain("rpc.error");
  });

  it("still refuses to render zeros when the roster could not be read", () => {
    expect(src).toContain("if (!students) throw new DashboardTimeoutsError();");
  });

  it("passes local dates, not UTC ones, to the function", () => {
    expect(src).toContain("getLocalDateString(now)");
    expect(src).toContain("localMidnightIso(now)");
    // The UTC idiom this replaced must not creep back into the window maths.
    expect(src).not.toContain('toISOString().split("T")[0]');
  });
});
