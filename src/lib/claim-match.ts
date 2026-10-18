/**
 * Auto-matching for parent payment claims.
 *
 * A parent claims "I paid UGX X by mobile money, reference Y". Every claim was
 * reviewed by hand, and the common case is that the money is already sitting in
 * `fee_payments` — the bursar typed it in, or the mobile-money import brought it
 * in. This surfaces that link so review is a glance, not an investigation.
 *
 * It is a suggestion only: a human still approves or rejects.
 */

export interface ClaimMatchClaim {
  id: string;
  student_id: string;
  amount: number;
  claimed_method?: string | null;
  reference?: string | null;
  created_at?: string | null;
}

export interface ClaimMatchPayment {
  id: string;
  student_id: string;
  amount_paid: number;
  payment_reference?: string | null;
  payment_method?: string | null;
  payment_date?: string | null;
  created_at?: string | null;
}

export type ClaimMatchKind = "duplicate_reference" | "same_student_amount" | "none";
export type ClaimMatchConfidence = "high" | "medium" | "none";

export interface ClaimMatch {
  kind: ClaimMatchKind;
  confidence: ClaimMatchConfidence;
  /** The recorded payment the claim lines up with, when there is one. */
  paymentId: string | null;
  /** The claim's money already appears to be recorded in fee_payments. */
  alreadyRecorded: boolean;
  reason: string;
}

const NONE: ClaimMatch = {
  kind: "none",
  confidence: "none",
  paymentId: null,
  alreadyRecorded: false,
  reason: "No matching payment found",
};

/** References are compared case- and punctuation-insensitively. */
export function normalizeReference(reference?: string | null): string {
  return (reference || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function amountsEqual(a: number, b: number): boolean {
  return Math.abs(Number(a) - Number(b)) < 0.01;
}

function withinDays(a?: string | null, b?: string | null, days = 7): boolean {
  if (!a || !b) return true;
  const first = new Date(a).getTime();
  const second = new Date(b).getTime();
  if (Number.isNaN(first) || Number.isNaN(second)) return true;
  return Math.abs(first - second) <= days * 24 * 60 * 60 * 1000;
}

export function matchClaimToPayments(claim: ClaimMatchClaim, payments: ClaimMatchPayment[]): ClaimMatch {
  // 1. A recorded payment carrying the same reference. fee_payments' reference
  //    is unique per school, so approving such a claim would be a duplicate.
  const claimRef = normalizeReference(claim.reference);
  if (claimRef) {
    const byRef = payments.find(
      (payment) => payment.payment_reference && normalizeReference(payment.payment_reference) === claimRef,
    );
    if (byRef) {
      return {
        kind: "duplicate_reference",
        confidence: "high",
        paymentId: byRef.id,
        alreadyRecorded: true,
        reason: "A payment with this exact reference is already recorded",
      };
    }
  }

  // 2. Same pupil, same amount, same method, close in time — the payment was
  //    almost certainly entered by hand before the parent's claim was seen.
  const sameAmount = payments.find(
    (payment) =>
      payment.student_id === claim.student_id &&
      amountsEqual(payment.amount_paid, claim.amount) &&
      (!payment.payment_method || !claim.claimed_method || payment.payment_method === claim.claimed_method) &&
      withinDays(payment.payment_date || payment.created_at, claim.created_at),
  );
  if (sameAmount) {
    return {
      kind: "same_student_amount",
      confidence: "medium",
      paymentId: sameAmount.id,
      alreadyRecorded: true,
      reason: "A payment of the same amount for this pupil is already recorded",
    };
  }

  return NONE;
}

export function matchClaimsToPayments(
  claims: ClaimMatchClaim[],
  payments: ClaimMatchPayment[],
): Map<string, ClaimMatch> {
  const map = new Map<string, ClaimMatch>();
  for (const claim of claims) {
    map.set(claim.id, matchClaimToPayments(claim, payments));
  }
  return map;
}
