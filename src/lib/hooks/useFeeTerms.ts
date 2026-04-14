import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

interface FeeTerm {
  id: string;
  school_id: string;
  name: string;
  code: string;
  description: string | null;
  term_type: "fixed_days" | "fixed_date" | "installments";
  total_amount: number;
  discount_percentage: number;
  no_of_days: number | null;
  day_type: "before" | "after" | null;
  is_active: boolean;
  academic_year: string;
  created_at: string;
  updated_at: string;
  lines?: FeeTermLine[];
}

interface FeeTermLine {
  id: string;
  term_id: string;
  installment_number: number;
  due_days: number | null;
  due_date: string | null;
  amount_percentage: number;
  amount: number;
  is_optional: boolean;
}

interface StudentFeeTerm {
  id: string;
  student_id: string;
  fee_term_id: string;
  class_id: string | null;
  academic_year: string;
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  amount_paid: number;
  balance: number;
  start_date: string | null;
  status: "active" | "completed" | "cancelled";
  student?: {
    first_name: string;
    last_name: string;
    student_number: string;
  };
  fee_term?: FeeTerm;
}

interface FeePayment {
  id: string;
  student_fee_term_id: string;
  installment_number: number | null;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  transaction_reference: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export function useFeeTerms() {
  const { school } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [feeTerms, setFeeTerms] = useState<FeeTerm[]>([]);

  const fetchFeeTerms = useCallback(
    async (academicYear?: string) => {
      if (!school?.id) return;

      setLoading(true);
      try {
        let query = supabase
          .from("fee_terms")
          .select("*, fee_term_lines(*)")
          .eq("school_id", school.id)
          .order("name");

        if (academicYear) {
          query = query.eq("academic_year", academicYear);
        }

        const { data, error } = await query;

        if (error) throw error;
        setFeeTerms(data || []);
      } catch (err) {
        console.error("Error fetching fee terms:", err);
        toast.error("Failed to load fee terms");
      } finally {
        setLoading(false);
      }
    },
    [school?.id, toast],
  );

  const createFeeTerm = useCallback(
    async (term: Partial<FeeTerm>, lines: Partial<FeeTermLine>[]) => {
      if (!school?.id) return null;

      try {
        const { data: newTerm, error: termError } = await supabase
          .from("fee_terms")
          .insert({
            school_id: school.id,
            name: term.name,
            code: term.code,
            description: term.description,
            term_type: term.term_type || "installments",
            total_amount: term.total_amount,
            discount_percentage: term.discount_percentage || 0,
            no_of_days: term.no_of_days,
            day_type: term.day_type,
            is_active: term.is_active ?? true,
            academic_year: term.academic_year,
          })
          .select()
          .single();

        if (termError) throw termError;

        if (lines.length > 0 && newTerm) {
          const { error: linesError } = await supabase
            .from("fee_term_lines")
            .insert(
              lines.map((line, i) => ({
                term_id: newTerm.id,
                installment_number: line.installment_number || i + 1,
                due_days: line.due_days,
                due_date: line.due_date,
                amount_percentage: line.amount_percentage,
                is_optional: line.is_optional || false,
              })),
            );

          if (linesError) throw linesError;
        }

        await fetchFeeTerms();
        toast.success("Fee term created");
        return newTerm;
      } catch (err) {
        console.error("Error creating fee term:", err);
        toast.error("Failed to create fee term");
        return null;
      }
    },
    [school?.id, toast, fetchFeeTerms],
  );

  return {
    feeTerms,
    loading,
    fetchFeeTerms,
    createFeeTerm,
  };
}

export function useStudentFeeTerms(studentId?: string) {
  const { school } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [studentFeeTerms, setStudentFeeTerms] = useState<StudentFeeTerm[]>([]);

  const fetchStudentFeeTerms = useCallback(async () => {
    if (!school?.id) return;

    setLoading(true);
    try {
      let query = supabase
        .from("student_fee_terms")
        .select(
          "*, student:students(first_name, last_name, student_number), fee_term:fee_terms(*), class:classes(name)",
        )
        .eq("school_id", school.id);

      if (studentId) {
        query = query.eq("student_id", studentId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setStudentFeeTerms(data || []);
    } catch (err) {
      console.error("Error fetching student fee terms:", err);
      toast.error("Failed to load student fee terms");
    } finally {
      setLoading(false);
    }
  }, [school?.id, studentId, toast]);

  const assignFeeTermToStudent = useCallback(
    async (assignment: {
      student_id: string;
      fee_term_id: string;
      class_id?: string;
      academic_year: string;
    }) => {
      if (!school?.id) return null;

      try {
        const { data: ftData, error: termError } = await supabase
          .from("fee_terms")
          .select("total_amount, discount_percentage")
          .eq("id", assignment.fee_term_id)
          .single();

        if (termError || !ftData)
          throw termError || new Error("Fee term not found");

        const discountAmount =
          (ftData.total_amount * (ftData.discount_percentage || 0)) / 100;
        const finalAmount = ftData.total_amount - discountAmount;

        const { data, error } = await supabase
          .from("student_fee_terms")
          .insert({
            school_id: school.id,
            student_id: assignment.student_id,
            fee_term_id: assignment.fee_term_id,
            class_id: assignment.class_id,
            academic_year: assignment.academic_year,
            total_amount: ftData.total_amount,
            discount_amount: discountAmount,
            final_amount: finalAmount,
          })
          .select()
          .single();

        if (error) throw error;
        await fetchStudentFeeTerms();
        toast.success("Fee term assigned to student");
        return data;
      } catch (err) {
        console.error("Error assigning fee term:", err);
        toast.error("Failed to assign fee term");
        return null;
      }
    },
    [school?.id, toast, fetchStudentFeeTerms],
  );

  const recordPayment = useCallback(
    async (payment: {
      student_fee_term_id: string;
      amount: number;
      payment_date: string;
      payment_method?: string;
      transaction_reference?: string;
      notes?: string;
    }) => {
      try {
        const { data: paymentData, error: paymentError } = await supabase
          .from("fee_payments")
          .insert({
            student_fee_term_id: payment.student_fee_term_id,
            amount: payment.amount,
            payment_date: payment.payment_date,
            payment_method: payment.payment_method,
            transaction_reference: payment.transaction_reference,
            notes: payment.notes,
          })
          .select()
          .single();

        if (paymentError) throw paymentError;

        const { data: sftData } = await supabase
          .from("student_fee_terms")
          .select("amount_paid, final_amount")
          .eq("id", payment.student_fee_term_id)
          .single();

        if (sftData) {
          const newPaid = (sftData.amount_paid || 0) + payment.amount;
          const newStat =
            newPaid >= (sftData.final_amount || 0) ? "completed" : "active";

          await supabase
            .from("student_fee_terms")
            .update({ amount_paid: newPaid, status: newStat })
            .eq("id", payment.student_fee_term_id);
        }

        await fetchStudentFeeTerms();
        toast.success("Payment recorded");
        return paymentData;
      } catch (err) {
        console.error("Error recording payment:", err);
        toast.error("Failed to record payment");
        return null;
      }
    },
    [toast, fetchStudentFeeTerms],
  );

  return {
    studentFeeTerms,
    loading,
    fetchStudentFeeTerms,
    assignFeeTermToStudent,
    recordPayment,
  };
}

export default useFeeTerms;
