import { buildAuditInsertRow, AUDIT_ACTIONS } from "@/lib/server/audit-sync";

describe("buildAuditInsertRow", () => {
  const identity = {
    schoolId: "school-1",
    userId: "user-1",
    userName: "Real Teacher",
  };

  const validData = {
    school_id: "school-1",
    user_id: "forged-user",
    user_name: "Someone Else",
    action: "create",
    module: "attendance",
    description: "Marked present",
    record_id: "student-1",
    created_at: "2026-09-01T10:00:00.000Z",
  };

  it("takes identity from the session, never from the client payload", () => {
    const result = buildAuditInsertRow({ data: validData, ...identity });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.user_id).toBe("user-1");
    expect(result.row.user_name).toBe("Real Teacher");
    expect(result.row.school_id).toBe("school-1");
  });

  it("keeps the client's description of what happened", () => {
    const result = buildAuditInsertRow({ data: validData, ...identity });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.module).toBe("attendance");
    expect(result.row.description).toBe("Marked present");
    expect(result.row.record_id).toBe("student-1");
  });

  it("preserves the offline timestamp when it is a real date", () => {
    const result = buildAuditInsertRow({ data: validData, ...identity });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.created_at).toBe("2026-09-01T10:00:00.000Z");
  });

  it("falls back to now when the timestamp is unusable", () => {
    const result = buildAuditInsertRow({
      data: { ...validData, created_at: "not-a-date" },
      ...identity,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Number.isNaN(new Date(result.row.created_at).getTime())).toBe(false);
  });

  it.each(AUDIT_ACTIONS)("accepts the %s action", (action) => {
    const result = buildAuditInsertRow({ data: { ...validData, action }, ...identity });
    expect(result.ok).toBe(true);
  });

  it("rejects an action outside the table's check constraint", () => {
    const result = buildAuditInsertRow({
      data: { ...validData, action: "drop_table" },
      ...identity,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Invalid audit action");
  });

  it("rejects a missing module rather than writing a null into a NOT NULL column", () => {
    const result = buildAuditInsertRow({ data: { ...validData, module: undefined }, ...identity });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Missing audit module");
  });

  it("truncates oversized text so a hostile payload cannot bloat the trail", () => {
    const result = buildAuditInsertRow({
      data: { ...validData, module: "m".repeat(500), description: "d".repeat(2000) },
      ...identity,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.module).toHaveLength(100);
    expect(result.row.description).toHaveLength(500);
  });

  it("discards jsonb columns that are not plain objects", () => {
    const result = buildAuditInsertRow({
      data: { ...validData, old_value: "a string", new_value: [1, 2, 3] },
      ...identity,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.old_value).toBeNull();
    expect(result.row.new_value).toBeNull();
  });

  it("keeps object diffs for the audit record", () => {
    const result = buildAuditInsertRow({
      data: { ...validData, old_value: { score: 40 }, new_value: { score: 80 } },
      ...identity,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.old_value).toEqual({ score: 40 });
    expect(result.row.new_value).toEqual({ score: 80 });
  });

  it("tolerates a profile with no name and no id", () => {
    const result = buildAuditInsertRow({
      data: validData,
      schoolId: "school-1",
      userId: null,
      userName: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.user_id).toBeNull();
    expect(result.row.user_name).toBeNull();
  });
});
