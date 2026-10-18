"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { useOnlineStatus } from "@/lib/offline";
import { logger } from "@/lib/logger";
import type { UnebRemittanceStatus } from "@/lib/uneb-quarantine";

/**
 * Read/write access to the UNEB remittance ledger.
 *
 * The table existed since the bursar finance upgrade but no screen used it, so
 * the quarantined UNEB liability was invisible. This is the first consumer.
 */

export interface UnebRemittanceRow {
  id: string;
  school_id: string;
  academic_year: string;
  level: string;
  invoice_number: string | null;
  amount_invoiced: number;
  amount_collected: number;
  amount_remitted: number;
  remitted_on: string | null;
  bank_reference: string | null;
  status: UnebRemittanceStatus;
  notes: string | null;
  created_at: string;
}

export interface UnebRemittanceInput {
  academic_year: string;
  level: string;
  invoice_number?: string | null;
  amount_invoiced?: number;
  amount_collected?: number;
  amount_remitted?: number;
  remitted_on?: string | null;
  bank_reference?: string | null;
  notes?: string | null;
}

function deriveStatus(invoiced: number, remitted: number, collected: number): UnebRemittanceStatus {
  if (remitted <= 0) return "open";
  if (remitted >= invoiced && invoiced > 0) return "remitted";
  if (remitted >= collected && collected > 0) return "remitted";
  return "part_remitted";
}

const COLUMNS =
  "id, school_id, academic_year, level, invoice_number, amount_invoiced, amount_collected, amount_remitted, remitted_on, bank_reference, status, notes, created_at";

export function useUnebRemittances(schoolId?: string) {
  const [remittances, setRemittances] = useState<UnebRemittanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  const load = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await withTimeout(
        supabase
          .from("uneb_remittances")
          .select(COLUMNS)
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false }),
        15000,
        timeoutFallback<UnebRemittanceRow[]>(),
      );
      const err = (res as { error?: unknown }).error;
      if (err) throw err;
      setRemittances((res as { data?: UnebRemittanceRow[] }).data ?? []);
    } catch (err) {
      logger.warn("[useUnebRemittances] load failed:", err);
      setError("Could not load the UNEB ledger. Showing what was already on hand.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (isOnline) void load();
    else setLoading(false);
  }, [load, isOnline]);

  const addRemittance = useCallback(
    async (input: UnebRemittanceInput) => {
      if (!schoolId) throw new Error("No school selected");
      const invoiced = Number(input.amount_invoiced || 0);
      const collected = Number(input.amount_collected || 0);
      const remitted = Number(input.amount_remitted || 0);
      const row = {
        school_id: schoolId,
        academic_year: input.academic_year,
        level: input.level,
        invoice_number: input.invoice_number ?? null,
        amount_invoiced: invoiced,
        amount_collected: collected,
        amount_remitted: remitted,
        remitted_on: input.remitted_on ?? null,
        bank_reference: input.bank_reference ?? null,
        notes: input.notes ?? null,
        status: deriveStatus(invoiced, remitted, collected),
      };
      const { data, error } = await withTimeout(
        supabase.from("uneb_remittances").insert(row).select(COLUMNS).single(),
        15000,
        timeoutFallback(),
      );
      if (error) throw error;
      setRemittances((prev) => [data as UnebRemittanceRow, ...prev]);
      return data as UnebRemittanceRow;
    },
    [schoolId],
  );

  const updateRemittance = useCallback(async (id: string, patch: Partial<UnebRemittanceInput>) => {
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const { data, error } = await withTimeout(
      supabase.from("uneb_remittances").update(clean).eq("id", id).select(COLUMNS).single(),
      15000,
      timeoutFallback(),
    );
    if (error) throw error;
    const updated = data as UnebRemittanceRow;
    if (updated) {
      const status = deriveStatus(
        Number(updated.amount_invoiced || 0),
        Number(updated.amount_remitted || 0),
        Number(updated.amount_collected || 0),
      );
      if (status !== updated.status) {
        await withTimeout(supabase.from("uneb_remittances").update({ status }).eq("id", id), 15000, timeoutFallback());
        updated.status = status;
      }
    }
    setRemittances((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  return { remittances, loading, error, refetch: load, addRemittance, updateRemittance };
}
