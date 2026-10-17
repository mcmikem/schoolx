import type { FeeStructure, Student } from "@/types";
import { calculateStudentFeePosition, feeAppliesToStudent, type FinancialAdjustmentType } from "@/lib/operations";
import { computeArrearsSplit } from "@/lib/arrears";

/**
 * Report-card fee clearance.
 *
 * Ugandan law is explicit: a registered exam candidate may not be stopped from
 * sitting an exam over money. The lawful lever a school has is the REPORT CARD
 * (and transcript). This helper answers one question — "may this pupil's card be
 * released?" — from the same fee engine the bursar's screen uses, so a card is
 * never withheld (or released) on a figure that disagrees with the fees page.
 *
 * It deliberately does NOT touch exam eligibility.
 */

export interface ClearancePaymentLike {
  amount_paid: number;
}

export interface ClearanceAdjustmentLike {
  amount: number;
  adjustment_type: FinancialAdjustmentType;
}

export type ClearanceStudentLike = Pick<Student, "id" | "class_id" | "boarding_status"> &
  Partial<Pick<Student, "takes_meals" | "opening_balance">>;

export interface FeeClearanceInput {
  student: ClearanceStudentLike;
  /** The school's full fee structure; applicability is filtered here. */
  fees: FeeStructure[];
  /** Payments already scoped to this pupil. */
  payments: ClearancePaymentLike[];
  /** Adjustments already scoped to this pupil. */
  adjustments?: ClearanceAdjustmentLike[];
  academicYear?: string | number | null;
  currentTerm?: number | string | null;
}

export interface FeeClearance {
  /** Cumulative balance owed (0 when cleared). */
  balance: number;
  /** Unpaid charges brought forward from earlier terms. */
  arrears: number;
  /** Portion of the balance attributable to the current term. */
  currentDue: number;
  expected: number;
  paid: number;
  /** True when nothing is owed — cleared to receive the report card. */
  isCleared: boolean;
  status: "paid" | "partial" | "unpaid" | "written_off";
}

export function computeFeeClearance(input: FeeClearanceInput): FeeClearance {
  const applicable = input.fees.filter((fee) => feeAppliesToStudent(fee, input.student));
  const adjustments = input.adjustments || [];
  const openingBalance = Number(input.student.opening_balance || 0);
  const feeTotal = applicable.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);

  const position = calculateStudentFeePosition({
    feeTotal,
    payments: input.payments,
    adjustments,
    openingBalance,
  });

  const split = computeArrearsSplit({
    fees: applicable,
    payments: input.payments,
    adjustments,
    openingBalance,
    academicYear: input.academicYear,
    currentTerm: input.currentTerm,
  });

  return {
    balance: position.balance,
    arrears: split.arrears,
    currentDue: split.currentDue,
    expected: position.totalExpected,
    paid: position.totalPaid,
    isCleared: position.balance === 0,
    status: position.status,
  };
}
