/**
 * @jest-environment node
 */
/**
 * Re-derive every pupil's fee position from the database and compare it with
 * what the screens would show.
 *
 * This exists because the arithmetic has been wrong in two distinct ways, and
 * neither was caught by the unit tests:
 *
 *   - Balances were computed from one page of payments. 12 of 62 payments were
 *     never fetched, so pupils who had paid in full read as owing everything.
 *     No test could see it: the tests only ever knew about the numbers they
 *     were given.
 *   - Per-fee allocation disagreed with the headline figure, because the
 *     breakdown and the balance came from different inputs.
 *
 * So this runs against the live database, through the same predicates the app
 * uses -- feeAppliesToStudent and calculateStudentFeePosition, imported rather
 * than reimplemented, because a copy would drift from the original and quietly
 * check the wrong thing.
 *
 * Skipped when credentials are absent, so it never blocks an offline run.
 *
 * Usage:  npm run check:ledger
 */

import { readFileSync } from "fs";
import { join } from "path";

import { calculateStudentFeePosition, feeAppliesToStudent } from "@/lib/operations";
import { allocateAcrossFees, isCreditAdjustment } from "@/lib/fee-allocation";

/** Rows the fees screen must never silently drop. */
const CASHBOOK_PAGE_SIZE = 50;

function loadEnv(): Record<string, string> {
  try {
    const env: Record<string, string> = {};
    for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return env;
  } catch {
    return {};
  }
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const live = Boolean(url && key);

const describeIfLive = live ? describe : describe.skip;

describeIfLive("fee ledger consistency (live)", () => {
  let createClient: typeof import("@supabase/supabase-js").createClient;
  let client: ReturnType<typeof import("@supabase/supabase-js").createClient>;

  beforeAll(async () => {
    ({ createClient } = await import("@supabase/supabase-js"));
    client = createClient(url!, key!, { auth: { persistSession: false } });
  }, 30000);

  async function schools(): Promise<Array<{ id: string; name: string }>> {
    const { data } = await client.from("schools").select("id, name").order("id");
    return (data ?? []) as Array<{ id: string; name: string }>;
  }

  it("reconciles every pupil's balance against the stored ledger", async () => {
    const problems: string[] = [];
    const misattributed: string[] = [];

    for (const school of await schools()) {
      const [studentsRes, feesRes, paymentsRes, adjustmentsRes] = await Promise.all([
        client.from("students").select("*").eq("school_id", school.id),
        client.from("fee_structure").select("*").eq("school_id", school.id).is("deleted_at", null),
        client.from("fee_payments").select("*").eq("school_id", school.id).is("deleted_at", null),
        client.from("fee_adjustments").select("*").eq("school_id", school.id).is("deleted_at", null),
      ]);

      // Untyped Supabase: select("*") with no generated schema types, so these
      // come back as Record<string, unknown>. Named here so the checks below
      // read as arithmetic rather than as casting.
      const students = (studentsRes.data ?? []) as Array<Record<string, any>>;
      const fees = (feesRes.data ?? []) as Array<Record<string, any>>;
      const payments = (paymentsRes.data ?? []) as Array<Record<string, any>>;
      const adjustments = (adjustmentsRes.data ?? []) as Array<Record<string, any>>;

      for (const student of students) {
        const applicable = fees.filter((fee) => feeAppliesToStudent(fee as never, student as never));
        const mine = payments.filter((p) => p.student_id === student.id);
        const myAdjustments = adjustments.filter((a) => a.student_id === student.id);

        const position = calculateStudentFeePosition({
          feeTotal: applicable.reduce((sum, f) => sum + Number(f.amount || 0), 0),
          payments: mine as never,
          adjustments: myAdjustments as never,
          openingBalance: Number(student.opening_balance || 0),
        });

        // 1. The balance must equal the arithmetic, not merely resemble it.
        const recomputed = Math.max(0, position.totalExpected - position.totalPaid);
        if (recomputed !== position.balance) {
          problems.push(`${school.name} / ${student.student_number}: balance ${position.balance} != ${recomputed}`);
        }

        // 2. Paid must equal the sum of that pupil's live payments. A shortfall
        //    here is the pagination bug: money received but not counted.
        const paidFromRows = mine.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
        if (Math.abs(paidFromRows - position.totalPaid) > 0.5) {
          problems.push(
            `${school.name} / ${student.student_number}: shows ${position.totalPaid} paid but the ledger holds ${paidFromRows}`,
          );
        }

        // 3. The per-fee "X left" lines must add up to the headline balance.
        //    That is the invariant the bursar relies on when they read the two
        //    and expect one number. Opening balances and penalties sit outside
        //    any fee line, so they are accounted for rather than ignored.
        const allocated = allocateAcrossFees(
          applicable.map((f) => ({
            id: f.id as string,
            name: f.name as string,
            category: (f.category ?? null) as string | null,
            term: (f.term ?? null) as 1 | 2 | 3 | null,
            amount: Number(f.amount || 0),
          })),
          mine.map((p) => ({
            id: p.id as string,
            amount_paid: Number(p.amount_paid || 0),
            fee_id: (p.fee_id ?? null) as string | null,
          })),
          myAdjustments.map((a) => ({
            id: a.id as string,
            adjustment_type: a.adjustment_type as string,
            amount: Number(a.amount || 0),
            fee_id: (a.fee_id ?? null) as string | null,
          })),
        );
        const stillOwed = allocated.reduce((sum, f) => sum + f.remaining, 0);
        const outsideFeeLines = Number(student.opening_balance || 0) + position.totalPenalties;
        const expectedStillOwed = Math.max(0, position.balance - outsideFeeLines);
        if (Math.abs(stillOwed - expectedStillOwed) > 0.5) {
          problems.push(
            `${school.name} / ${student.student_number}: fee lines leave ${stillOwed} owing but the balance says ${position.balance}`,
          );
        }

        // 4. A payment recorded against a fee this pupil is not charged. The
        //    money is still counted and the balance is still right, so this is
        //    not an arithmetic fault -- it means the bursar picked the wrong
        //    line, and the breakdown has nowhere honest to show it. Reported,
        //    not failed: it is a data-quality finding, not a lost shilling.
        const knownFeeIds = new Set(applicable.map((f) => f.id as string));
        for (const payment of mine) {
          if (payment.fee_id && !knownFeeIds.has(payment.fee_id)) {
            misattributed.push(
              `${school.name} / ${student.student_number}: ${Number(payment.amount_paid || 0)} recorded against a fee this pupil is not charged`,
            );
          }
        }
      }

      // 4. A school whose payments exceed one page is the exact condition that
      //    hid 12 payments. Report it as a standing risk, not a failure.
      if (payments.length > CASHBOOK_PAGE_SIZE) {
        // eslint-disable-next-line no-console
        console.warn(
          `  note: ${school.name} has ${payments.length} payments (> ${CASHBOOK_PAGE_SIZE}). ` +
            `Balances must use the complete ledger, never the cashbook page.`,
        );
      }
    }

    if (misattributed.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `\n${misattributed.length} payment(s) recorded against a fee the pupil is not charged:\n  ${misattributed.slice(0, 20).join("\n  ")}`,
      );
    }
    if (problems.length) {
      // eslint-disable-next-line no-console
      console.error(`\n${problems.length} ledger problem(s):\n  ${problems.slice(0, 40).join("\n  ")}`);
    }
    expect(problems).toEqual([]);
  }, 180000);

  it("has no payments pointing at pupils who are not on the roll", async () => {
    const orphans: string[] = [];
    for (const school of await schools()) {
      const [{ data: studentsRaw }, { data: paymentsRaw }] = await Promise.all([
        client.from("students").select("id").eq("school_id", school.id),
        client.from("fee_payments").select("id, student_id").eq("school_id", school.id).is("deleted_at", null),
      ]);
      const known = new Set(((studentsRaw ?? []) as Array<{ id: string }>).map((s) => s.id));
      for (const payment of (paymentsRaw ?? []) as Array<{ id: string; student_id: string }>) {
        if (!known.has(payment.student_id)) orphans.push(`${school.name}: payment ${payment.id}`);
      }
    }
    expect(orphans).toEqual([]);
  }, 180000);

  it("has no pupil billed a fee nobody can be charged for", async () => {
    // A meal charged to a pupil not marked as eating, or a joining charge on a
    // pupil already on the roll, is money the school will not collect.
    const wrong: string[] = [];
    for (const school of await schools()) {
      const [{ data: students }, { data: fees }] = await Promise.all([
        client.from("students").select("*").eq("school_id", school.id),
        client.from("fee_structure").select("*").eq("school_id", school.id).is("deleted_at", null),
      ]);
      for (const student of (students ?? []) as Array<Record<string, any>>) {
        for (const fee of (fees ?? []) as Array<Record<string, any>>) {
          // Only fees this pupil IS charged are in scope. A fee excluded for an
          // unrelated reason -- another class, or boarding against a day pupil
          // -- is working as intended and saying otherwise would bury the real
          // findings under thousands of lines.
          if (!feeAppliesToStudent(fee as never, student as never)) continue;

          const text = `${fee.category ?? ""} ${fee.name ?? ""}`;
          const isMeal = /\b(meal|meals|lunch|breakfast|supper|canteen|food)\b/i.test(text);
          const isEntry = /\b(registr|admission|enrol|intake|joining|entry|uniform)/i.test(text);

          if (isMeal && student.takes_meals !== true) {
            wrong.push(`${school.name}: ${student.student_number} charged ${fee.name} but is not marked as eating`);
          }
          if (isEntry && student.is_new_admission !== true) {
            wrong.push(
              `${school.name}: ${student.student_number} charged ${fee.name} but is not marked as a new admission`,
            );
          }
        }
      }
    }
    expect(wrong).toEqual([]);
  }, 180000);

  it("leaves isCreditAdjustment exported and consistent with the engine", async () => {
    // The consistency check above leans on this predicate, so it is asserted
    // here rather than assumed.
    expect(isCreditAdjustment("discount")).toBe(true);
    expect(isCreditAdjustment("penalty")).toBe(false);
  });
});
