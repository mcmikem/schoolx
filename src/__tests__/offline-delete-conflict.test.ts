/**
 * An offline delete must not silently destroy a newer edit made on another
 * device. delete() captures the record's updated_at before removing it locally,
 * and syncSingleItem() refuses the delete (status "conflict") when the server
 * copy is newer — surfacing it in Sync Center instead of clobbering.
 */

const serverRow: { updated_at?: string } | null = { updated_at: "2026-01-02T00:00:00.000Z" };
const deleteEq = jest.fn().mockResolvedValue({ error: null });

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: serverRow }),
        }),
      }),
      delete: () => ({ eq: deleteEq }),
      update: () => ({ eq: deleteEq }),
    }),
  },
}));

import { offlineDB } from "@/lib/offline";

type Syncable = { syncSingleItem: (item: unknown) => Promise<{ status: string; reason?: string }> };
const sync = offlineDB as unknown as Syncable;

describe("offline delete conflict detection", () => {
  beforeEach(() => deleteEq.mockClear());

  it("refuses a delete when the server copy is newer", async () => {
    const result = await sync.syncSingleItem({
      table: "students",
      action: "delete",
      data: { id: "s1", updated_at: "2026-01-01T00:00:00.000Z" },
    });
    expect(result.status).toBe("conflict");
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("applies a delete when the local copy is newer", async () => {
    const result = await sync.syncSingleItem({
      table: "students",
      action: "delete",
      data: { id: "s1", updated_at: "2026-01-03T00:00:00.000Z" },
    });
    expect(result.status).toBe("synced");
    expect(deleteEq).toHaveBeenCalledWith("id", "s1");
  });

  it("applies a delete with no captured updated_at (legacy queue item)", async () => {
    const result = await sync.syncSingleItem({
      table: "students",
      action: "delete",
      data: { id: "s1" },
    });
    expect(result.status).toBe("synced");
    expect(deleteEq).toHaveBeenCalledWith("id", "s1");
  });
});
