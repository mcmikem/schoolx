/**
 * Replay must not send local-only keys to PostgREST.
 *
 * offlineDB.save() stamps every row with updated_at and callers pass client
 * flags alongside it, but most tables (behavior_logs, homework, events,
 * fee_payments…) have no updated_at column. The old replay inserted the row
 * verbatim, PostgREST answered PGRST204 "Could not find the 'updated_at'
 * column", and the queued write retried forever.
 */

const insertedRows: Array<{ table: string; row: Record<string, unknown> }> = [];
const upsertedRows: Array<{ table: string; row: Record<string, unknown>; options: unknown }> = [];
const updatedRows: Array<{ table: string; row: Record<string, unknown> }> = [];

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null }),
        }),
      }),
      insert: (row: Record<string, unknown>) => {
        insertedRows.push({ table, row });
        return Promise.resolve({ error: null });
      },
      upsert: (row: Record<string, unknown>, options: unknown) => {
        upsertedRows.push({ table, row, options });
        return Promise.resolve({ error: null });
      },
      update: (row: Record<string, unknown>) => ({
        eq: () => {
          updatedRows.push({ table, row });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  },
}));

import { offlineDB } from "@/lib/offline";

type Syncable = { syncSingleItem: (item: unknown) => Promise<{ status: string; reason?: string }> };
const sync = offlineDB as unknown as Syncable;

describe("offline replay strips local-only keys", () => {
  beforeEach(() => {
    insertedRows.length = 0;
    upsertedRows.length = 0;
    updatedRows.length = 0;
  });

  it("upserts a behavior_logs row by its client UUID without updated_at", async () => {
    const item = {
      table: "behavior_logs",
      action: "create",
      data: {
        id: "b1",
        school_id: "school-1",
        student_id: "st-1",
        description: "Late for class",
        updated_at: "2026-10-26T08:00:00.000Z",
      },
    };
    const result = await sync.syncSingleItem(item);
    expect(result.status).toBe("synced");
    expect(insertedRows).toHaveLength(0);
    expect(upsertedRows).toHaveLength(1);
    expect(upsertedRows[0]).toEqual({
      table: "behavior_logs",
      options: { onConflict: "id" },
      row: {
        id: "b1",
        school_id: "school-1",
        student_id: "st-1",
        description: "Late for class",
      },
    });

    // A lost response leaves the queue pending; replaying the same item must
    // target the same server row instead of producing a duplicate-key failure.
    expect((await sync.syncSingleItem(item)).status).toBe("synced");
    expect(upsertedRows).toHaveLength(2);
    expect(upsertedRows[1].row.id).toBe("b1");
  });

  it("updates a students row without updated_at but keeps the payload", async () => {
    const result = await sync.syncSingleItem({
      table: "students",
      action: "update",
      data: {
        id: "st-1",
        status: "completed",
        updated_at: "2026-10-26T08:00:00.000Z",
        isDemo: false,
      },
    });
    expect(result.status).toBe("synced");
    expect(updatedRows).toHaveLength(1);
    expect(updatedRows[0].row).toEqual({ status: "completed" });
  });
});
