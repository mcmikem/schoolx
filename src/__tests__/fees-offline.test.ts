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

import { translateFeePaymentError } from "@/lib/hooks/fees";

const src = readFileSync(join(__dirname, "..", "lib", "hooks", "fees.ts"), "utf8");

/** Strips comments so prose explaining a fix is never read as the defect. */
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("payments can be recorded, on any connection", () => {
  it("no longer demands a fee id at all", () => {
    // This guard blocked EVERY payment, not just offline ones. The normaliser
    // strips fee_id, so `!payment.fee_id` was permanently true, and the form
    // has no fee picker for a bursar to satisfy it with.
    expect(code).not.toContain("Fee ID is required for online payments");
    expect(code).not.toMatch(/!payment\.fee_id &&/);
  });

  it("records why, so it is not reinstated by accident", () => {
    expect(src).toMatch(/normalizePaymentInput\(\) returns a fixed set of fields/);
    expect(src).toMatch(/EVERY payment/);
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

describe("a duplicate payment reference explains itself", () => {
  it("checks the reference before attempting the insert", () => {
    // findRecentDuplicatePayment matches pupil + amount + method + a time
    // window, so a repeated reference sailed straight through it.
    expect(code).toMatch(/\.eq\("payment_reference", reference\)/);
    expect(code).toMatch(/is already on a payment/);
  });

  it("scopes that check to the school", () => {
    expect(code).toMatch(/\.eq\("school_id", querySchoolId\)/);
  });

  it("translates the constraint violation instead of leaking it", () => {
    // PostgREST passes Postgres text straight through, so an index name was
    // arriving on the payment form in place of an instruction.
    expect(code).toContain("translateFeePaymentError");
  });
});

describe("bursars can correct a payment", () => {
  it("is not blocked in the UI", () => {
    // A guard here refused bursars and pointed them at the headmaster, while the
    // database was already allowing it. I checked RLS and reported the
    // permission was fine; it was this line that stopped them.
    const page = readFileSync(join(__dirname, "..", "..", "src/app/dashboard/fees/page.tsx"), "utf8");
    expect(page).not.toContain("Bursars cannot delete payments");
  });

  it("is not blocked by a hard 403 in the API", () => {
    // The 403 sat directly under an allowedRoles check that already listed
    // "bursar", making that check decorative for the one role it mattered for.
    const route = readFileSync(join(__dirname, "..", "..", "src/app/api/fee-payments/[id]/route.ts"), "utf8");
    expect(route).not.toContain("Bursars cannot delete payments");
  });

  it("still goes through the confirm dialog and undo", () => {
    const page = readFileSync(join(__dirname, "..", "..", "src/app/dashboard/fees/page.tsx"), "utf8");
    const handler = page.slice(page.indexOf("const handleDeletePayment"));
    expect(handler.slice(0, 800)).toContain('setConfirmDelete({ type: "payment"');
  });
});

describe("translateFeePaymentError", () => {
  it("turns a unique violation into something actionable", () => {
    const err = translateFeePaymentError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "idx_fee_payments_reference"',
    });
    expect(err.message).toMatch(/already been used/i);
    expect(err.message).not.toMatch(/idx_fee_payments_reference/);
  });

  it("covers other unique violations without leaking the index name", () => {
    const err = translateFeePaymentError({ code: "23505", message: '... constraint "idx_something_else"' });
    expect(err.message).toMatch(/already been recorded/i);
    expect(err.message).not.toMatch(/idx_/);
  });

  it("passes other errors through unchanged", () => {
    const original = new Error("Saving the payment timed out.");
    expect(translateFeePaymentError(original).message).toBe("Saving the payment timed out.");
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
