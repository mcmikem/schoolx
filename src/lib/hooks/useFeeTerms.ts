import { useState, useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { logger } from "@/lib/logger";
import { queueMutation, isOnline } from "@/lib/offline-db";
import { generateWhatsAppShareLink } from "@/lib/whatsapp";
import { useSupabaseQuery } from "@/lib/hooks/useSupabaseQuery";
import { withTimeout } from "./utils";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

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
  const queryClient = useQueryClient();
  const [localFeeTerms, setLocalFeeTerms] = useState<FeeTerm[]>([]);

  const cacheKey = `/api/fee-terms/${school?.id}`;
  const cacheParams = useMemo<Record<string, unknown>>(() => ({}), []);

  const {
    data: feeTerms = [],
    isLoading: loading,
    isStale,
  } = useSupabaseQuery<FeeTerm[]>({
    queryKey: ["feeTerms", school?.id],
    cacheEndpoint: cacheKey,
    cacheParams,
    enabled: Boolean(school?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_terms")
        .select("*, fee_term_lines(*)")
        .eq("school_id", school?.id)
        .order("name");

      if (error) throw error;
      return data || [];
    },
    onSuccess: (data) => {
      setLocalFeeTerms(data);
    },
  });

  const createFeeTerm = useCallback(
    async (term: Partial<FeeTerm>, lines: Partial<FeeTermLine>[]) => {
      if (!school?.id) return null;

      if (!isOnline()) {
        const tempId = `temp-${Date.now()}`;
        const offlineTerm: FeeTerm = {
          id: tempId,
          school_id: school.id,
          name: term.name || "",
          code: term.code || "",
          description: term.description || null,
          term_type: term.term_type || "installments",
          total_amount: term.total_amount || 0,
          discount_percentage: term.discount_percentage || 0,
          no_of_days: term.no_of_days || null,
          day_type: term.day_type || null,
          is_active: term.is_active ?? true,
          academic_year: term.academic_year || "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          lines: lines.map((l, i) => ({
            id: `temp-line-${i}`,
            term_id: tempId,
            installment_number: l.installment_number || i + 1,
            due_days: l.due_days || null,
            due_date: l.due_date || null,
            amount_percentage: l.amount_percentage || 0,
            amount: l.amount_percentage ? (term.total_amount || 0) * (l.amount_percentage / 100) : 0,
            is_optional: l.is_optional || false,
          })),
        };
        setLocalFeeTerms((prev) => [...prev, offlineTerm]);
        await queueMutation({
          endpoint: "fee_terms",
          method: "POST",
          body: { term, lines, schoolId: school.id },
        });
        toast.success("Fee term saved (offline)");
        return offlineTerm;
      }

      try {
        const { data: newTerm, error: termError } = await withTimeout(
          supabase
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
            .single(),
          15000,
          {
            data: null,
            error: { message: "Fee term creation timed out", name: "TimeoutError", details: "", hint: "", code: "" },
          } as unknown as PostgrestSingleResponse<never>,
        );

        if (termError) throw termError;

        if (lines.length > 0 && newTerm) {
          const { error: linesError } = await withTimeout(
            supabase.from("fee_term_lines").insert(
              lines.map((line, i) => ({
                term_id: newTerm.id,
                installment_number: line.installment_number || i + 1,
                due_days: line.due_days,
                due_date: line.due_date,
                amount_percentage: line.amount_percentage,
                is_optional: line.is_optional || false,
              })),
            ),
            15000,
            {
              error: { message: "Fee term lines timed out", name: "TimeoutError", details: "", hint: "", code: "" },
            } as unknown as PostgrestSingleResponse<never>,
          );

          if (linesError) throw linesError;
        }

        await queryClient.invalidateQueries({ queryKey: ["feeTerms", school.id] });
        toast.success("Fee term created");
        return newTerm;
      } catch (err) {
        logger.error("Error creating fee term:", err);
        toast.error(err instanceof Error ? err.message : "Failed to create fee term");
        return null;
      }
    },
    [school?.id, toast, queryClient],
  );

  useEffect(() => {
    const handleOnline = () => {
      queryClient.invalidateQueries({ queryKey: ["feeTerms", school?.id] });
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [queryClient, school?.id]);

  return {
    feeTerms: localFeeTerms.length > 0 ? localFeeTerms : feeTerms,
    loading,
    isStale,
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
      logger.error("Error fetching student fee terms:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load student fee terms");
    } finally {
      setLoading(false);
    }
  }, [school?.id, studentId, toast]);

  const assignFeeTermToStudent = useCallback(
    async (assignment: { student_id: string; fee_term_id: string; class_id?: string; academic_year: string }) => {
      if (!school?.id) return null;

      try {
        const { data: ftData, error: termError } = await withTimeout(
          supabase
            .from("fee_terms")
            .select("total_amount, discount_percentage")
            .eq("id", assignment.fee_term_id)
            .single(),
          15000,
          { data: null, error: { message: "Fee terms fetch timed out", code: "TIMEOUT" } } as any,
        );

        if (termError || !ftData) throw termError || new Error("Fee term not found");

        const discountAmount = (ftData.total_amount * (ftData.discount_percentage || 0)) / 100;
        const finalAmount = ftData.total_amount - discountAmount;

        const { data, error } = await withTimeout(
          supabase
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
            .single(),
          15000,
          {
            data: null,
            error: { message: "Fee term assignment timed out", name: "TimeoutError", details: "", hint: "", code: "" },
          } as unknown as PostgrestSingleResponse<never>,
        );

        if (error) throw error;
        await fetchStudentFeeTerms();
        toast.success("Fee term assigned to student");
        return data;
      } catch (err) {
        logger.error("Error assigning fee term:", err);
        toast.error(err instanceof Error ? err.message : "Failed to assign fee term");
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
        const { data: paymentData, error: paymentError } = await withTimeout(
          supabase
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
            .single(),
          15000,
          {
            data: null,
            error: { message: "Payment creation timed out", name: "TimeoutError", details: "", hint: "", code: "" },
          } as unknown as PostgrestSingleResponse<never>,
        );

        if (paymentError) throw paymentError;

        const { data: sftData } = await withTimeout(
          supabase
            .from("student_fee_terms")
            .select("amount_paid, final_amount")
            .eq("id", payment.student_fee_term_id)
            .single(),
          15000,
          { data: null, error: { message: "Student fee terms fetch timed out", code: "TIMEOUT" } } as any,
        );

        if (sftData) {
          const newPaid = (sftData.amount_paid || 0) + payment.amount;
          const newStat = newPaid >= (sftData.final_amount || 0) ? "completed" : "active";

          const updateResult = await withTimeout(
            supabase
              .from("student_fee_terms")
              .update({ amount_paid: newPaid, status: newStat })
              .eq("id", payment.student_fee_term_id),
            15000,
            {
              error: { message: "Payment update timed out", name: "TimeoutError", details: "", hint: "", code: "" },
            } as unknown as PostgrestSingleResponse<never>,
          );
          if (updateResult?.error) {
            logger.error("Payment recorded but fee-term balance update failed:", updateResult.error);
            await fetchStudentFeeTerms();
            toast.warning("Payment recorded, but the fee balance could not be updated. It will reconcile on refresh.");
            return paymentData;
          }
        }

        await fetchStudentFeeTerms();
        toast.success("Payment recorded");
        return paymentData;
      } catch (err) {
        logger.error("Error recording payment:", err);

        if (typeof window !== "undefined") {
          try {
            const key = "pending_manual_fee_payments";
            const existing = window.localStorage.getItem(key);
            const parsed = existing ? JSON.parse(existing) : [];
            parsed.push({
              ...payment,
              school_id: school?.id || null,
              queued_at: new Date().toISOString(),
            });
            window.localStorage.setItem(key, JSON.stringify(parsed));
          } catch (storageError) {
            logger.warn("Failed to persist manual payment fallback:", storageError);
          }
        }

        let whatsappFallbackOpened = false;
        try {
          const { data: fallbackStudentTerm } = await supabase
            .from("student_fee_terms")
            .select("student:students(first_name, last_name, parent_phone)")
            .eq("id", payment.student_fee_term_id)
            .single();

          const student = fallbackStudentTerm?.student as
            | { first_name?: string; last_name?: string; parent_phone?: string | null }
            | undefined;

          if (student?.parent_phone && typeof window !== "undefined") {
            const formattedAmount = new Intl.NumberFormat("en-UG", {
              style: "currency",
              currency: "UGX",
              maximumFractionDigits: 0,
            }).format(payment.amount);

            const message =
              `Dear parent, we are following up on ${student.first_name || "your child"} ${student.last_name || ""}. ` +
              `A payment of ${formattedAmount} was received and will be confirmed manually due to a temporary gateway issue.`;
            const link = generateWhatsAppShareLink(student.parent_phone, message.trim());
            window.open(link, "_blank", "noopener,noreferrer");
            whatsappFallbackOpened = true;
          }
        } catch (fallbackError) {
          logger.warn("Unable to prepare WhatsApp payment fallback:", fallbackError);
        }

        toast.error(
          whatsappFallbackOpened
            ? "Payment service unavailable. Saved for manual record and opened WhatsApp follow-up."
            : "Payment service unavailable. Saved for manual record in this browser.",
        );
        return null;
      }
    },
    [toast, fetchStudentFeeTerms, school?.id],
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
