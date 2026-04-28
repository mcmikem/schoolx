"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { FeePayment, FeeStructure, CreatePaymentInput } from "@/types";
import { getQuerySchoolId, withTimeout } from "./utils";
import { getCachedData, setCachedData, invalidateCache } from "./queryCache";
import {
  DEMO_FEE_PAYMENTS,
  DEMO_FEE_STRUCTURE,
  DEMO_EXPENSES,
  DEMO_BUDGETS,
  DemoExpense,
} from "@/lib/demo-data";
import { isDemoSchool } from "@/lib/demo-utils";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import { logAuditEventWithOfflineSupport } from "@/lib/audit";
import {
  normalizeFeeStructureInput,
  normalizePaymentInput,
  validateFeeStructureInput,
  validatePaymentInput,
} from "@/lib/validation";

export function useFeePayments(
  schoolId?: string,
  page: number = 1,
  limit: number = 50,
) {
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const { isDemo, user, school } = useAuth();
  const isOnline = useOnlineStatus();
  const hasInitialized = useRef(false);
  const prevIsDemo = useRef(isDemo);

  useEffect(() => {
    if (prevIsDemo.current && !isDemo) {
      setPayments([]);
      setTotalCount(0);
      hasInitialized.current = false;
    }
    prevIsDemo.current = isDemo;
  }, [isDemo]);

  const cacheKey = `fee_payments:${schoolId}:${page}:${limit}`;

  const fetchPayments = useCallback(async () => {
    // Demo mode - check for demo school UUID
    if (isDemo || isDemoSchool(schoolId)) {
      setPayments(DEMO_FEE_PAYMENTS as unknown as FeePayment[]);
      setLoading(false);
      return;
    }

    if (!schoolId) {
      setLoading(false);
      return;
    }

    const cached = getCachedData<FeePayment[]>(cacheKey);
    if (cached && hasInitialized.current) {
      setPayments(cached);
      setLoading(false);
      return;
    }

    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    try {
      setLoading(true);
      if (!isOnline) {
        const cached = await offlineDB.getAllFromCache("fee_payments", {
          school_id: querySchoolId,
        });
        setPayments(cached as unknown as FeePayment[]);
        setLoading(false);
        return;
      }
      const data = await withTimeout(
        supabase
          .from("fee_payments")
          .select(
            `
            id, student_id, fee_id, amount_paid, payment_method, payment_reference, 
            paid_by, notes, payment_date, created_at, deleted_at,
            students!inner (id, first_name, last_name, school_id, classes (name))
          `,
            { count: "exact" },
          )
          .eq("students.school_id", querySchoolId)
          .is("deleted_at", null)
          .order("payment_date", { ascending: false })
          .range((page - 1) * limit, page * limit - 1)
          .then((r) => {
            if (r.error) throw r.error;
            return { data: r.data, count: r.count };
          }),
        8000,
        {
          data: [] as unknown as {
            id: string;
            student_id: string;
            fee_id: string;
            amount_paid: number;
            payment_method: string;
            payment_reference: string | null;
            paid_by: string;
            notes: string | null;
            payment_date: string;
            created_at: string;
            deleted_at: string | null;
            students: {
              id: string;
              first_name: string;
              last_name: string;
              school_id: string;
              classes: { name: string }[];
            }[];
          }[],
          count: 0,
        },
      );
      const result = (data.data as unknown as FeePayment[]) || [];
      setPayments(result);
      setTotalCount(data.count || 0);
      setCachedData(cacheKey, result);
      await offlineDB.cacheFromServer(
        "fee_payments",
        (data as unknown as Record<string, unknown>[]) || [],
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [schoolId, isDemo, isOnline, cacheKey, page, limit]);

  const createPayment = async (payment: CreatePaymentInput) => {
    const normalizedPayment = normalizePaymentInput({
      ...payment,
      payment_date: new Date().toISOString().split("T")[0],
    });
    const validationErrors = validatePaymentInput(normalizedPayment);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors[0]);
    }

    if (isDemo || isDemoSchool(schoolId)) {
      const newPaymentData = {
        ...normalizedPayment,
        id: `demo-payment-${Date.now()}`,
        school_id: schoolId || "00000000-0000-0000-0000-000000000001",
        created_at: new Date().toISOString(),
        students: {
          id: payment.student_id,
          first_name: "Demo",
          last_name: "Student",
          classes: { name: "Primary 1" },
        },
      };
      setPayments((prev) => [newPaymentData as unknown as FeePayment, ...prev]);
      return newPaymentData as unknown as FeePayment;
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);

    if (!payment.fee_id && !isOnline) {
      throw new Error("Fee ID is required for online payments");
    }

    if (payment.fee_id) {
      const { data: feeStructure, error: feeError } = await supabase
        .from("fee_structure")
        .select("id, name, amount")
        .eq("id", payment.fee_id)
        .eq("school_id", querySchoolId)
        .is("deleted_at", null)
        .single();

      if (feeError || !feeStructure) {
        throw new Error(
          "Invalid or missing fee structure. Please create the fee first.",
        );
      }
    }

    const payload = {
      ...normalizedPayment,
      school_id: querySchoolId,
    };
    if (!isOnline) {
      const offlineSaved = await offlineDB.save(
        "fee_payments",
        payload as unknown as Record<string, unknown>,
      );
      const offlinePayment = {
        ...payload,
        id: String(offlineSaved.id || `offline-payment-${Date.now()}`),
        created_at: new Date().toISOString(),
      };
      setPayments((prev) => [offlinePayment as unknown as FeePayment, ...prev]);
      if (school?.id && user?.id) {
        await logAuditEventWithOfflineSupport(
          false,
          school.id,
          user.id,
          user.full_name,
          "create",
          "fees",
          "Queued offline fee payment",
          String(offlinePayment.id),
          undefined,
          offlinePayment as unknown as Record<string, unknown>,
        );
      }
      return offlinePayment as unknown as FeePayment;
    }
    try {
      const { data, error: insertError } = await supabase
        .from("fee_payments")
        .insert(payload)
        .select(
          `
          id, student_id, fee_id, amount_paid, payment_method, payment_reference, 
          paid_by, notes, payment_date, created_at,
          students (id, first_name, last_name, classes (name))
        `,
        )
        .single();
      if (insertError) throw insertError;
      setPayments((prev) => [data as unknown as FeePayment, ...prev]);
      await offlineDB.cacheFromServer("fee_payments", [
        data as unknown as Record<string, unknown>,
      ]);
      invalidateCache(cacheKey);
      if (school?.id && user?.id) {
        await logAuditEventWithOfflineSupport(
          true,
          school.id,
          user.id,
          user.full_name,
          "create",
          "fees",
          "Recorded fee payment",
          data.id,
          undefined,
          data as unknown as Record<string, unknown>,
        );
      }
      return data as unknown as FeePayment;
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const deletePayment = async (id: string) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setPayments((prev) => prev.filter((p) => p.id !== id));
      return;
    }
    try {
      const existing = payments.find((p) => p.id === id);
      const payload = {
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id || null,
      };
      const { error: deleteError } = await supabase
        .from("fee_payments")
        .update(payload)
        .eq("id", id);
      if (deleteError) throw deleteError;
      setPayments((prev) => prev.filter((p) => p.id !== id));
      invalidateCache(cacheKey);
      if (school?.id && user?.id && existing) {
        await logAuditEventWithOfflineSupport(
          true,
          school.id,
          user.id,
          user.full_name,
          "delete",
          "fees",
          "Soft-deleted fee payment",
          id,
          existing as unknown as Record<string, unknown>,
          payload,
        );
      }
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : "Unknown error");
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);
  return {
    payments,
    loading,
    error,
    totalCount,
    createPayment,
    deletePayment,
    refetch: fetchPayments,
  };
}

export function useFeeStructure(schoolId?: string) {
  const [feeStructure, setFeeStructure] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemo } = useAuth();
  const isOnline = useOnlineStatus();
  const hasInitialized = useRef(false);
  const prevIsDemo = useRef(isDemo);

  useEffect(() => {
    if (prevIsDemo.current && !isDemo) {
      setFeeStructure([]);
      hasInitialized.current = false;
    }
    prevIsDemo.current = isDemo;
  }, [isDemo]);

  const cacheKey = `fee_structure:${schoolId}`;

  const fetchFeeStructure = useCallback(async () => {
    // Demo mode - check for demo school UUID
    if (isDemo || isDemoSchool(schoolId)) {
      setFeeStructure(DEMO_FEE_STRUCTURE as unknown as FeeStructure[]);
      setLoading(false);
      return;
    }

    if (!schoolId) {
      setLoading(false);
      return;
    }

    const cached = getCachedData<FeeStructure[]>(cacheKey);
    if (cached && hasInitialized.current) {
      setFeeStructure(cached);
      setLoading(false);
      return;
    }

    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    try {
      setLoading(true);
      if (!isOnline) {
        const cached = await offlineDB.getAllFromCache("fee_structure", {
          school_id: querySchoolId,
        });
        setFeeStructure(cached as unknown as FeeStructure[]);
        setLoading(false);
        return;
      }
      const data = await withTimeout(
        supabase
          .from("fee_structure")
          .select(
            `id, school_id, class_id, name, amount, term, academic_year, due_date, created_at, deleted_at, classes (name)`,
          )
          .eq("school_id", querySchoolId)
          .is("deleted_at", null)
          .order("name")
          .then((r) => {
            if (r.error) throw r.error;
            return r.data;
          }),
        5000,
        [] as unknown as {
          id: string;
          school_id: string;
          class_id: string | null;
          name: string;
          amount: number;
          term: number;
          academic_year: string;
          due_date: string | null;
          created_at: string;
          deleted_at: string | null;
          classes: { name: string }[];
        }[],
      );
      const result = (data as unknown as FeeStructure[]) || [];
      setFeeStructure(result);
      setCachedData(cacheKey, result);
      await offlineDB.cacheFromServer(
        "fee_structure",
        (data as unknown as Record<string, unknown>[]) || [],
      );
    } catch (err) {
      console.error("Error fetching fee structure:", err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, isDemo, isOnline, cacheKey]);

  const createFeeStructure = async (fee: {
    name: string;
    class_id?: string;
    amount: number;
    term: number;
    academic_year: string;
    due_date?: string;
  }) => {
    const normalizedFee = normalizeFeeStructureInput(fee);
    const validationErrors = validateFeeStructureInput(normalizedFee);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors[0]);
    }

    const existingDuplicate = feeStructure.find(
      (existing) =>
        existing.name.trim().toLowerCase() ===
          normalizedFee.name!.trim().toLowerCase() &&
        (existing.class_id || null) === (normalizedFee.class_id || null) &&
        Number(existing.term) === normalizedFee.term &&
        existing.academic_year === normalizedFee.academic_year,
    );
    if (existingDuplicate) {
      throw new Error(
        "A fee structure with the same name, class, term, and academic year already exists",
      );
    }

    if (isDemo || isDemoSchool(schoolId)) {
      const newFeeData = {
        ...normalizedFee,
        id: `demo-fee-${Date.now()}`,
        school_id: schoolId || "00000000-0000-0000-0000-000000000001",
        class_id: normalizedFee.class_id || null,
        due_date: normalizedFee.due_date || null,
        created_at: new Date().toISOString(),
      };
      setFeeStructure((prev) => [
        ...prev,
        newFeeData as unknown as FeeStructure,
      ]);
      return newFeeData;
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    try {
      const { data, error } = await supabase
        .from("fee_structure")
        .insert({
          school_id: querySchoolId,
          ...normalizedFee,
          class_id: normalizedFee.class_id || null,
          due_date: normalizedFee.due_date || null,
        })
        .select()
        .single();
      if (error) throw error;
      setFeeStructure((prev) => [...prev, data]);
      invalidateCache(cacheKey);
      return data;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const deleteFeeStructure = async (id: string) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setFeeStructure((prev) => prev.filter((f) => f.id !== id));
      invalidateCache(cacheKey);
      return;
    }
    try {
      const { error: deleteError } = await supabase
        .from("fee_structure")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (deleteError) throw deleteError;
      setFeeStructure((prev) => prev.filter((f) => f.id !== id));
      invalidateCache(cacheKey);
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  useEffect(() => {
    fetchFeeStructure();
    hasInitialized.current = true;
  }, [fetchFeeStructure]);
  return {
    feeStructure,
    loading,
    createFeeStructure,
    deleteFeeStructure,
    refetch: fetchFeeStructure,
  };
}

export function useFeeAdjustments(schoolId?: string) {
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemo, user, school } = useAuth();
  const isOnline = useOnlineStatus();
  const hasInitialized = useRef(false);
  const prevIsDemo = useRef(isDemo);

  useEffect(() => {
    if (prevIsDemo.current && !isDemo) {
      setAdjustments([]);
      hasInitialized.current = false;
    }
    prevIsDemo.current = isDemo;
  }, [isDemo]);

  const cacheKey = `fee_adjustments:${schoolId}`;

  const fetchAdjustments = useCallback(async () => {
    if (isDemo || isDemoSchool(schoolId)) {
      setAdjustments([]);
      setLoading(false);
      return;
    }
    if (!schoolId) {
      setLoading(false);
      return;
    }

    const cached = getCachedData<any[]>(cacheKey);
    if (cached && hasInitialized.current) {
      setAdjustments(cached);
      setLoading(false);
      return;
    }

    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    try {
      setLoading(true);
      if (!isOnline) {
        const cached = await offlineDB.getAllFromCache("fee_adjustments", {
          school_id: querySchoolId,
        });
        setAdjustments(cached as unknown as Record<string, unknown>[]);
        setLoading(false);
        return;
      }
      const data = await withTimeout(
        supabase
          .from("fee_adjustments")
          .select("*")
          .eq("school_id", querySchoolId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .then((r) => {
            if (r.error) throw r.error;
            return r.data;
          }),
        5000,
        [] as unknown as Record<string, unknown>[],
      );
      const result = data || [];
      setAdjustments(result);
      setCachedData(cacheKey, result);
      await offlineDB.cacheFromServer(
        "fee_adjustments",
        (data || []) as Record<string, unknown>[],
      );
    } catch (err) {
      console.error("Error fetching adjustments:", err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, isDemo, isOnline, cacheKey]);

  const createAdjustment = async (adj: {
    student_id: string;
    adjustment_type:
      | "scholarship"
      | "discount"
      | "penalty"
      | "manual_credit"
      | "write_off"
      | "bursary";
    amount: number;
    description?: string;
  }) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const newAdj = {
        ...adj,
        notes: adj.description,
        id: `demo-adj-${Date.now()}`,
        school_id: schoolId || "00000000-0000-0000-0000-000000000001",
        created_by: user?.id,
        created_at: new Date().toISOString(),
      };
      setAdjustments((prev) => [newAdj, ...prev]);
      invalidateCache(cacheKey);
      return newAdj;
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    const payload = {
      student_id: adj.student_id,
      adjustment_type: adj.adjustment_type,
      amount: adj.amount,
      notes: adj.description,
      school_id: querySchoolId,
      recorded_by: user?.id,
    };

    if (!isOnline) {
      const offlineSaved = await offlineDB.save(
        "fee_adjustments",
        payload as unknown as Record<string, unknown>,
      );
      const offlineAdjustment = {
        ...payload,
        id: String(offlineSaved.id || `offline-adjustment-${Date.now()}`),
        created_at: new Date().toISOString(),
      };
      setAdjustments((prev) => [offlineAdjustment, ...prev]);
      if (school?.id && user?.id) {
        await logAuditEventWithOfflineSupport(
          false,
          school.id,
          user.id,
          user.full_name,
          "create",
          "fees",
          `Queued offline fee adjustment (${adj.adjustment_type})`,
          String(offlineAdjustment.id),
          undefined,
          offlineAdjustment as unknown as Record<string, unknown>,
        );
      }
      return offlineAdjustment;
    }
    try {
      const { data, error } = await supabase
        .from("fee_adjustments")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      setAdjustments((prev) => [data, ...prev]);
      invalidateCache(cacheKey);
      if (school?.id && user?.id) {
        await logAuditEventWithOfflineSupport(
          true,
          school.id,
          user.id,
          user.full_name,
          "create",
          "fees",
          `Recorded fee adjustment (${adj.adjustment_type})`,
          data.id,
          undefined,
          data as unknown as Record<string, unknown>,
        );
      }
      return data;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const deleteAdjustment = async (id: string) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setAdjustments((prev) => prev.filter((a) => a.id !== id));
      return;
    }
    try {
      const existing = adjustments.find((a) => a.id === id);
      const payload = {
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id || null,
      };
      const { error: deleteError } = await supabase
        .from("fee_adjustments")
        .update(payload)
        .eq("id", id);
      if (deleteError) throw deleteError;
      setAdjustments((prev) => prev.filter((a) => a.id !== id));
      invalidateCache(cacheKey);
      if (school?.id && user?.id && existing) {
        await logAuditEventWithOfflineSupport(
          true,
          school.id,
          user.id,
          user.full_name,
          "delete",
          "fees",
          "Soft-deleted fee adjustment",
          id,
          existing as unknown as Record<string, unknown>,
          payload,
        );
      }
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  useEffect(() => {
    fetchAdjustments();
    hasInitialized.current = true;
  }, [fetchAdjustments]);
  return {
    adjustments,
    loading,
    createAdjustment,
    deleteAdjustment,
    refetch: fetchAdjustments,
  };
}

export function useBudget(schoolId?: string) {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemo } = useAuth();
  const prevIsDemo = useRef(isDemo);

  useEffect(() => {
    if (prevIsDemo.current && !isDemo) {
      setBudgets([]);
      setExpenses([]);
    }
    prevIsDemo.current = isDemo;
  }, [isDemo]);

  const createBudget = async (budget: any) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const newBudget = {
        ...budget,
        id: `demo-budget-${Date.now()}`,
        school_id: schoolId || "00000000-0000-0000-0000-000000000001",
        created_at: new Date().toISOString(),
      };
      setBudgets((prev) => [newBudget, ...prev]);
      return newBudget;
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    try {
      const { data, error } = await supabase
        .from("budgets")
        .insert({ ...budget, school_id: querySchoolId })
        .select()
        .single();
      if (error) throw error;
      setBudgets((prev) => [data, ...prev]);
      return data;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const createExpense = async (expense: any) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const newExpense = {
        ...expense,
        id: `demo-exp-${Date.now()}`,
        school_id: schoolId || "00000000-0000-0000-0000-000000000001",
        status: "pending",
        created_at: new Date().toISOString(),
      };
      setExpenses((prev) => [newExpense, ...prev]);
      return newExpense;
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    try {
      const { data, error } = await supabase
        .from("expenses")
        .insert({ ...expense, school_id: querySchoolId })
        .select()
        .single();
      if (error) throw error;
      setExpenses((prev) => [data, ...prev]);
      return data;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const updateExpenseStatus = async (id: string, status: string) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setExpenses((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status } : e)),
      );
      return { id, status };
    }
    try {
      const { data, error } = await supabase
        .from("expenses")
        .update({ status })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      setExpenses((prev) => prev.map((e) => (e.id === id ? data : e)));
      return data;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  useEffect(() => {
    async function fetchData() {
      if (isDemo || isDemoSchool(schoolId)) {
        setExpenses(DEMO_EXPENSES as unknown as DemoExpense[]);
        setBudgets(DEMO_BUDGETS as any);
        setLoading(false);
        return;
      }
      if (!schoolId) {
        setLoading(false);
        return;
      }
      const querySchoolId = getQuerySchoolId(schoolId, isDemo);
      try {
        setLoading(true);
        const [budgetsRes, expensesRes] = await Promise.all([
          supabase
            .from("budgets")
            .select(
              "id, school_id, name, amount, term, academic_year, created_at",
            )
            .eq("school_id", querySchoolId)
            .order("created_at", { ascending: false }),
          supabase
            .from("expenses")
            .select(
              "id, school_id, budget_id, amount, description, expense_date, status, created_at",
            )
            .eq("school_id", querySchoolId)
            .order("expense_date", { ascending: false }),
        ]);
        setBudgets(budgetsRes.data || []);
        setExpenses(expensesRes.data || []);
      } catch (err) {
        console.error("Error fetching budget:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [schoolId, isDemo]);

  return {
    budgets,
    expenses,
    loading,
    createBudget,
    createExpense,
    updateExpenseStatus,
  };
}
