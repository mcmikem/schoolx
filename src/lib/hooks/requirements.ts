"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { logger } from "@/lib/logger";

/**
 * School requirements — the second bill.
 *
 * In Ugandan schools "requirements" are levies published per class and per
 * term in the end-of-term circular. They are frequently larger than tuition,
 * and the money ones are paid in cash to the bursar at reporting day while the
 * item ones are ticked off at the reception table. None of that had anywhere
 * to live, so it was tracked on paper and re-typed every term.
 *
 * Much of it is restricted under the Education (Pre-Primary, Primary and
 * Post-Primary) Regulations 2008 — schools may not charge for buildings,
 * uniforms, textbooks, furniture or tests — so every item carries
 * mandatory/optional and monetary/non-monetary flags rather than being assumed
 * to be a charge.
 *
 * Nothing here gates an exam sitting. Blocking a registered candidate over fees
 * is an offence in Uganda; the lawful lever is report-card and transcript
 * release, which is what `is_cleared` informs.
 */

export type RequirementStatus = "pending" | "brought" | "paid" | "waived";

export interface RequirementItem {
  id: string;
  class_id: string | null;
  name: string;
  description: string | null;
  is_mandatory: boolean;
  is_monetary: boolean;
  amount: number | null;
  unit: string | null;
  supplied_by_school: boolean;
  term: number | null;
  academic_year: string | null;
  display_order: number;
}

export interface StudentRequirement {
  id: string;
  student_id: string;
  requirement_id: string;
  status: RequirementStatus;
  amount_paid: number;
  fulfilled_on: string | null;
}

export interface StudentProgress {
  studentId: string;
  name: string;
  className: string;
  /** Mandatory items settled, out of the mandatory total for this class. */
  done: number;
  total: number;
  outstanding: number;
  isCleared: boolean;
}

export function useRequirements(schoolId?: string, term?: number, academicYear?: string) {
  const [items, setItems] = useState<RequirementItem[]>([]);
  const [rows, setRows] = useState<StudentRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const [itemRes, rowRes] = await Promise.all([
        withTimeout(
          supabase
            .from("requirement_items")
            .select(
              "id, class_id, name, description, is_mandatory, is_monetary, amount, unit, supplied_by_school, term, academic_year, display_order",
            )
            .eq("school_id", schoolId)
            .is("deleted_at", null)
            .order("display_order", { ascending: true }),
          15000,
          timeoutFallback<RequirementItem[]>(),
        ),
        withTimeout(
          supabase
            .from("student_requirements")
            .select("id, student_id, requirement_id, status, amount_paid, fulfilled_on")
            .eq("school_id", schoolId),
          15000,
          timeoutFallback<StudentRequirement[]>(),
        ),
      ]);

      const itemErr = (itemRes as { error?: unknown }).error;
      if (itemErr) throw itemErr;
      const rowErr = (rowRes as { error?: unknown }).error;
      if (rowErr) throw rowErr;

      setItems((itemRes as { data?: RequirementItem[] }).data ?? []);
      setRows((rowRes as { data?: StudentRequirement[] }).data ?? []);
    } catch (err) {
      logger.warn("[useRequirements] load failed:", err);
      setError("Could not load requirements. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Items that apply to a class: those set for it, plus school-wide ones. */
  const itemsForClass = useCallback(
    (classId: string | null) =>
      items.filter(
        (i) =>
          (i.class_id === null || i.class_id === classId) &&
          (term == null || i.term == null || i.term === term) &&
          (academicYear == null || i.academic_year == null || i.academic_year === academicYear),
      ),
    [items, term, academicYear],
  );

  const addItem = useCallback(
    async (input: {
      class_id: string | null;
      name: string;
      description?: string;
      is_mandatory: boolean;
      is_monetary: boolean;
      amount?: number | null;
      unit?: string | null;
      supplied_by_school?: boolean;
    }) => {
      if (!schoolId) throw new Error("No school selected");
      const row = {
        school_id: schoolId,
        class_id: input.class_id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        is_mandatory: input.is_mandatory,
        is_monetary: input.is_monetary,
        amount: input.is_monetary ? (input.amount ?? 0) : null,
        unit: input.unit?.trim() || null,
        supplied_by_school: Boolean(input.supplied_by_school),
        term: term ?? null,
        academic_year: academicYear ?? null,
        display_order: 0,
      };
      const { data, error } = await withTimeout(
        supabase.from("requirement_items").insert(row).select().single(),
        15000,
        timeoutFallback(),
      );
      if (error) throw error;
      setItems((prev) => [...prev, { ...row, ...data } as RequirementItem]);
      return data;
    },
    [schoolId, term, academicYear],
  );

  const removeItem = useCallback(async (id: string) => {
    const { error } = await withTimeout(
      supabase.from("requirement_items").update({ deleted_at: new Date().toISOString() }).eq("id", id),
      15000,
      timeoutFallback(),
    );
    if (error) throw error;
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  /**
   * Mark a pupil's requirement settled. Monetary items are paid to the bursar
   * and take an amount; item requirements are simply ticked off at the desk.
   * Idempotent: re-marking updates the existing row rather than duplicating.
   */
  const mark = useCallback(
    async (studentId: string, requirement: RequirementItem, status: RequirementStatus, amountPaid?: number) => {
      if (!schoolId) throw new Error("No school selected");
      const settled = status === "paid" || status === "brought" || status === "waived";
      const paid = requirement.is_monetary ? (status === "paid" ? (amountPaid ?? requirement.amount ?? 0) : 0) : 0;

      const existing = rows.find((r) => r.student_id === studentId && r.requirement_id === requirement.id);
      if (existing) {
        const { error } = await withTimeout(
          supabase
            .from("student_requirements")
            .update({ status, amount_paid: paid, fulfilled_on: settled ? getToday() : null })
            .eq("id", existing.id),
          15000,
          timeoutFallback(),
        );
        if (error) throw error;
        setRows((prev) =>
          prev.map((r) =>
            r.id === existing.id ? { ...r, status, amount_paid: paid, fulfilled_on: settled ? getToday() : null } : r,
          ),
        );
        return;
      }

      const row = {
        school_id: schoolId,
        student_id: studentId,
        requirement_id: requirement.id,
        status,
        amount_paid: paid,
        fulfilled_on: settled ? getToday() : null,
      };
      const { data, error } = await withTimeout(
        supabase.from("student_requirements").insert(row).select().single(),
        15000,
        timeoutFallback(),
      );
      if (error) throw error;
      setRows((prev) => [...prev, { ...row, ...data } as StudentRequirement]);
    },
    [schoolId, rows],
  );

  /** Per-pupil progress across the mandatory items for a class. */
  const progressFor = useCallback(
    (students: { id: string; name: string; className: string }[], classId: string | null): StudentProgress[] => {
      const applicable = itemsForClass(classId).filter((i) => i.is_mandatory);
      const applicableIds = new Set(applicable.map((i) => i.id));
      return students.map((s) => {
        const mine = rows.filter((r) => r.student_id === s.id && applicableIds.has(r.requirement_id));
        const settled = mine.filter((r) => r.status === "paid" || r.status === "brought" || r.status === "waived");
        const done = new Set(settled.map((r) => r.requirement_id)).size;
        return {
          studentId: s.id,
          name: s.name,
          className: s.className,
          done,
          total: applicable.length,
          outstanding: Math.max(applicable.length - done, 0),
          isCleared: applicable.length > 0 && done >= applicable.length,
        };
      });
    },
    [itemsForClass, rows],
  );

  const statusOf = useCallback(
    (studentId: string, requirementId: string): RequirementStatus =>
      rows.find((r) => r.student_id === studentId && r.requirement_id === requirementId)?.status ?? "pending",
    [rows],
  );

  const summary = useMemo(() => {
    const monetaryTotal = items
      .filter((i) => i.is_monetary && i.is_mandatory)
      .reduce((sum, i) => sum + Number(i.amount ?? 0), 0);
    return { monetaryTotal, itemCount: items.filter((i) => !i.is_monetary).length };
  }, [items]);

  return {
    items,
    rows,
    loading,
    error,
    summary,
    itemsForClass,
    progressFor,
    statusOf,
    addItem,
    removeItem,
    mark,
    refresh: load,
  };
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
