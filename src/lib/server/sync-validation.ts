// Shared sync validation. Used by both /api/sync/route.ts and unit tests so
// tests exercise the real production logic instead of a local copy.

export const SYNC_VALID_TABLES = [
  "students",
  "classes",
  "subjects",
  "attendance",
  "grades",
  "fee_payments",
  "fee_structure",
  "fee_adjustments",
  "messages",
  "events",
  "timetable",
];

export const SYNC_VALID_ACTIONS = ["create", "update", "delete"] as const;

export const SYNC_MAX_ITEMS = 100;

export interface SyncValidationItem {
  id: string;
  table: string;
  action: string;
  data: unknown;
}

export function validateSyncItem(item: SyncValidationItem): string[] {
  const errors: string[] = [];
  if (!item.id) errors.push("id required");
  if (!item.table) errors.push("table required");
  if (!item.action) errors.push("action required");
  if (!item.data) errors.push("data required");
  return errors;
}

export function isValidSyncTable(table: string): boolean {
  return SYNC_VALID_TABLES.includes(table);
}

export function isValidSyncAction(action: string): boolean {
  return (SYNC_VALID_ACTIONS as readonly string[]).includes(action);
}

export function isValidSyncData(data: unknown): boolean {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
