import type { FeeStructure } from "@/types";

/**
 * A class filter also shows whole-school fees (`class_id` null), because those
 * charges apply to every class. An empty filter shows everything.
 */
export function feeMatchesClass(fee: { class_id?: string | null }, classId: string): boolean {
  return !classId || !fee.class_id || fee.class_id === classId;
}

export interface FeeStructureFilter {
  q?: string;
  classId?: string;
}

export function filterFeeStructure(
  fees: FeeStructure[],
  { q = "", classId = "" }: FeeStructureFilter = {},
): FeeStructure[] {
  const needle = q.trim().toLowerCase();
  return fees.filter((fee) => feeMatchesClass(fee, classId) && (!needle || fee.name.toLowerCase().includes(needle)));
}
