export const PREPARATION_EVENT = "skoolmate:offline-preparation";
export const PREPARE_EVENT = "skoolmate:prepare-offline";
export interface Preparation {
  at: number;
  running: boolean;
  tables: Record<string, { rows: number; total: number | null; complete: boolean }>;
  errors: string[];
}
export function preparationKey(userId: string, schoolId: string): string {
  return `skoolmate:preparation:${userId}:${schoolId}`;
}
export function readPreparation(key: string): Preparation | null {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") as Preparation | null;
  } catch {
    return null;
  }
}
export function savePreparation(key: string, preparation: Preparation): void {
  try {
    localStorage.setItem(key, JSON.stringify(preparation));
  } catch {
    /* UI still receives progress. */
  }
  window.dispatchEvent(new CustomEvent(PREPARATION_EVENT, { detail: { key, preparation } }));
}
