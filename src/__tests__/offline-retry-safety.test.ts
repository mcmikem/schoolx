/**
 * A queued write whose response never arrived is still pending.
 *
 * The next attempt must not duplicate it, and must not park it as a conflict
 * just because the server's updated_at trigger moved past the local stamp.
 * Updates, deletes and fee payments are all covered here.
 */

const mockServerRows: Record<string, Record<string, unknown> | null> = {};
const mockUpsertCalls: Array<{ table: string; row: Record<string, unknown>; options: unknown }> = [];
const mockUpdateCalls: Array<{ table: string; row: Record<string, unknown>; id: string }> = [];
const mockDeleteCalls: Array<{ table: string; id: string }> = [];
const mockInsertCalls: Array<{ table: string; row: Record<string, unknown> }> = [];

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mockServerRows[table] ?? null, error: null }),
        }),
      }),
      insert: (row: Record<string, unknown>) => {
        mockInsertCalls.push({ table, row });
        return Promise.resolve({ error: null });
      },
      upsert: (row: Record<string, unknown>, options: unknown) => {
        mockUpsertCalls.push({ table, row, options });
        return Promise.resolve({ error: null });
      },
      update: (row: Record<string, unknown>) => ({
        eq: (_column: string, id: string) => {
          mockUpdateCalls.push({ table, row, id });
          return Promise.resolve({ error: null });
        },
      }),
      delete: () => ({
        eq: (_column: string, id: string) => {
          mockDeleteCalls.push({ table, id });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));

import { offlineDB } from "@/lib/offline";

type Syncable = { syncSingleItem: (item: unknown) => Promise<{ status: string; reason?: string }> };
const sync = offlineDB as unknown as Syncable;

function reset() {
  for (const key of Object.keys(mockServerRows)) delete mockServerRows[key];
  mockUpsertCalls.length = 0;
  mockUpdateCalls.length = 0;
  mockDeleteCalls.length = 0;
  mockInsertCalls.length = 0;
}

beforeEach(reset);

describe("updates replayed after a lost response", () => {
  it("treats a row that already holds the sent values as synced", async () => {
    mockServerRows.students = {
      id: "st-1",
      parent_phone: "0711111111",
      updated_at: "2026-10-29T09:00:00.000Z",
    };

    const result = await sync.syncSingleItem({
      table: "students",
      action: "update",
      data: {
        id: "st-1",
        parent_phone: "0711111111",
        updated_at: "2026-10-29T08:00:00.000Z",
      },
    });

    expect(result.status).toBe("synced");
    expect(mockUpdateCalls).toHaveLength(0);
  });

  it("still reports a genuine newer edit from another device", async () => {
    mockServerRows.students = {
      id: "st-1",
      parent_phone: "0700000000",
      updated_at: "2026-10-29T09:00:00.000Z",
    };

    const result = await sync.syncSingleItem({
      table: "students",
      action: "update",
      data: {
        id: "st-1",
        parent_phone: "0711111111",
        updated_at: "2026-10-29T08:00:00.000Z",
      },
    });

    expect(result.status).toBe("conflict");
    expect(mockUpdateCalls).toHaveLength(0);
  });

  it("applies the edit when the local copy is the newer one", async () => {
    mockServerRows.students = {
      id: "st-1",
      parent_phone: "0700000000",
      updated_at: "2026-10-29T07:00:00.000Z",
    };

    const result = await sync.syncSingleItem({
      table: "students",
      action: "update",
      data: {
        id: "st-1",
        parent_phone: "0711111111",
        updated_at: "2026-10-29T08:00:00.000Z",
      },
    });

    expect(result.status).toBe("synced");
    expect(mockUpdateCalls).toEqual([{ table: "students", row: { parent_phone: "0711111111" }, id: "st-1" }]);
  });
});

describe("deletes replayed after a lost response", () => {
  it("treats a hard-deleted row as already done", async () => {
    mockServerRows.students = null;

    const result = await sync.syncSingleItem({
      table: "students",
      action: "delete",
      data: { id: "st-1", updated_at: "2026-10-29T08:00:00.000Z" },
    });

    expect(result.status).toBe("synced");
    expect(mockDeleteCalls).toHaveLength(0);
  });

  it("treats an already soft-deleted payment as done", async () => {
    mockServerRows.fee_payments = {
      id: "pay-1",
      deleted_at: "2026-10-29T09:00:00.000Z",
      updated_at: "2026-10-29T09:00:00.000Z",
    };

    const result = await sync.syncSingleItem({
      table: "fee_payments",
      action: "delete",
      data: { id: "pay-1", updated_at: "2026-10-29T08:00:00.000Z" },
    });

    expect(result.status).toBe("synced");
    expect(mockUpdateCalls).toHaveLength(0);
    expect(mockDeleteCalls).toHaveLength(0);
  });

  it("still refuses a delete that races a newer edit", async () => {
    mockServerRows.students = {
      id: "st-1",
      deleted_at: null,
      updated_at: "2026-10-29T09:00:00.000Z",
    };

    const result = await sync.syncSingleItem({
      table: "students",
      action: "delete",
      data: { id: "st-1", updated_at: "2026-10-29T08:00:00.000Z" },
    });

    expect(result.status).toBe("conflict");
    expect(mockDeleteCalls).toHaveLength(0);
  });
});

describe("fee payments", () => {
  it("does not re-insert a payment that is already on the server", async () => {
    mockServerRows.fee_payments = {
      id: "pay-1",
      school_id: "school-1",
      student_id: "st-1",
      amount_paid: 1000,
      payment_method: "cash",
      payment_reference: "RCT-001",
      payment_date: "2026-10-29",
      recorded_by: "user-1",
      updated_at: "2026-10-29T09:00:00.000Z",
    };

    const result = await sync.syncSingleItem({
      table: "fee_payments",
      action: "create",
      data: {
        id: "pay-1",
        school_id: "school-1",
        student_id: "st-1",
        amount_paid: 1000,
        payment_method: "cash",
        payment_reference: "RCT-001",
        payment_date: "2026-10-29",
        recorded_by: "user-1",
        updated_at: "2026-10-29T08:00:00.000Z",
      },
    });

    expect(result.status).toBe("synced");
    expect(mockUpsertCalls).toHaveLength(0);
    expect(mockInsertCalls).toHaveLength(0);
  });

  it("upserts by the client id when the first attempt never reached the server", async () => {
    mockServerRows.fee_payments = null;

    const result = await sync.syncSingleItem({
      table: "fee_payments",
      action: "create",
      data: {
        id: "pay-1",
        school_id: "school-1",
        student_id: "st-1",
        amount_paid: 1000,
        payment_method: "cash",
        payment_reference: "RCT-001",
        payment_date: "2026-10-29",
        recorded_by: "user-1",
        updated_at: "2026-10-29T08:00:00.000Z",
      },
    });

    expect(result.status).toBe("synced");
    expect(mockUpsertCalls).toHaveLength(1);
    expect(mockUpsertCalls[0].options).toEqual({ onConflict: "id" });
    expect(mockUpsertCalls[0].row).toMatchObject({ id: "pay-1", payment_reference: "RCT-001" });
    expect(mockUpsertCalls[0].row).not.toHaveProperty("updated_at");
  });
});

describe("append-only audit replay", () => {
  it("ignores a duplicate event id instead of trying to rewrite history", async () => {
    mockServerRows.audit_log = {
      id: "evt-1",
      school_id: "school-1",
      action: "create",
      module: "fees",
    };

    const result = await sync.syncSingleItem({
      table: "audit_log",
      action: "create",
      data: {
        id: "evt-1",
        school_id: "school-1",
        user_id: "user-1",
        action: "create",
        module: "fees",
        description: "Recorded fee payment",
        updated_at: "2026-10-29T08:00:00.000Z",
      },
    });

    // The row exists but the description differs, so this is not "already
    // applied" -- it must still be written, but as an ignored duplicate.
    expect(result.status).toBe("synced");
    expect(mockUpsertCalls).toHaveLength(1);
    expect(mockUpsertCalls[0].options).toEqual({ onConflict: "id", ignoreDuplicates: true });
  });
});
