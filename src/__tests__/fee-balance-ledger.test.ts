/**
 * Balances must not be computed from a paginated slice of payments.
 *
 * The fees screen kept one `payments` array, fetched with `.range(offset,
 * offset + limit - 1)` for the cashbook table, and then used it for every
 * balance on the page. With 62 payments recorded and 50 on screen, 12 pupils'
 * payments were simply never fetched.
 *
 * A Kikunyu pupil named Tumuhimbise Aarone had a real 100,000 payment on
 * record against a 300,000 balance. The screen showed him at UGX 0 paid, 0%,
 * "Unpaid", owing the full 300,000. His parents had paid. The bursar was told
 * the opposite.
 *
 * The failure is silent and looks exactly like a child who has not paid, so it
 * is worth a guard: the arithmetic has to come from the complete ledger, and
 * only the table pages.
 */

import { readFileSync } from "fs";
import { join } from "path";

const PAGE = readFileSync(join(process.cwd(), "src/app/dashboard/fees/page.tsx"), "utf8");
const HOOKS = readFileSync(join(process.cwd(), "src/lib/hooks/fees.ts"), "utf8");
// The paginated cashbook hook itself lives with the other offline hooks.
const OFFLINE = readFileSync(join(process.cwd(), "src/lib/offline-hooks.ts"), "utf8");

describe("fee balances use the complete payment ledger", () => {
  it("groups payments for the balances from the complete ledger, not the cashbook page", () => {
    const group = PAGE.slice(PAGE.indexOf("const paymentsByStudent"));
    const body = group.slice(0, group.indexOf("}, ["));
    expect(body).toMatch(/completePayments\.forEach/);
    expect(body).not.toMatch(/^\s*payments\.forEach/m);
  });

  it("fetches the complete ledger without the cashbook's row cap", () => {
    const hook = HOOKS.slice(HOOKS.indexOf("export function useCompleteFeePayments"));
    const body = hook.slice(0, hook.indexOf("export function useFeePayments"));
    // A range()/paging call here is the bug coming back under a new name.
    expect(body).not.toMatch(/\.range\(/);
    expect(body).not.toMatch(/\.single\(\)/);
    // Ordered by id: ordering by payment_date ties every row in a school that
    // records a whole term on one day, making page 1 arbitrary.
    expect(body).toMatch(/order\("id"/);
  });

  it("excludes soft-deleted payments from the totals", () => {
    const hook = HOOKS.slice(HOOKS.indexOf("export function useCompleteFeePayments"));
    const body = hook.slice(0, hook.indexOf("export function useFeePayments"));
    // is("deleted_at", null): a reversed payment must not sit in the balance.
    expect(body).toMatch(/deleted_at/);
  });

  it("still pages the cashbook table, which is a list rather than a total", () => {
    // The fix is not "load everything everywhere" -- a 5,000-row table nobody
    // reads is just as bad on a 2G connection.
    expect(OFFLINE).toMatch(/\.range\(offset, offset \+ limit - 1\)/);
    expect(PAGE).toMatch(/useOfflineFees\(school\?\.id, \{ limit: itemsPerPage, offset \}\)/);
  });
});
