import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Two offline bugs a bursar hit on the same visit.
 *
 * Recording a cash payment with no signal failed with "Fee ID is required for
 * online payments" -- the one case the rule does not apply to. Deleting a
 * payment appeared to do nothing at all.
 *
 * Pinned as source: the hook is a large stateful closure that talks to Supabase,
 * IndexedDB and the audit log, and standing that up faithfully in jsdom would
 * test the mocks rather than the behaviour.
 */

const src = readFileSync(join(__dirname, "..", "lib", "hooks", "fees.ts"), "utf8");

/** Strips comments so prose explaining a fix is never read as the defect. */
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("cash payments can be recorded offline", () => {
  it("does not demand a fee id precisely when there is no signal", () => {
    // Was `!payment.fee_id && !isOnline`, which fired offline and named online
    // in the error. fee_id is nullable and the sync inserts without it, so the
    // guard contradicted both the schema and its own message.
    expect(code).not.toMatch(/!payment\.fee_id && !isOnline/);
    expect(code).toMatch(/!payment\.fee_id && isOnline/);
  });

  it("still refuses an unattributed payment when online", () => {
    // The rule itself is unchanged; only the condition that triggered it was
    // inverted.
    expect(code).toContain("Fee ID is required for online payments");
  });

  it("queues the payment rather than dropping it", () => {
    expect(code).toMatch(/if \(!isOnline\) \{\s*const offlineSaved = await offlineDB\.save\("fee_payments"/);
    expect(code).toContain('"Queued offline fee payment"');
  });
});

describe("deleting a payment works offline", () => {
  it("has an offline branch that enqueues the delete", () => {
    // There was none: the Supabase update threw, the catch re-threw, and the
    // removal from state on the next line never ran, so the row just sat there.
    const del = code.slice(code.indexOf("const deletePayment"));
    expect(del.slice(0, 1400)).toMatch(/if \(!isOnline\) \{\s*await offlineDB\.delete\("fee_payments", id\)/);
  });

  it("removes it from the list immediately", () => {
    // Not after a sync the user cannot wait for.
    const del = code.slice(code.indexOf("const deletePayment"));
    expect(del.slice(0, 1400)).toMatch(/setPayments\(\(prev\) => prev\.filter\(\(p\) => p\.id !== id\)\)/);
  });

  it("records the offline delete as offline", () => {
    const del = code.slice(code.indexOf("const deletePayment"));
    expect(del.slice(0, 1800)).toContain("Queued offline deletion of fee payment");
  });

  it("leaves the online soft delete intact", () => {
    const del = code.slice(code.indexOf("const deletePayment"));
    expect(del).toContain('supabase.from("fee_payments").update(payload).eq("id", id)');
    expect(del).toContain('"Soft-deleted fee payment"');
  });
});

describe("the offline queue understands what it is told", () => {
  const offline = readFileSync(join(__dirname, "..", "lib", "offline.ts"), "utf8");

  it("soft-deletes fee_payments rather than destroying the row", () => {
    // The queue is reused from the online path, so it must reach the same end
    // state: a deleted_at stamp, not a hard delete.
    expect(offline).toMatch(/SOFT_DELETE_TABLES = new Set\(\[[^\]]*"fee_payments"/);
    expect(offline).toMatch(/if \(item\.action === "delete"\)/);
  });
});
