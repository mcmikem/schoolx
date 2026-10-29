/**
 * Helpers shared by the offline queue and the sync API.
 *
 * Both paths replay the same queued rows. Keeping the payload shaping and the
 * "did this already land?" comparison in one place means a fix to either side
 * cannot drift from the other.
 */

export const LOCAL_ONLY_SYNC_KEYS = ["updated_at", "isDemo", "schoolId", "pending_wallet_deduction"] as const;

const LOCAL_ONLY = new Set<string>(LOCAL_ONLY_SYNC_KEYS);

/**
 * Remove keys that exist only on the phone.
 *
 * offlineDB.save() stamps every row with updated_at and callers pass client
 * flags alongside it. Sending any of these to PostgREST makes it reject the
 * write with PGRST204 (unknown column).
 */
export function stripLocalOnlySyncKeys(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!LOCAL_ONLY.has(key)) result[key] = value;
  }
  return result;
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || left === undefined || right === null || right === undefined) {
    return (left ?? null) === (right ?? null);
  }
  if (typeof left === "number" || typeof right === "number") {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber;
  }
  if (typeof left === "object" || typeof right === "object") {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }
  return String(left) === String(right);
}

/**
 * Has this queued write already reached the server?
 *
 * A committed write whose response never made it back to the phone leaves the
 * queue item pending. Replaying it used to be misread as a conflict whenever
 * the server's updated_at trigger had moved past the local stamp, which parked
 * work that had, in fact, saved. Comparing the fields we sent against the row
 * that is actually there answers the real question: is the server already in
 * the state this write asked for?
 *
 * Identity and server-managed columns are ignored: they cannot tell us whether
 * the write landed.
 */
export function payloadMatchesServerRow(
  payload: Record<string, unknown>,
  serverRow: Record<string, unknown> | null | undefined,
): boolean {
  if (!serverRow) return false;

  const ignored = new Set<string>(["id", "created_at", "updated_at", ...LOCAL_ONLY]);
  const entries = Object.entries(payload).filter(([key, value]) => !ignored.has(key) && value !== undefined);

  if (entries.length === 0) return false;

  return entries.every(([key, value]) => key in serverRow && sameValue(value, serverRow[key]));
}
