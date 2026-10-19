"use client";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { logAuditEventWithOfflineSupport } from "@/lib/audit";
import { useAuth } from "@/lib/auth-context";
import { DEMO_BUDGETS, DEMO_EXPENSES, DEMO_FEE_PAYMENTS, DEMO_FEE_STRUCTURE, DemoExpense } from "@/lib/demo-data";
import { isDemoSchool } from "@/lib/demo-utils";
import { logger } from "@/lib/logger";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import { validateAdjustment } from "@/lib/server/fee-logic";
import { supabase } from "@/lib/supabase";
import {
  getErrorMessage,
  normalizeFeeStructureInput,
  normalizePaymentInput,
  validateFeeStructureInput,
  validatePaymentInput,
} from "@/lib/validation";
import type { CreatePaymentInput, FeeAdjustment, FeePayment, FeeStructure } from "@/types";
import { getCachedData, invalidateCache, revalidateShared, setCachedData } from "./queryCache";
import { getLocalDateString, getQuerySchoolId, isTimeoutResult, timeoutFallback, withTimeout } from "./utils";

let feePaymentsDeletedAtSupported: boolean | null = null;

function isMissingFeePaymentsColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message || "") : "";

  return code === "42703" && message.includes(`fee_payments.${columnName}`);
}

async function fetchFeePaymentsWithFallback(options: { schoolId: string; page: number; limit: number }) {
  const selectWithClass = `
    id, student_id, fee_id, amount_paid, payment_method, payment_reference,
    paid_by, notes, payment_date, created_at,
    students!inner (id, first_name, last_name, student_number, class_id, school_id, classes (name)),
    fee_structure (name)
  `;

  const selectWithoutClass = `
    id, student_id, fee_id, amount_paid, payment_method, payment_reference,
    paid_by, notes, payment_date, created_at,
    students!inner (id, first_name, last_name, student_number, class_id, school_id),
    fee_structure (name)
  `;

  const joins = [selectWithClass, selectWithoutClass];

  let lastError: unknown = null;

  for (const fields of joins) {
    const includeDeletedAtFilter = feePaymentsDeletedAtSupported !== false;

    let query = supabase
      .from("fee_payments")
      .select(fields, { count: "exact" })
      .eq("students.school_id", options.schoolId)
      .order("payment_date", { ascending: false })
      .range((options.page - 1) * options.limit, options.page * options.limit - 1);

    if (includeDeletedAtFilter) {
      query = query.is("deleted_at", null);
    }

    const result = await query;

    if (!result.error) {
      return { data: result.data || [], count: result.count || 0 };
    }

    if (isMissingFeePaymentsColumnError(result.error, "deleted_at")) {
      feePaymentsDeletedAtSupported = false;
      continue;
    }

    lastError = result.error;
  }

  throw lastError;
}

const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

/**
 * Recent-duplicate guard for the direct-insert payment path (the UI posts
 * here, not to /api/fee-payments/). A double-tap, Enter-key repeat, or retry
 * after a client timeout must return the existing row instead of minting a
 * second payment. Fail-open: any guard error returns null so a real payment
 * is never blocked.
 */
export async function findRecentDuplicatePayment(params: {
  schoolId: string;
  studentId: string;
  amount: number;
  method: string;
  online: boolean;
  paymentDate?: string;
  reference?: string;
}): Promise<Record<string, unknown> | null> {
  const { schoolId, studentId, amount, method, online } = params;
  const sameRecordedPayment = (row: Record<string, unknown>) =>
    Number(row.amount_paid) === amount &&
    (!params.paymentDate || String(row.payment_date || "").slice(0, 10) === params.paymentDate) &&
    (!params.reference || row.payment_reference === params.reference);
  try {
    const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
    if (!online) {
      const local = await offlineDB.getAll("fee_payments", { student_id: studentId });
      return (
        (local.find(
          (r) =>
            sameRecordedPayment(r as Record<string, unknown>) &&
            String((r as Record<string, unknown>).payment_method) === method &&
            String((r as Record<string, unknown>).created_at || "") >= since,
        ) as Record<string, unknown> | undefined) ?? null
      );
    }
    const { data } = await withTimeout(
      supabase
        .from("fee_payments")
        .select("id, student_id, amount_paid, payment_method, payment_reference, payment_date, created_at")
        .eq("school_id", schoolId)
        .eq("student_id", studentId)
        .eq("payment_method", method)
        .gte("created_at", since)
        .is("deleted_at", null)
        .limit(10),
      10000,
      timeoutFallback(),
    );
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    return rows.find(sameRecordedPayment) ?? null;
  } catch {
    return null;
  }
}

/**
 * Every payment for the school, in the smallest projection that can still
 * settle a fee line.
 *
 * This exists because the fees screen used the *paginated* cashbook slice for
 * every balance. With 50 rows on screen and 62 recorded, 12 pupils' payments
 * were never fetched, so a child who had paid in full showed as UGX 0 paid,
 * 0% and their whole balance outstanding. A bursar called about a Kikunyu pupil
 * whose 100,000 payment was real and on record, and the screen said he had
 * paid nothing.
 *
 * The cashbook table still pages -- it is a long list and nobody reads 5,000
 * rows of it. But a *balance* is a total, and a total from one page is a wrong
 * number rather than an incomplete one. So the two concerns are fetched
 * separately: the table pages, the arithmetic does not.
 *
 * Six columns, no join, ordered by id rather than date. Ordering by
 * payment_date ties every row in a school that records a whole term on one day,
 * and which rows land on page 1 then becomes arbitrary.
 */
export function useCompleteFeePayments(schoolId?: string) {
  const [payments, setPayments] = useState<
    Array<{
      id: string;
      student_id: string;
      amount_paid: number;
      fee_id: string | null;
      payment_date: string;
      payment_method: string;
      payment_reference: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const { isDemo } = useAuth();

  useEffect(() => {
    if (!schoolId || isDemo || isDemoSchool(schoolId)) {
      setPayments([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    // A guard, not a design limit. If a school really does reach this, the
    // flag tells the bursar the totals are incomplete instead of quietly
    // showing them a wrong balance.
    const CAP = 20000;

    void (async () => {
      setLoading(true);
      try {
        const result = (await withTimeout(
          supabase
            .from("fee_payments")
            .select("id, student_id, amount_paid, fee_id, payment_date, payment_method, payment_reference")
            .eq("school_id", schoolId)
            .is("deleted_at", null)
            .order("id", { ascending: true })
            .limit(CAP),
          20000,
          null,
        )) as PostgrestSingleResponse<
          {
            id: string;
            student_id: string;
            amount_paid: number;
            fee_id: string | null;
            payment_date: string;
            payment_method: string;
            payment_reference: string | null;
          }[]
        >;
        if (cancelled) return;
        if (result.error) throw result.error;
        const data = result.data;
        setPayments((data ?? []) as typeof payments);
        setTruncated((data?.length ?? 0) >= CAP);
      } catch (e) {
        if (!cancelled) {
          logger.error("Could not load the full payment ledger:", e);
          setPayments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [schoolId, isDemo]);

  return { payments, loading, truncated };
}

export function useFeePayments(schoolId?: string, page: number = 1, limit?: number, all?: boolean) {
  // A caller that does not pass a page size is not paginating — it is almost
  // certainly computing a total, and a total from one 50-row page is wrong. So
  // an omitted limit means "fetch them all"; an explicit limit keeps paging.
  const fetchAll = all ?? limit === undefined;
  const effectiveLimit = limit ?? 50;
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

  const cacheKey = `fee_payments:${schoolId}:${page}:${effectiveLimit}:${fetchAll ? "all" : "page"}`;

  const fetchPayments = useCallback(async () => {
    setError(null);
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
    if (cached) {
      setPayments(cached);
      setTotalCount(getCachedData<number>(`${cacheKey}:count`) || cached.length);
      setLoading(false);
      return;
    }

    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    if (!querySchoolId) {
      setLoading(false);
      return;
    }
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
      let result: FeePayment[] = [];
      let count = 0;
      if (fetchAll) {
        // Totals must never be computed from a single page. Page through until
        // every row is in hand; the cap is a runaway guard, not a real limit.
        const pageSize = Math.max(effectiveLimit, 1000);
        const MAX_PAGES = 100;
        let currentPage = 1;
        while (currentPage <= MAX_PAGES) {
          const chunk = await withTimeout(
            fetchFeePaymentsWithFallback({ schoolId: querySchoolId, page: currentPage, limit: pageSize }),
            8000,
            null,
          );
          if (chunk === null) throw new Error("Loading payments timed out. Please try again.");
          const rows = (chunk.data as unknown as FeePayment[]) || [];
          count = chunk.count || rows.length;
          result = result.concat(rows);
          if (rows.length < pageSize || result.length >= count) break;
          currentPage += 1;
        }
      } else {
        const data = await withTimeout(
          fetchFeePaymentsWithFallback({
            schoolId: querySchoolId,
            page,
            limit: effectiveLimit,
          }),
          8000,
          null,
        );
        if (data === null) throw new Error("Loading payments timed out. Please try again.");
        result = (data.data as unknown as FeePayment[]) || [];
        count = data.count || 0;
      }
      setPayments(result);
      setTotalCount(count);
      setCachedData(cacheKey, result);
      setCachedData(`${cacheKey}:count`, count);
      await offlineDB.cacheFromServer("fee_payments", result as unknown as Record<string, unknown>[]);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Unknown error fetching payments";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [schoolId, isDemo, isOnline, cacheKey, page, effectiveLimit, fetchAll]);

  const createPayment = async (payment: CreatePaymentInput) => {
    const normalizedPayment = normalizePaymentInput({
      ...payment,
      // Local, not UTC. A payment entered at 01:00 in Uganda is dated
      // YESTERDAY by toISOString(), which drops it out of "Fees today" on the
      // dashboard and files it under the wrong day of the cashbook.
      payment_date: payment.payment_date || getLocalDateString(),
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

    // The "Fee ID is required for online payments" guard is gone, and the
    // condition it used to carry was meaningless anyway.
    //
    // normalizePaymentInput() returns a fixed set of fields and fee_id is not
    // among them, so it is stripped on every write. `payment.fee_id` was
    // therefore always undefined, `!payment.fee_id` was always true, and this
    // guard blocked EVERY payment -- offline under its original
    // `!isOnline` form, online after that was "fixed" to `isOnline`. The form
    // has no fee picker either, so nothing could ever satisfy it.
    //
    // fee_id is nullable in the database, the offline sync inserts without it,
    // and balances are derived from payments rather than from which fee item
    // they name. So the requirement had no purpose behind it. Recording a
    // payment works again on any connection.
    //
    // If payments later need to be attributed to a specific fee item, that is
    // a feature: add the picker, keep fee_id through the normaliser, and bring
    // the rule back then -- where it can actually be satisfied.

    if (payment.fee_id) {
      const { data: feeStructure, error: feeError } = await supabase
        .from("fee_structure")
        .select("id, name, amount")
        .eq("id", payment.fee_id)
        .eq("school_id", querySchoolId)
        .is("deleted_at", null)
        .single();

      if (feeError || !feeStructure) {
        throw new Error("Invalid or missing fee structure. Please create the fee first.");
      }
    }

    // A payment reference must be unique, but say so in the words a bursar can
    // act on. The raw Postgres message -- "duplicate key value violates unique
    // constraint idx_fee_payments_reference" -- was reaching the screen, which
    // tells a school secretary nothing about what to change.
    const reference = String(normalizedPayment.payment_reference || "").trim();
    if (reference) {
      const { data: seen } = await withTimeout(
        supabase
          .from("fee_payments")
          .select("id, student_id, amount_paid, payment_date, payment_method, students (first_name, last_name)")
          .eq("school_id", querySchoolId)
          .eq("payment_reference", reference)
          .is("deleted_at", null)
          .limit(1),
        10000,
        timeoutFallback(),
      );
      const clash = (seen as unknown[] | null)?.[0] as
        | {
            amount_paid?: number | string;
            payment_date?: string;
            payment_method?: string;
            students?: { first_name?: string; last_name?: string } | null;
          }
        | undefined;
      if (clash) {
        // Say WHICH payment took the reference. "Already used" leaves a bursar
        // with nothing to act on beyond guessing, and the usual answer is that
        // they are looking at a different day's work than they think.
        const who = clash.students
          ? `${clash.students.first_name ?? ""} ${clash.students.last_name ?? ""}`.trim()
          : null;
        const when = clash.payment_date ?? "";
        const amount = Number(clash.amount_paid ?? 0);
        throw new Error(
          `Reference "${reference}" is already on a payment${who ? ` for ${who}` : ""}${when ? ` dated ${when}` : ""}` +
            `${amount ? ` of ${amount.toLocaleString()}` : ""}. Use a different reference, or leave it blank if this payment has none.`,
        );
      }
    }

    const duplicate = await findRecentDuplicatePayment({
      schoolId: querySchoolId ?? "",
      studentId: String(normalizedPayment.student_id),
      amount: Number(normalizedPayment.amount_paid),
      method: String(normalizedPayment.payment_method),
      online: isOnline,
      paymentDate: String(normalizedPayment.payment_date),
      reference: String(normalizedPayment.payment_reference || ""),
    });
    if (duplicate) {
      logger.warn("[Fees] Duplicate payment suppressed, returning existing row");
      return duplicate as unknown as FeePayment;
    }

    const payload: Record<string, unknown> = {
      ...normalizedPayment,
      school_id: querySchoolId,
      recorded_by: user?.id,
    };
    // allow_overpayment is an intent flag for the API route — fee_payments
    // has no such column, so strip it before direct inserts (online + offline
    // sync both target that table). Tag notes instead, mirroring the route.
    delete payload.allow_overpayment;
    if (
      payment.allow_overpayment &&
      typeof payload.notes === "string" &&
      !payload.notes.includes("[overpayment accepted]")
    ) {
      payload.notes = [payload.notes, "[overpayment accepted]"].filter(Boolean).join(" ");
    }
    if (!isOnline) {
      const offlineSaved = await offlineDB.save("fee_payments", payload as unknown as Record<string, unknown>);
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
      const result = await withTimeout(
        supabase
          .from("fee_payments")
          .insert(payload)
          .select(
            `
            id, student_id, fee_id, amount_paid, payment_method, payment_reference,
            paid_by, notes, payment_date, created_at,
            students (id, first_name, last_name, classes (name))
          `,
          )
          .single(),
        15000,
        timeoutFallback(),
      );
      if (isTimeoutResult(result))
        throw new Error("Saving the payment timed out. Check your connection before retrying.");
      const { data, error: insertError } = result;
      if (insertError) throw translateFeePaymentError(insertError);
      if (!data) throw new Error("The payment could not be saved.");
      setPayments((prev) => [data as unknown as FeePayment, ...prev]);
      await offlineDB.cacheFromServer("fee_payments", [data as unknown as Record<string, unknown>]);
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
      const message =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Database error recording payment";
      throw new Error(message);
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

      // Offline deletes used to have no branch at all: the Supabase update threw,
      // the catch re-threw, and the row stayed on screen looking undeletable.
      // fee_payments is in SOFT_DELETE_TABLES, so the queued delete soft-deletes
      // on sync -- the same end state as the online path.
      if (!isOnline) {
        await offlineDB.delete("fee_payments", id);
        // Remove it now rather than after a sync the user cannot wait for.
        setPayments((prev) => prev.filter((p) => p.id !== id));
        invalidateCache(cacheKey);
        if (school?.id && user?.id && existing) {
          await logAuditEventWithOfflineSupport(
            false,
            school.id,
            user.id,
            user.full_name,
            "delete",
            "fees",
            "Queued offline deletion of fee payment",
            id,
            existing as unknown as Record<string, unknown>,
            payload,
          );
        }
        return;
      }

      const { error: deleteError } = await withTimeout(
        supabase.from("fee_payments").update(payload).eq("id", id),
        15000,
        timeoutFallback(),
      );
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
      const message =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Database error deleting payment";
      throw new Error(message);
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
    refetch: () => {
      invalidateCache(cacheKey);
      invalidateCache(`${cacheKey}:count`);
      return fetchPayments();
    },
  };
}

export function useFeeStructure(schoolId?: string) {
  const [feeStructure, setFeeStructure] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
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
    if (cached) {
      setFeeStructure(cached);
      setLoading(false);
      return;
    }

    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    let hasPersistedFees = false;
    try {
      setLoading(true);
      setError(null);
      if (!isOnline) {
        const cached = await offlineDB.getAllFromCache("fee_structure", {
          school_id: querySchoolId,
        });
        setFeeStructure(cached as unknown as FeeStructure[]);
        setLoading(false);
        return;
      }
      try {
        const persistedFees = await offlineDB.getAllFromCache("fee_structure", {
          school_id: querySchoolId,
        });
        if (persistedFees.length > 0) {
          hasPersistedFees = true;
          setFeeStructure(persistedFees as unknown as FeeStructure[]);
          setLoading(false);
        }
      } catch (cacheError) {
        logger.warn("Could not read cached fee structure:", cacheError);
      }
      const data = await withTimeout(
        supabase
          .from("fee_structure")
          .select(
            `id, school_id, class_id, name, amount, term, academic_year, due_date, category, boarding_status, frequency, transport_zone, created_at, deleted_at, classes (name)`,
          )
          .eq("school_id", querySchoolId)
          .is("deleted_at", null)
          .order("name")
          .then((r) => {
            if (r.error) throw r.error;
            return r.data;
          }),
        15000,
        null,
      );
      if (data === null) throw new Error("Loading fees took too long. Please try again.");
      const result = (data as unknown as FeeStructure[]) || [];
      setFeeStructure(result);
      setCachedData(cacheKey, result);
      await offlineDB.cacheFromServer("fee_structure", (data as unknown as Record<string, unknown>[]) || []);
    } catch (err) {
      const message = getErrorMessage(err, "Could not load fee structure");
      if (message.includes("Loading fees took too long")) {
        logger.warn("Fee structure refresh timed out; keeping saved fees when available");
        if (!hasPersistedFees) setError(message);
      } else {
        logger.error("Error fetching fee structure:", err);
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [schoolId, isDemo, isOnline, cacheKey]);

  const createFeeStructure = async (fee: {
    name: string;
    class_id?: string;
    amount: number;
    term: number | null;
    academic_year: string;
    due_date?: string;
    category?: string;
    boarding_status?: "day" | "boarding" | "both" | null;
    frequency?: "per_term" | "one_off" | "per_year";
    transport_zone?: string;
  }) => {
    const normalizedFee = normalizeFeeStructureInput(fee);
    const validationErrors = validateFeeStructureInput(normalizedFee);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors[0]);
    }

    const existingDuplicate = feeStructure.find(
      (existing) =>
        existing.name.trim().toLowerCase() === String(normalizedFee.name).trim().toLowerCase() &&
        (existing.class_id || null) === (normalizedFee.class_id || null) &&
        (existing.term ?? null) === normalizedFee.term &&
        existing.academic_year === normalizedFee.academic_year,
    );
    if (existingDuplicate) {
      throw new Error("A fee structure with the same name, class, term, and academic year already exists");
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
      setFeeStructure((prev) => [...prev, newFeeData as unknown as FeeStructure]);
      return newFeeData;
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    if (!querySchoolId) {
      throw new Error("Could not tell which school this fee belongs to. Please reload and try again.");
    }
    // Deleting a fee is a soft delete (deleted_at), and the unique constraint
    // (school_id, class_id, name, term, academic_year) knows nothing about
    // deleted_at. Re-adding a fee you had just deleted therefore collided with
    // the ghost row and failed with 23505 — the list showed nothing while the
    // database insisted it was still there. Revive the deleted row instead of
    // colliding with it, and leave a genuinely live duplicate to the insert so
    // it still reports the conflict it should.
    //
    // class_id is nullable and Postgres treats NULLs as distinct in a unique
    // index, so the match has to switch predicate rather than lean on equality
    // (which is also why an ON CONFLICT upsert could not have found the
    // all-classes row).
    let revived: PostgrestSingleResponse<FeeStructure> | null = null;
    try {
      const reviveQuery = supabase
        .from("fee_structure")
        .update({
          deleted_at: null,
          amount: normalizedFee.amount,
          due_date: normalizedFee.due_date || null,
          category: normalizedFee.category,
          boarding_status: normalizedFee.boarding_status,
          frequency: normalizedFee.frequency,
          transport_zone: normalizedFee.transport_zone,
        })
        .eq("school_id", querySchoolId)
        .eq("name", normalizedFee.name)
        .eq("academic_year", normalizedFee.academic_year)
        .not("deleted_at", "is", null);
      if (normalizedFee.term === null) reviveQuery.is("term", null);
      else reviveQuery.eq("term", normalizedFee.term);
      if (normalizedFee.class_id) reviveQuery.eq("class_id", normalizedFee.class_id);
      else reviveQuery.is("class_id", null);
      revived = await withTimeout(reviveQuery.select().single(), 15000, timeoutFallback<FeeStructure>());
    } catch {
      // A revive failure is not fatal — fall through to the insert, which
      // surfaces the real error if the row is genuinely still live.
      revived = null;
    }

    let result: PostgrestSingleResponse<FeeStructure> | null = null;
    if (revived && !isTimeoutResult(revived) && revived.data && !revived.error) {
      result = revived;
    } else {
      try {
        result = await withTimeout(
          supabase
            .from("fee_structure")
            .insert({
              school_id: querySchoolId,
              ...normalizedFee,
              class_id: normalizedFee.class_id || null,
              due_date: normalizedFee.due_date || null,
            })
            .select()
            .single(),
          15000,
          timeoutFallback<FeeStructure>(),
        );
      } catch (err) {
        throw new Error(getErrorMessage(err, "Failed to create fee"));
      }
    }

    // withTimeout swallows its own rejection and hands back the 408 fallback,
    // which has error: null. Without this branch the null row was pushed into
    // state and the page reported "Fee structure created" for a write that
    // never happened.
    if (isTimeoutResult(result)) {
      throw new Error("Saving the fee took too long. Check your connection and try again.");
    }

    const { data, error } = result;
    if (error) {
      if (error.code === "42501") {
        throw new Error("You do not have permission to set fees. Ask your headmaster or bursar to do it.");
      }
      if (error.code === "23505") {
        throw new Error("A fee with this name, class and term already exists.");
      }
      throw error;
    }
    if (!data) {
      throw new Error("The fee could not be saved. Please try again.");
    }
    setFeeStructure((prev) => [...prev, data]);
    invalidateCache(cacheKey);
    return data;
  };

  const deleteFeeStructure = async (id: string) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setFeeStructure((prev) => prev.filter((f) => f.id !== id));
      invalidateCache(cacheKey);
      return;
    }
    try {
      const result = await withTimeout(
        supabase
          .from("fee_structure")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id)
          .eq("school_id", schoolId),
        15000,
        timeoutFallback(),
      );
      if (isTimeoutResult(result)) throw new Error("Deleting the fee timed out. Please try again.");
      const { error: deleteError } = result;
      if (deleteError) throw deleteError;
      setFeeStructure((prev) => prev.filter((f) => f.id !== id));
      invalidateCache(cacheKey);
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const updateFeeStructure = async (id: string, fee: Parameters<typeof createFeeStructure>[0]) => {
    const normalized = normalizeFeeStructureInput(fee);
    const errors = validateFeeStructureInput(normalized);
    if (errors.length) throw new Error(errors[0]);
    const payload = { ...normalized, class_id: normalized.class_id || null, due_date: normalized.due_date || null };
    if (isDemo || isDemoSchool(schoolId)) {
      setFeeStructure((previous) => previous.map((item) => (item.id === id ? { ...item, ...payload } : item)));
      return;
    }
    if (!schoolId) throw new Error("Please reload your school session.");
    const result = await withTimeout(
      supabase.from("fee_structure").update(payload).eq("id", id).eq("school_id", schoolId).select().single(),
      15000,
      timeoutFallback(),
    );
    if (isTimeoutResult(result)) throw new Error("Saving the fee timed out. Please try again.");
    if (result.error) throw result.error;
    if (!result.data) throw new Error("The fee could not be saved.");
    setFeeStructure((previous) => previous.map((item) => (item.id === id ? (result.data as FeeStructure) : item)));
    invalidateCache(cacheKey);
  };

  useEffect(() => {
    fetchFeeStructure();
    hasInitialized.current = true;
  }, [fetchFeeStructure]);
  return {
    feeStructure,
    loading,
    error,
    createFeeStructure,
    updateFeeStructure,
    deleteFeeStructure,
    refetch: () => {
      invalidateCache(cacheKey);
      return fetchFeeStructure();
    },
  };
}

/** A student's shortfall at or above this amount counts as high-risk arrears. */
export const HIGH_RISK_ARREARS_THRESHOLD = 300000;

/** Head of the defaulter ranking returned by fee_summary(); the total is in
 *  FeeSummary.overdueCount / overdueBalance. */
export const MAX_RETURNED_DEFAULTERS = 20;

export interface FeeDefaulter {
  student_id: string;
  first_name: string | null;
  last_name: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  class_name: string | null;
  balance: number;
}

export interface FeeSummary {
  studentsCount: number;
  expectedTotal: number;
  collectedTotal: number;
  overdueCount: number;
  highRiskCount: number;
  thisMonthTotal: number;
  lastMonthTotal: number;
  /** Taken so far today, and how many payments made it up. A bursar checks this
   *  first thing in the morning and reports it to the head. */
  todayTotal: number;
  todayCount: number;
  /** Today's takings split by channel — mobile money dominates in Uganda and its
   *  alerts carry no student name, so this is what gets reconciled by hand. */
  todayByMethod: Record<string, number>;
  overdueBalance: number;
  defaulters: FeeDefaulter[];
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function normalizeDefaulters(value: unknown): FeeDefaulter[] {
  if (!Array.isArray(value)) return [];
  const rows: FeeDefaulter[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (r.student_id === null || r.student_id === undefined) continue;
    rows.push({
      student_id: String(r.student_id),
      first_name: toNullableString(r.first_name),
      last_name: toNullableString(r.last_name),
      parent_name: toNullableString(r.parent_name),
      parent_phone: toNullableString(r.parent_phone),
      class_name: toNullableString(r.class_name),
      balance: toNumber(r.balance),
    });
  }
  // fee_summary() already LIMITs, but never trust the payload's row count —
  // the panel only renders five and the file could be reused elsewhere.
  return rows.slice(0, MAX_RETURNED_DEFAULTERS);
}

/** Postgres NUMERIC/BIGINT arrive as JSON strings — normalise to real numbers. */
export function normalizeFeeSummary(row: unknown): FeeSummary | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (!("expected_total" in r)) return null;
  return {
    studentsCount: toNumber(r.students_count),
    expectedTotal: toNumber(r.expected_total),
    collectedTotal: toNumber(r.collected_total),
    overdueCount: toNumber(r.overdue_count),
    highRiskCount: toNumber(r.high_risk_count),
    thisMonthTotal: toNumber(r.this_month_total),
    lastMonthTotal: toNumber(r.last_month_total),
    // The RPC does not aggregate these; it is a term-level rollup, whereas
    // "today" is a narrow window the dashboard derives from the payments list
    // when the RPC is unavailable. Zero here so callers can fall back safely.
    todayTotal: 0,
    todayCount: 0,
    todayByMethod: {},
    overdueBalance: toNumber(r.overdue_balance),
    defaulters: normalizeDefaulters(r.defaulters),
  };
}

/**
 * The query-cache key for the fee_summary() RPC result. computeStats (the
 * dashboard-stats hook in analytics.ts) reads the same RPC under this key, so
 * when the Bursar panel and a dashboard mount in the same tick the second
 * caller finds the first one's in-flight promise instead of paying for the
 * call twice.
 */
export function feeSummaryCacheKey(schoolId?: string, term?: number | null, academicYear?: string | null): string {
  return `fee_summary:${schoolId}:${term ?? "all"}:${academicYear ?? "all"}`;
}

/** Thrown inside the summary fetcher when withTimeout hits its deadline, so
 *  nothing is cached and the panel keeps whatever it already holds. A plain
 *  module-level sentinel (not a message match) so a real RPC error with
 *  similar wording can never be mistaken for a timeout. */
const FEE_SUMMARY_TIMEOUT = new Error("fee_summary() timed out");

/**
 * Headline fee totals for the whole school, summed by the fee_summary()
 * database function in one round trip.
 *
 * The Bursar dashboard used to add these up in the browser from the first page
 * of students (100 rows) and payments (50 rows), so every school past those
 * limits reported the wrong money. Returns `null` whenever the RPC cannot
 * answer — demo mode, offline, a timeout, or a deployment where the migration
 * has not run yet — so callers fall back to the client-side computation
 * instead of rendering zeros.
 *
 * `term` / `academicYear` scope the figures to the term the dashboard header
 * names. Pass both to keep Expected and Collected on the same term; pass
 * neither to sum every fee the school has configured. The function degrades
 * on its own when the requested term has no fees that apply to anyone, so the
 * figures never drop to zero just because a term has not been set up yet.
 *
 * The RPC goes through revalidateShared under feeSummaryCacheKey: the panel
 * always re-reads (its own mutations must show up immediately) but concurrent
 * mounts — and the dashboard-stats hook below — join the same in-flight
 * promise instead of firing duplicate calls.
 */
export function useFeeSummary(schoolId?: string, term?: number | null, academicYear?: string | null) {
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDemo } = useAuth();
  const isOnline = useOnlineStatus();
  const prevIsDemo = useRef(isDemo);
  const cacheKey = feeSummaryCacheKey(schoolId, term, academicYear);

  useEffect(() => {
    if (prevIsDemo.current && !isDemo) {
      setSummary(null);
      setError(null);
    }
    prevIsDemo.current = isDemo;
  }, [isDemo]);

  const fetchSummary = useCallback(async () => {
    if (isDemo || isDemoSchool(schoolId) || !schoolId) {
      setSummary(null);
      setLoading(false);
      return;
    }

    const cached = getCachedData<FeeSummary>(cacheKey);
    if (cached) setSummary(cached);

    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    if (!querySchoolId || !isOnline) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const normalized = await revalidateShared<FeeSummary | null>(cacheKey, async () => {
        const result = await withTimeout(
          supabase
            .rpc("fee_summary", {
              p_school_id: querySchoolId,
              p_term: term ?? null,
              p_academic_year: academicYear ?? null,
            })
            .maybeSingle(),
          8000,
          timeoutFallback<FeeSummary>(),
        );
        // A deadline means the answer is UNKNOWN — throw the sentinel so the
        // rejection is never cached and whatever we already hold stays on
        // screen rather than being overwritten with an empty result.
        if (isTimeoutResult(result)) throw FEE_SUMMARY_TIMEOUT;
        if (result.error) throw result.error;
        return normalizeFeeSummary(result.data);
      });
      setSummary(normalized);
      setError(null);
    } catch (err: unknown) {
      // A timeout keeps the previous numbers with no error flag, exactly as
      // before — only real failures fall back to client-side totals.
      if (err === FEE_SUMMARY_TIMEOUT) return;
      logger.warn("[useFeeSummary] RPC unavailable, falling back to client totals:", err);
      setError(getErrorMessage(err, "Failed to load fee totals"));
    } finally {
      setLoading(false);
    }
  }, [schoolId, term, academicYear, isDemo, isOnline, cacheKey]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, refetch: fetchSummary };
}

export function useFeeAdjustments(schoolId?: string) {
  const [adjustments, setAdjustments] = useState<FeeAdjustment[]>([]);
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

    const cached = getCachedData<FeeAdjustment[]>(cacheKey);
    if (cached) {
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
        setAdjustments(cached as unknown as FeeAdjustment[]);
        setLoading(false);
        return;
      }
      const data = await withTimeout(
        supabase
          .from("fee_adjustments")
          .select("*")
          .eq("school_id", querySchoolId)
          .order("created_at", { ascending: false })
          .then(async (r) => {
            if (r.error) {
              // deleted_at column may not exist in older schemas — retry without it
              if (r.error.code === "42703" && r.error.message?.includes("deleted_at")) {
                const fallback = await supabase
                  .from("fee_adjustments")
                  .select("*")
                  .eq("school_id", querySchoolId)
                  .order("created_at", { ascending: false });
                if (fallback.error) throw fallback.error;
                return fallback.data;
              }
              throw r.error;
            }
            // Filter out soft-deleted records in JS if column exists
            return (r.data || []).filter((a: Record<string, unknown>) => !a.deleted_at);
          }),
        5000,
        [] as unknown as FeeAdjustment[],
      );
      const result = data || [];
      setAdjustments(result);
      setCachedData(cacheKey, result);
      await offlineDB.cacheFromServer("fee_adjustments", (data || []) as Record<string, unknown>[]);
    } catch (err) {
      logger.error("Error fetching adjustments:", err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, isDemo, isOnline, cacheKey]);

  const createAdjustment = async (adj: {
    student_id: string;
    adjustment_type: "scholarship" | "discount" | "penalty" | "manual_credit" | "write_off" | "bursary" | "amnesty";
    amount: number;
    description?: string;
    /**
     * Fee line the adjustment applies to. Omitted means the whole bill, which
     * is right for a write-off or amnesty and the previous behaviour for every
     * adjustment.
     */
    fee_id?: string;
  }) => {
    const validationErrors = validateAdjustment(adj);
    if (validationErrors.length > 0) {
      logger.error("Fee adjustment validation failed:", validationErrors);
      throw new Error(validationErrors.join(", "));
    }
    if (isDemo || isDemoSchool(schoolId)) {
      const mappedType =
        adj.adjustment_type === "write_off" || adj.adjustment_type === "amnesty"
          ? "manual_credit"
          : adj.adjustment_type === "bursary"
            ? "discount"
            : adj.adjustment_type;
      const newAdj = {
        student_id: adj.student_id,
        adjustment_type: mappedType,
        amount: adj.amount,
        notes: adj.description,
        fee_id: adj.fee_id || null,
        id: `demo-adj-${Date.now()}`,
        school_id: schoolId || "00000000-0000-0000-0000-000000000001",
        recorded_by: user?.id,
        created_at: new Date().toISOString(),
      } satisfies FeeAdjustment;
      setAdjustments((prev) => [newAdj, ...prev]);
      invalidateCache(cacheKey);
      return newAdj;
    }
    const querySchoolId = getQuerySchoolId(schoolId, isDemo);
    const mappedType =
      adj.adjustment_type === "write_off" || adj.adjustment_type === "amnesty"
        ? "manual_credit"
        : adj.adjustment_type === "bursary"
          ? "discount"
          : adj.adjustment_type;
    const payload = {
      student_id: adj.student_id,
      adjustment_type: mappedType,
      amount: adj.amount,
      notes: adj.description,
      // Undefined rather than "": "" would write an empty string into a UUID
      // column and fail the insert, and this column is nullable on purpose.
      ...(adj.fee_id ? { fee_id: adj.fee_id } : {}),
      school_id: querySchoolId,
      recorded_by: user?.id,
    };

    // A discount on meals and a discount on tuition are two different
    // concessions; the same discount on the same fee twice is a data-entry
    // slip. This can only be checked online -- the offline queue is written
    // before the server has seen anything -- so offline entries may still
    // collide, and the unique index will reject the sync rather than silently
    // double-counting.
    if (isOnline && adj.fee_id) {
      const { data: clash } = await withTimeout(
        supabase
          .from("fee_adjustments")
          .select("id, adjustment_type, amount")
          .eq("school_id", querySchoolId)
          .eq("student_id", adj.student_id)
          .eq("fee_id", adj.fee_id)
          .limit(1),
        10000,
        timeoutFallback(),
      );
      if (clash && clash.length > 0) {
        throw new Error("This pupil already has an adjustment on that fee. Change the amount on the existing one.");
      }
    }

    if (!isOnline) {
      const offlineSaved = await offlineDB.save("fee_adjustments", payload as unknown as Record<string, unknown>);
      const offlineAdjustment = {
        ...payload,
        id: String(offlineSaved.id || `offline-adjustment-${Date.now()}`),
        created_at: new Date().toISOString(),
      } as FeeAdjustment;
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
      const { data, error } = await withTimeout(
        supabase.from("fee_adjustments").insert(payload).select().single(),
        15000,
        timeoutFallback(),
      );
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
      const { error: deleteError } = await withTimeout(
        supabase.from("fee_adjustments").update(payload).eq("id", id),
        15000,
        timeoutFallback(),
      );
      if (deleteError) {
        // deleted_at may not exist yet — fall back to hard delete
        if (deleteError.code === "42703" && deleteError.message?.includes("deleted_at")) {
          const { error: hardDeleteError } = await withTimeout(
            supabase.from("fee_adjustments").delete().eq("id", id),
            15000,
            timeoutFallback(),
          );
          if (hardDeleteError) throw hardDeleteError;
        } else {
          throw deleteError;
        }
      }
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
      const { data, error } = await withTimeout(
        supabase
          .from("budgets")
          .insert({ ...budget, school_id: querySchoolId })
          .select()
          .single(),
        15000,
        timeoutFallback(),
      );
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
      const { data, error } = await withTimeout(
        supabase
          .from("expenses")
          .insert({ ...expense, school_id: querySchoolId })
          .select()
          .single(),
        15000,
        timeoutFallback(),
      );
      if (error) throw error;
      setExpenses((prev) => [data, ...prev]);
      return data;
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  const updateExpenseStatus = async (id: string, status: string) => {
    if (isDemo || isDemoSchool(schoolId)) {
      setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
      return { id, status };
    }
    try {
      const { data, error } = await withTimeout(
        supabase.from("expenses").update({ status }).eq("id", id).select().single(),
        15000,
        timeoutFallback(),
      );
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
        setBudgets(DEMO_BUDGETS as unknown as DemoExpense[]);
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
            .select("id, school_id, name, total_budget, term, academic_year, created_at")
            .eq("school_id", querySchoolId)
            .order("created_at", { ascending: false }),
          supabase
            .from("expenses")
            .select("id, school_id, budget_id, amount, description, expense_date, status, created_at")
            .eq("school_id", querySchoolId)
            .order("expense_date", { ascending: false }),
        ]);
        setBudgets(budgetsRes.data || []);
        setExpenses(expensesRes.data || []);
      } catch (err) {
        logger.error("Error fetching budget:", err);
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

/**
 * Parent names per pupil, for the "paid by" field on a payment.
 *
 * Recording a payment means typing who handed over the money, which is almost
 * always the parent already on file. That was pure typing on every payment, and
 * the same name spelled differently each time is exactly what makes a cashbook
 * hard to reconcile later.
 *
 * Only runs while online and only for staff, because RLS on parent_students
 * restricts it to the pupils in the caller's own school. Offline it resolves to
 * an empty map, which leaves the field as a normal typed input -- a bursar with
 * no signal is worse off guessing than typing.
 */
export function usePaymentParentNames(schoolId?: string): Record<string, string[]> {
  const { isDemo } = useAuth();
  const isOnline = useOnlineStatus();
  const [byStudent, setByStudent] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!schoolId || isDemoSchool(schoolId) || !isOnline) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.from("parent_students").select("student_id, parent:parent_id (id, full_name, phone)").limit(5000),
          15000,
          timeoutFallback(),
        );
        if (cancelled || error || !data) return;

        // A pupil can have more than one parent on file. Keep them all, ordered
        // so the list is stable, and let the caller offer a choice rather than
        // silently picking one.
        const grouped: Record<string, string[]> = {};
        for (const row of data as unknown as Array<{
          student_id: string | null;
          parent: { full_name?: string | null } | { id: string; full_name?: string | null }[] | null;
        }>) {
          if (!row.student_id) continue;
          const parent = Array.isArray(row.parent) ? row.parent[0] : row.parent;
          const name = parent?.full_name?.trim();
          if (!name) continue;
          grouped[row.student_id] = [...new Set([...(grouped[row.student_id] ?? []), name])].sort();
        }
        if (!cancelled) setByStudent(grouped);
      } catch (err) {
        logger.warn("[Fees] Could not load parent names for payments", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [schoolId, isOnline]);

  return byStudent;
}

/**
 * Turn a database error into something a bursar can act on.
 *
 * PostgREST surfaces Postgres error text verbatim, so a unique-constraint
 * violation arrived at the payment form as "duplicate key value violates unique
 * constraint idx_fee_payments_reference" -- an index name, not an instruction.
 */
export function translateFeePaymentError(error: unknown): Error {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message ?? "";
  if (code === "23505" && message.includes("fee_payments")) {
    if (message.includes("reference")) {
      return new Error(
        "That payment reference has already been used. Check the number, or clear the reference if this payment has none.",
      );
    }
    return new Error("This payment has already been recorded. Refresh to see it.");
  }
  if (code === "23505") {
    return new Error("This payment has already been recorded. Refresh to see it.");
  }
  return error instanceof Error ? error : new Error(message || "The payment could not be saved.");
}

/**
 * A payment reference for when nobody supplied one.
 *
 * Shaped so a bursar can read it back over the phone to a parent: the school's
 * own code, the date, then enough randomness that two payments recorded in the
 * same second cannot collide. The random part is what makes it a poor guess to
 * type by hand, which is the point -- these are machine references, and a
 * school using its own receipt book types over it.
 *
 * Deliberately not derived from the amount, the pupil, or the payer: those
 * repeat, and a reference that repeats is a reference that gets rejected.
 */
export function generatePaymentReference(schoolCode?: string | null, now: Date = new Date()): string {
  const prefix =
    (schoolCode || "PAY")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 8)
      .toUpperCase() || "PAY";
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  // Four bytes, six characters.
  //
  // crypto.getRandomValues avoids Math.random's collisions under load. The
  // width matters too: an earlier version took five characters of three bytes,
  // which silently clipped the last byte to a single base-36 character and left
  // about 46,000 possibilities. Two thousand draws in one second then produced
  // five collisions. Six characters of four bytes is roughly 16.7 million, so a
  // clash stops being something a bursar meets.
  const bytes = new Uint8Array(4);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  const tail = Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 6)
    .toUpperCase();
  return `${prefix}-${y}${m}${d}-${tail}`;
}
