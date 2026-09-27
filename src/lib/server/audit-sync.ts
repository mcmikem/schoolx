/**
 * Sanitising builder for audit_log rows replayed from an offline client.
 *
 * Audit events are queued locally when the device reports itself offline, then
 * replayed through /api/sync. That endpoint runs with the service role, which
 * bypasses RLS, so it must never insert a row exactly as the client sent it --
 * otherwise any caller could forge who did something.
 *
 * Identity is therefore taken from the verified server session, never the
 * payload. The client keeps control only of what happened, not of who it is
 * claimed to have happened to.
 */

export const AUDIT_ACTIONS = ["create", "update", "delete", "view", "login", "logout"] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// The table's own limits, mirrored here so a hostile payload cannot force
// unbounded rows into the audit trail.
const MAX_MODULE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_RECORD_ID_LENGTH = 200;

export interface AuditInsertRow {
  school_id: string;
  user_id: string | null;
  user_name: string | null;
  action: AuditAction;
  module: string;
  description: string | null;
  record_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export type AuditRowResult = { ok: true; row: AuditInsertRow } | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function optionalString(value: unknown, max: number): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return truncate(value, max);
}

function optionalJson(value: unknown): Record<string, unknown> | null {
  return isPlainObject(value) ? value : null;
}

export function buildAuditInsertRow(params: {
  data: Record<string, unknown>;
  schoolId: string;
  userId: string | null;
  userName: string | null;
}): AuditRowResult {
  const { data, schoolId, userId, userName } = params;

  const action = data.action;
  if (typeof action !== "string" || !AUDIT_ACTIONS.includes(action as AuditAction)) {
    return { ok: false, error: "Invalid audit action" };
  }

  const module = data.module;
  if (typeof module !== "string" || module.length === 0) {
    return { ok: false, error: "Missing audit module" };
  }

  // The event happened while the device was offline, so trust the client's
  // timestamp -- but only if it is a real, plausible date. Fall back to now.
  let createdAt = new Date().toISOString();
  if (typeof data.created_at === "string") {
    const parsed = new Date(data.created_at);
    if (!Number.isNaN(parsed.getTime())) createdAt = parsed.toISOString();
  }

  return {
    ok: true,
    row: {
      // Identity is server-derived; the client's values are discarded.
      school_id: schoolId,
      user_id: userId,
      user_name: userName,
      action: action as AuditAction,
      module: truncate(module, MAX_MODULE_LENGTH),
      description: optionalString(data.description, MAX_DESCRIPTION_LENGTH),
      record_id: optionalString(data.record_id, MAX_RECORD_ID_LENGTH),
      old_value: optionalJson(data.old_value),
      new_value: optionalJson(data.new_value),
      created_at: createdAt,
    },
  };
}
