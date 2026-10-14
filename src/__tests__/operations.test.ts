import {
  buildRolloverPreview,
  recommendBulkPromotion,
  calculateStudentFeePosition,
  suggestAvailableSubstitutes,
  detectConsecutiveAbsenceAlerts,
  buildAuditDiff,
  deriveGradeWorkflowStatus,
  filterAbsenceAlertsForCooldown,
  getNextGradeWorkflowStatusActions,
  getPrevGradeWorkflowStatusActions,
} from "../lib/operations";

describe("Academic rollover logic", () => {
  test("builds a year-end rollover preview with promotions, graduations, and entry classes", () => {
    const result = buildRolloverPreview({
      academicYear: "2026",
      currentTerm: 3,
      schoolType: "primary",
      students: [
        { id: "1", status: "active", class_id: "c1", classes: { name: "P.6" } },
        { id: "2", status: "active", class_id: "c2", classes: { name: "P.7" } },
      ],
      classes: [
        { id: "c1", name: "P.6", academic_year: "2026" },
        { id: "c2", name: "P.7", academic_year: "2026" },
      ],
    });

    expect(result.nextAcademicYear).toBe("2027");
    expect(result.nextTerm).toBe(1);
    expect(result.promotableStudentIds).toEqual(["1"]);
    expect(result.graduatingStudentIds).toEqual(["2"]);
    expect(result.clonedClasses).toEqual([{ from: "P.6", to: "P.7" }]);
    expect(result.entryClassNames).toEqual(["P.1"]);
  });

  test("warns when a year rollover is attempted before term three closes", () => {
    const result = buildRolloverPreview({
      academicYear: "2026",
      currentTerm: 2,
      schoolType: "secondary",
      students: [],
      classes: [],
    });

    expect(result.warnings).toContain("Year rollover should normally happen after Term 3 closeout.");
  });
});

describe("Bulk promotion recommendations", () => {
  test("recommends promotion only for students above the passing threshold", () => {
    const result = recommendBulkPromotion([
      { studentId: "a", averageScore: 67, passingThreshold: 50, currentClassName: "P.6" },
      { studentId: "b", averageScore: 42, passingThreshold: 50, currentClassName: "P.6" },
    ]);

    expect(result).toEqual([
      expect.objectContaining({ studentId: "a", recommendedAction: "promote", targetClassName: "P.7" }),
      expect.objectContaining({ studentId: "b", recommendedAction: "repeat", targetClassName: "P.6" }),
    ]);
  });
});

describe("Financial integrity and write-offs", () => {
  test("reduces balance with bursaries and write-offs without counting fake cash income", () => {
    const result = calculateStudentFeePosition({
      feeTotal: 300000,
      openingBalance: 50000,
      payments: [{ amount_paid: 150000 }],
      adjustments: [
        { adjustment_type: "bursary", amount: 50000 },
        { adjustment_type: "write_off", amount: 150000 },
      ],
    });

    expect(result.totalPaid).toBe(150000);
    expect(result.totalCredits).toBe(200000);
    expect(result.balance).toBe(0);
    expect(result.status).toBe("written_off");
  });

  test("adds penalties into expected balances", () => {
    const result = calculateStudentFeePosition({
      feeTotal: 100000,
      payments: [],
      adjustments: [{ adjustment_type: "penalty", amount: 15000 }],
    });

    expect(result.totalExpected).toBe(115000);
    expect(result.totalPenalties).toBe(15000);
  });
});

describe("Teacher substitution suggestions", () => {
  test("recommends only teachers free in the requested slot", () => {
    const result = suggestAvailableSubstitutes({
      teachers: [
        { id: "t1", full_name: "Ms. A" },
        { id: "t2", full_name: "Mr. B" },
        { id: "t3", full_name: "Ms. C" },
      ],
      absentTeacherId: "t1",
      date: "2026-04-06",
      period: 2,
      timetable: [{ teacher_id: "t2", day_of_week: 1, period_number: 2, subject_name: "Math", class_name: "P.4" }],
      substitutions: [],
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
        teacherId: "t3",
        status: "recommended",
      }),
    );
    expect(result[1]).toEqual(
      expect.objectContaining({
        teacherId: "t2",
        status: "busy",
      }),
    );
  });
});

describe("Attendance SMS escalation", () => {
  test("flags students absent for three consecutive days for SMS alerts", () => {
    const result = detectConsecutiveAbsenceAlerts({
      students: [{ id: "s1", first_name: "Amina", last_name: "Kato", parent_phone: "0770000000" }],
      attendance: [
        { student_id: "s1", date: "2026-04-04", status: "absent" },
        { student_id: "s1", date: "2026-04-03", status: "absent" },
        { student_id: "s1", date: "2026-04-02", status: "absent" },
        { student_id: "s1", date: "2026-04-01", status: "present" },
      ],
      trigger: { threshold_days: 3, is_active: true },
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        studentId: "s1",
        consecutiveAbsentDays: 3,
        shouldSendSms: true,
      }),
    );
    expect(result[0].smsMessage).toContain("3 consecutive day(s)");
  });

  test("suppresses repeated absence alerts within the cooldown window", () => {
    const alerts = detectConsecutiveAbsenceAlerts({
      students: [{ id: "s1", first_name: "Amina", last_name: "Kato", parent_phone: "0770000000" }],
      attendance: [
        { student_id: "s1", date: "2026-04-04", status: "absent" },
        { student_id: "s1", date: "2026-04-03", status: "absent" },
        { student_id: "s1", date: "2026-04-02", status: "absent" },
      ],
      trigger: { threshold_days: 3, is_active: true },
    });

    const filtered = filterAbsenceAlertsForCooldown({
      alerts,
      triggerId: "trigger-1",
      recentLogs: [
        {
          trigger_id: "trigger-1",
          record_id: "s1",
          status: "sent",
          sent_at: new Date().toISOString(),
        },
      ],
      cooldownHours: 24,
    });

    expect(filtered).toHaveLength(0);
  });

  test("matches cron routes that have no sms_triggers row by trigger_key", () => {
    const alerts = detectConsecutiveAbsenceAlerts({
      students: [{ id: "s1", first_name: "Amina", last_name: "Kato", parent_phone: "0770000000" }],
      attendance: [
        { student_id: "s1", date: "2026-04-04", status: "absent" },
        { student_id: "s1", date: "2026-04-03", status: "absent" },
        { student_id: "s1", date: "2026-04-02", status: "absent" },
      ],
      trigger: { threshold_days: 3, is_active: true },
    });

    const filtered = filterAbsenceAlertsForCooldown({
      alerts,
      triggerId: "auto-attendance-followup",
      recentLogs: [
        {
          trigger_id: null,
          trigger_key: "auto-attendance-followup",
          record_id: "s1",
          status: "sent",
          sent_at: new Date().toISOString(),
        },
      ],
      cooldownHours: 24,
    });

    expect(filtered).toHaveLength(0);
  });

  test("does not let a different automation suppress a trigger", () => {
    const alerts = detectConsecutiveAbsenceAlerts({
      students: [{ id: "s1", first_name: "Amina", last_name: "Kato", parent_phone: "0770000000" }],
      attendance: [
        { student_id: "s1", date: "2026-04-04", status: "absent" },
        { student_id: "s1", date: "2026-04-03", status: "absent" },
        { student_id: "s1", date: "2026-04-02", status: "absent" },
      ],
      trigger: { threshold_days: 3, is_active: true },
    });

    const filtered = filterAbsenceAlertsForCooldown({
      alerts,
      triggerId: "auto-attendance-followup",
      recentLogs: [
        {
          trigger_id: null,
          trigger_key: "attendance-heartbeat",
          record_id: "s1",
          status: "sent",
          sent_at: new Date().toISOString(),
        },
        {
          trigger_id: "a0e1b2c3-0000-4000-8000-000000000001",
          trigger_key: null,
          record_id: "s1",
          status: "sent",
          sent_at: new Date().toISOString(),
        },
      ],
      cooldownHours: 24,
    });

    expect(filtered).toHaveLength(1);
  });
});

describe("Grade workflow status", () => {
  test("derives the highest workflow status across grade records", () => {
    expect(deriveGradeWorkflowStatus([{ status: "draft" }, { status: "approved" }, { status: "submitted" }])).toBe(
      "approved",
    );
  });
});

/**
 * Scenario #19: a teacher could send marks to the DOS but never take them back,
 * so a mis-keyed score stayed stuck in "sent" with no route out.
 *
 * The retreat path has to be the mirror image of the forward path. Publishing
 * is headmaster/admin/school_admin only, so *un*-publishing must be gated the
 * same way — otherwise the fix for "no way back" becomes "a teacher can
 * un-publish anyone's grades".
 */
describe("Grade workflow transitions", () => {
  describe("forward", () => {
    test("a teacher may submit a draft", () => {
      expect(getNextGradeWorkflowStatusActions("draft", "teacher")).toEqual(["submitted"]);
    });

    test("only the reviewing roles may approve", () => {
      for (const role of ["dean_of_studies", "headmaster", "admin", "school_admin"]) {
        expect(getNextGradeWorkflowStatusActions("submitted", role)).toEqual(["approved"]);
      }
      expect(getNextGradeWorkflowStatusActions("submitted", "teacher")).toEqual([]);
    });

    test("only the publishing roles may publish", () => {
      for (const role of ["headmaster", "admin", "school_admin"]) {
        expect(getNextGradeWorkflowStatusActions("approved", role)).toEqual(["published"]);
      }
      expect(getNextGradeWorkflowStatusActions("approved", "dean_of_studies")).toEqual([]);
    });
  });

  describe("backward", () => {
    test("a teacher may pull their own submission back to draft", () => {
      expect(getPrevGradeWorkflowStatusActions("submitted", "teacher")).toEqual(["draft"]);
    });

    test("a draft has nowhere to retreat to", () => {
      for (const role of ["teacher", "headmaster", "admin"]) {
        expect(getPrevGradeWorkflowStatusActions("draft", role)).toEqual([]);
      }
    });

    test("a teacher may NOT un-publish — that is the headmaster's call", () => {
      expect(getPrevGradeWorkflowStatusActions("published", "teacher")).toEqual([]);
      expect(getPrevGradeWorkflowStatusActions("published", "dean_of_studies")).toEqual([]);
    });

    test("the publishing roles may un-publish", () => {
      for (const role of ["headmaster", "admin", "school_admin"]) {
        expect(getPrevGradeWorkflowStatusActions("published", role)).toEqual(["approved"]);
      }
    });

    test("the reviewing roles may pull approval back to submitted", () => {
      for (const role of ["dean_of_studies", "headmaster", "admin", "school_admin"]) {
        expect(getPrevGradeWorkflowStatusActions("approved", role)).toEqual(["submitted"]);
      }
      expect(getPrevGradeWorkflowStatusActions("approved", "teacher")).toEqual([]);
    });

    test("an unknown role cannot move grades backwards", () => {
      expect(getPrevGradeWorkflowStatusActions("published", "wizard")).toEqual([]);
      expect(getPrevGradeWorkflowStatusActions("approved", "wizard")).toEqual([]);
    });

    test("a missing role cannot move grades backwards", () => {
      expect(getPrevGradeWorkflowStatusActions("published", undefined)).toEqual([]);
      expect(getPrevGradeWorkflowStatusActions("published", null)).toEqual([]);
    });
  });
});

describe("Audit diffs", () => {
  test("captures changed fields for sensitive edits such as grade changes", () => {
    const result = buildAuditDiff({ score: 45, updated_by: "teacher-a" }, { score: 90, updated_by: "teacher-b" });

    expect(result).toEqual([
      { field: "score", before: 45, after: 90 },
      { field: "updated_by", before: "teacher-a", after: "teacher-b" },
    ]);
  });
});
