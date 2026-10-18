import { normalizeFeeCategory } from "@/lib/import/fees";

/**
 * UNEB exam-fee quarantine.
 *
 * Money collected from pupils for UNEB registration is not school income: it is
 * a liability the school holds until it is remitted. Mixing it into the general
 * fund is what gets headteachers arrested, so it is reported separately as
 * collected vs invoiced vs remitted.
 *
 * This is a report, never an exam gate: a pupil may always sit the exam.
 */

export type UnebRemittanceStatus = "open" | "part_remitted" | "remitted" | "closed";

export interface UnebFeeLike {
  id?: string | null;
  name?: string | null;
  category?: string | null;
}

export interface UnebPaymentLike {
  amount_paid: number;
  fee_id?: string | null;
}

export interface UnebRemittanceLike {
  amount_invoiced?: number | null;
  amount_collected?: number | null;
  amount_remitted?: number | null;
  status?: string | null;
}

export interface UnebQuarantineSummary {
  /** UNEB/exam money actually collected from pupils (attributed by fee line). */
  collectedFromPupils: number;
  /** Collected total recorded by hand on remittance rows. */
  recordedCollected: number;
  /** The larger of the two collection sources, used for the held figure. */
  collected: number;
  /** Amount UNEB invoiced. */
  invoiced: number;
  /** Amount already sent to UNEB. */
  remitted: number;
  /** Money held that is still owed to UNEB: max(0, collected − remitted). */
  held: number;
  /** Still to collect from pupils to cover the UNEB invoice. */
  outstandingToCollect: number;
  /** True when any remittance ledger row exists. */
  hasRecords: boolean;
}

/** A fee line is UNEB money when its category is UNEB or a general exam fee. */
export function isUnebFeeCategory(category?: string | null): boolean {
  const normalized = normalizeFeeCategory(category ?? "");
  return normalized === "uneb" || normalized === "exam";
}

export function summarizeUnebQuarantine(input: {
  fees: UnebFeeLike[];
  payments: UnebPaymentLike[];
  remittances?: UnebRemittanceLike[];
}): UnebQuarantineSummary {
  const unebFeeIds = new Set(
    input.fees
      .filter((fee) => isUnebFeeCategory(fee.category))
      .map((fee) => fee.id)
      .filter((id): id is string => Boolean(id)),
  );

  // Only payments that name a UNEB fee line can be attributed. A bursar who
  // records payments without a fee_id shows up under recordedCollected instead.
  const collectedFromPupils = input.payments
    .filter((payment) => payment.fee_id && unebFeeIds.has(payment.fee_id))
    .reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);

  const remittances = input.remittances || [];
  const recordedCollected = remittances.reduce((sum, row) => sum + Number(row.amount_collected || 0), 0);
  const invoiced = remittances.reduce((sum, row) => sum + Number(row.amount_invoiced || 0), 0);
  const remitted = remittances.reduce((sum, row) => sum + Number(row.amount_remitted || 0), 0);

  const collected = Math.max(collectedFromPupils, recordedCollected);

  return {
    collectedFromPupils,
    recordedCollected,
    collected,
    invoiced,
    remitted,
    held: Math.max(0, collected - remitted),
    outstandingToCollect: Math.max(0, invoiced - collected),
    hasRecords: remittances.length > 0,
  };
}
