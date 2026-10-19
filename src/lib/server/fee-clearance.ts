import type { FeeStructure, Student } from "@/types";
import { computeFeeClearance } from "@/lib/fee-clearance";

/**
 * Server-side fee clearance.
 *
 * The same clearance engine the bursar's screen uses, loaded in one pass so a
 * report card can never be released (or withheld) on a figure that disagrees
 * with the fees page. Release surfaces (report-card API, term-end emails, SMS
 * notifications) call this to decide whether a card is cleared for a parent.
 */

type SupabaseLike = { from: (table: string) => any };

export interface StudentClearance {
  studentId: string;
  balance: number;
  isCleared: boolean;
}

export interface LoadClearanceOptions {
  /** Restrict to these pupils; omit for the whole school. */
  studentIds?: string[];
  academicYear?: string | number | null;
  currentTerm?: number | string | null;
}

interface StudentRow {
  id: string;
  class_id: string;
  boarding_status: Student["boarding_status"];
  takes_meals?: boolean | null;
  opening_balance?: number | null;
}

export async function loadFeeClearanceMap(
  supabase: SupabaseLike,
  schoolId: string,
  options: LoadClearanceOptions = {},
): Promise<Map<string, StudentClearance>> {
  const map = new Map<string, StudentClearance>();
  if (!schoolId) return map;

  let studentsQuery = supabase
    .from("students")
    .select("id, class_id, boarding_status, takes_meals, opening_balance")
    .eq("school_id", schoolId)
    .eq("status", "active");
  if (options.studentIds && options.studentIds.length > 0) {
    studentsQuery = studentsQuery.in("id", options.studentIds);
  }

  let paymentsQuery = supabase
    .from("fee_payments")
    .select("student_id, amount_paid, fee_id")
    .eq("school_id", schoolId)
    .is("deleted_at", null);
  let adjustmentsQuery = supabase
    .from("fee_adjustments")
    .select("student_id, amount, adjustment_type, fee_id")
    .eq("school_id", schoolId)
    .is("deleted_at", null);
  if (options.studentIds && options.studentIds.length > 0) {
    paymentsQuery = paymentsQuery.in("student_id", options.studentIds);
    adjustmentsQuery = adjustmentsQuery.in("student_id", options.studentIds);
  }

  const [studentsRes, feesRes, paymentsRes, adjustmentsRes] = await Promise.all([
    studentsQuery,
    supabase
      .from("fee_structure")
      .select("id, name, category, class_id, boarding_status, amount, term, academic_year")
      .eq("school_id", schoolId)
      .is("deleted_at", null),
    paymentsQuery,
    adjustmentsQuery,
  ]);

  const students = (studentsRes?.data ?? []) as StudentRow[];
  const fees = (feesRes?.data ?? []) as FeeStructure[];
  const payments = (paymentsRes?.data ?? []) as Array<{
    student_id: string;
    amount_paid: number;
    fee_id?: string | null;
  }>;
  const adjustments = (adjustmentsRes?.data ?? []) as Array<{
    student_id: string;
    amount: number;
    adjustment_type: any;
    fee_id?: string | null;
  }>;

  const paymentsByStudent = new Map<string, Array<{ amount_paid: number }>>();
  for (const payment of payments) {
    if (!paymentsByStudent.has(payment.student_id)) paymentsByStudent.set(payment.student_id, []);
    paymentsByStudent.get(payment.student_id)!.push({ amount_paid: payment.amount_paid });
  }

  const adjustmentsByStudent = new Map<string, Array<{ amount: number; adjustment_type: any }>>();
  for (const adjustment of adjustments) {
    if (!adjustmentsByStudent.has(adjustment.student_id)) {
      adjustmentsByStudent.set(adjustment.student_id, []);
    }
    adjustmentsByStudent.get(adjustment.student_id)!.push({
      amount: adjustment.amount,
      adjustment_type: adjustment.adjustment_type,
    });
  }

  for (const student of students) {
    const clearance = computeFeeClearance({
      student: {
        id: student.id,
        class_id: student.class_id,
        boarding_status: student.boarding_status,
        takes_meals: student.takes_meals ?? null,
        opening_balance: student.opening_balance ?? 0,
      },
      fees,
      payments: paymentsByStudent.get(student.id) || [],
      adjustments: adjustmentsByStudent.get(student.id) || [],
      academicYear: options.academicYear,
      currentTerm: options.currentTerm,
    });

    map.set(student.id, {
      studentId: student.id,
      balance: clearance.balance,
      isCleared: clearance.isCleared,
    });
  }

  return map;
}
