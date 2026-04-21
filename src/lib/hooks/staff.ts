"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { StaffSalary, SalaryPayment, StaffReview } from "@/types";
import { getQuerySchoolId, withTimeout } from "./utils";
import { DEMO_STAFF, DemoStaff } from "@/lib/demo-data";
import { isDemoSchool } from "@/lib/demo-utils";

type StaffUser = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  role: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
};

export function useStaff(schoolId?: string) {
  const [staff, setStaff] = useState<(StaffUser | DemoStaff)[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemo } = useAuth();

  useEffect(() => {
    let cancelled = false;
    async function fetchStaff() {
      if (isDemo || isDemoSchool(schoolId)) {
        if (!cancelled) {
          setStaff(DEMO_STAFF);
          setLoading(false);
        }
        return;
      }
      if (!schoolId) {
        setLoading(false);
        return;
      }
      const querySchoolId = getQuerySchoolId(schoolId, isDemo);
      try {
        setLoading(true);
        const data = await withTimeout(
          supabase
            .from("users")
            .select(
              "id, full_name, email, phone, role, avatar_url, is_active, created_at",
            )
            .eq("school_id", querySchoolId)
            .eq("is_active", true)
            .order("full_name")
            .then((r) => {
              if (r.error) throw r.error;
              return r.data;
            }),
          5000,
          [] as StaffUser[],
        );
        if (!cancelled) setStaff(data || []);
      } catch (err) {
        console.error("Error fetching staff:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchStaff();
    return () => {
      cancelled = true;
    };
  }, [schoolId, isDemo]);

  return { staff, loading };
}

export function useSalaries(schoolId?: string) {
  const [salaries, setSalaries] = useState<StaffSalary[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemo } = useAuth();

  const updateSalary = async (
    staffId: string,
    updates: Partial<StaffSalary>,
  ) => {
    if (isDemo || isDemoSchool(schoolId)) {
      return { success: true };
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    try {
      const { error } = await supabase
        .from("staff_salaries")
        .upsert(
          { staff_id: staffId, school_id: querySchoolId, ...updates },
          { onConflict: "staff_id" },
        );
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    async function fetchSalaries() {
      if (!schoolId) {
        setLoading(false);
        return;
      }
      const querySchoolId = getQuerySchoolId(schoolId, isDemo);
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("staff_salaries")
          .select(
            "id, school_id, staff_id, base_salary, allowances, deductions, currency, payment_method, is_active, created_at, staff:users(id, full_name, role)",
          )
          .eq("school_id", querySchoolId);
        if (error) throw error;
        setSalaries((data as unknown as StaffSalary[]) || []);
      } catch (err) {
        console.error("Error fetching salaries:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSalaries();
  }, [schoolId, isDemo]);

  return { salaries, loading, updateSalary };
}

export function useSalaryPayments(schoolId?: string) {
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemo } = useAuth();

  const processPayment = async (
    payment: Omit<SalaryPayment, "id" | "created_at">,
  ) => {
    if (isDemo || isDemoSchool(schoolId)) {
      return {
        success: true,
        data: {
          ...payment,
          id: `demo-pay-${Date.now()}`,
          created_at: new Date().toISOString(),
        },
      };
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    try {
      const { data, error } = await supabase
        .from("salary_payments")
        .insert([{ ...payment, school_id: querySchoolId }])
        .select(
          "id, school_id, staff_id, academic_year_id, month, year, base_paid, allowances_paid, deductions_applied, net_paid, payment_date, payment_status, created_at",
        )
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    async function fetchPayments() {
      if (!schoolId) {
        setLoading(false);
        return;
      }
      const querySchoolId = getQuerySchoolId(schoolId, isDemo);
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("salary_payments")
          .select(
            "id, school_id, staff_id, academic_year_id, month, year, base_paid, allowances_paid, deductions_applied, net_paid, payment_date, payment_status, created_at, staff:users(id, full_name)",
          )
          .eq("school_id", querySchoolId)
          .order("payment_date", { ascending: false });
        if (error) throw error;
        setPayments((data as unknown as SalaryPayment[]) || []);
      } catch (err) {
        console.error("Error fetching salary payments:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPayments();
  }, [schoolId, isDemo]);

  return { payments, loading, processPayment };
}

export function useStaffReviews(schoolId?: string, staffId?: string) {
  const [reviews, setReviews] = useState<StaffReview[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemo } = useAuth();

  const submitReview = async (
    review: Omit<StaffReview, "id" | "created_at">,
  ) => {
    if (isDemo || isDemoSchool(schoolId)) {
      return {
        success: true,
        data: {
          ...review,
          id: `demo-review-${Date.now()}`,
          created_at: new Date().toISOString(),
        },
      };
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    try {
      const { data, error } = await supabase
        .from("staff_reviews")
        .insert([{ ...review, school_id: querySchoolId }])
        .select(
          "id, school_id, staff_id, reviewer_id, review_date, rating, strengths, areas_for_improvement, goals, comments, status, created_at",
        )
        .single();
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    async function fetchReviews() {
      if (!schoolId) {
        setLoading(false);
        return;
      }
      const querySchoolId = getQuerySchoolId(schoolId, isDemo);
      try {
        setLoading(true);
        let query = supabase
          .from("staff_reviews")
          .select(
            "id, school_id, staff_id, reviewer_id, review_date, rating, strengths, areas_for_improvement, goals, comments, status, created_at, staff:users(id, full_name, role), reviewer:users(id, full_name)",
          )
          .eq("school_id", querySchoolId);
        if (staffId) query = query.eq("staff_id", staffId);
        const { data, error } = await query.order("review_date", {
          ascending: false,
        });
        if (error) {
          if (error.code === "42P01" || error.code === "42501" || error.code === "PGRST116") {
            setReviews([]);
            return;
          }
          throw error;
        }
        setReviews((data as unknown as StaffReview[]) || []);
      } catch (err) {
        console.error("Error fetching reviews:", err instanceof Error ? err.message : "unknown");
        setReviews([]);
      } finally {
        setLoading(false);
      }
    }
    fetchReviews();
  }, [schoolId, staffId, isDemo]);

  return { reviews, loading, submitReview };
}

export function useLeaveRequests(schoolId?: string) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDemo } = useAuth();

  const createRequest = async (request: {
    staff_id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    days_count: number;
    reason: string;
  }) => {
    if (isDemo || isDemoSchool(schoolId)) {
      const newRequest = {
        ...request,
        id: `demo-leave-${Date.now()}`,
        school_id: schoolId || "00000000-0000-0000-0000-000000000001",
        status: "pending" as const,
        created_at: new Date().toISOString(),
      };
      setRequests((prev) => [newRequest, ...prev]);
      return newRequest;
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .insert({ ...request, school_id: querySchoolId })
        .select(
          "id, school_id, staff_id, leave_type, status, start_date, end_date, days_count, reason, approved_at, created_at",
        )
        .single();
      if (error) throw error;
      setRequests((prev) => [data, ...prev]);
      return data;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const updateRequestStatus = async (
    id: string,
    status: "approved" | "rejected",
  ) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r)),
      );
      return { id, status };
    }
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .update({ status, approved_at: new Date().toISOString() })
        .eq("id", id)
        .select(
          "id, school_id, staff_id, leave_type, status, start_date, end_date, days_count, reason, approved_at, created_at",
        )
        .single();
      if (error) throw error;
      setRequests((prev) => prev.map((r) => (r.id === id ? data : r)));
      return data;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  useEffect(() => {
    async function fetchRequests() {
      if (!schoolId) {
        setLoading(false);
        return;
      }
      const querySchoolId = getQuerySchoolId(schoolId, isDemo);
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("leave_requests")
          .select(
            "id, school_id, staff_id, leave_type, status, start_date, end_date, days_count, reason, approved_at, created_at, users!staff_id(id, full_name, phone)",
          )
          .eq("school_id", querySchoolId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setRequests(data || []);
      } catch (err) {
        console.error("Error fetching leave requests:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRequests();
  }, [schoolId, isDemo]);

  return { requests, loading, createRequest, updateRequestStatus };
}
