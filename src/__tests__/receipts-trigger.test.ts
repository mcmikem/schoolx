import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Offline capture hands the parent a slip without a receipt number: the
 * per-school counter lives on the server. The comment in the fees page said
 * the receipt book "catches up when the queue replays", but no code minted the
 * number on replay -- those payments never entered the book. The fix lives in
 * the database so every insert path (fees page, /api/fee-payments, offline
 * replay, imports) is covered.
 *
 * Pinned as source: the behaviour needs a real Postgres trigger to exercise,
 * and standing one up in jsdom would test a mock rather than the migration.
 */

const sql = readFileSync(
  join(__dirname, "..", "..", "supabase", "migrations", "20261029130000_auto_receipt_for_offline_payments.sql"),
  "utf8",
);

describe("every fee payment enters the receipt book exactly once", () => {
  it("mints on insert, so offline replays are covered", () => {
    expect(sql).toMatch(/AFTER INSERT ON public\.fee_payments/);
    expect(sql).toMatch(/EXECUTE FUNCTION public\.ensure_receipt_for_payment\(\)/);
  });

  it("uses the per-school counter so two devices never share a number", () => {
    expect(sql).toContain("next_receipt_number(NEW.school_id)");
  });

  it("is idempotent: a replayed insert does not mint a second number", () => {
    expect(sql).toMatch(/IF EXISTS \(SELECT 1 FROM receipts WHERE payment_id = NEW\.id\) THEN\s+RETURN NEW;/);
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS trg_ensure_receipt_for_payment/);
  });

  it("never blocks the payment when the receipt book fails", () => {
    // Capturing the money matters more than the slip.
    expect(sql).toMatch(/WHEN OTHERS THEN[\s\S]*?RETURN NEW;/);
    expect(sql).toMatch(/NEW\.deleted_at IS NOT NULL/);
    expect(sql).toMatch(/NEW\.student_id IS NULL OR NEW\.school_id IS NULL/);
  });

  it("catches up payments recorded before the trigger existed", () => {
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM receipts rc WHERE rc\.payment_id = p\.id\)/);
  });
});
