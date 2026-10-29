import { payloadMatchesServerRow, stripLocalOnlySyncKeys } from "@/lib/sync-payload";

describe("sync payload shaping", () => {
  it("removes keys that only exist on the phone", () => {
    expect(
      stripLocalOnlySyncKeys({
        id: "row-1",
        school_id: "school-1",
        updated_at: "2026-10-29T08:00:00.000Z",
        isDemo: false,
        schoolId: "school-1",
        pending_wallet_deduction: { student_id: "st-1", amount: 500 },
        amount_paid: 1000,
      }),
    ).toEqual({
      id: "row-1",
      school_id: "school-1",
      amount_paid: 1000,
    });
  });
});

describe("has this queued write already landed?", () => {
  it("matches when the server row already holds the fields we sent", () => {
    expect(
      payloadMatchesServerRow(
        { parent_phone: "0711111111", status: "active" },
        { id: "st-1", parent_phone: "0711111111", status: "active", updated_at: "2026-10-29T09:00:00.000Z" },
      ),
    ).toBe(true);
  });

  it("does not match when any sent field differs", () => {
    expect(
      payloadMatchesServerRow(
        { parent_phone: "0711111111" },
        { id: "st-1", parent_phone: "0700000000", updated_at: "2026-10-29T09:00:00.000Z" },
      ),
    ).toBe(false);
  });

  it("does not match when the server does not have the row", () => {
    expect(payloadMatchesServerRow({ parent_phone: "0711111111" }, null)).toBe(false);
  });

  it("ignores identity and server-managed columns", () => {
    expect(
      payloadMatchesServerRow(
        { id: "st-1", parent_phone: "0711111111", updated_at: "2026-10-29T08:00:00.000Z", isDemo: false },
        { id: "st-1", parent_phone: "0711111111", updated_at: "2026-10-29T09:00:00.000Z", created_at: "x" },
      ),
    ).toBe(true);
  });

  it("treats a numeric string and a number as the same value", () => {
    expect(payloadMatchesServerRow({ amount_paid: "1000.00" }, { amount_paid: 1000 })).toBe(true);
  });

  it("never treats an empty payload as already applied", () => {
    expect(payloadMatchesServerRow({ updated_at: "2026-10-29T08:00:00.000Z" }, { id: "st-1" })).toBe(false);
  });
});
