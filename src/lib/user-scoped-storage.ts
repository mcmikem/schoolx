/**
 * Per-user namespacing for anything kept in localStorage.
 *
 * Schools share hardware constantly: one tablet in the staff room passed round
 * the class, one laptop in the headmaster's office, a kiosk in the bursar's
 * corner. Keys like `skoolmate_recent_pages` and `skoolmate_owly_messages_v1`
 * used to be global, so signing out and signing in as somebody else handed
 * them the previous person's state — including a full assistant transcript,
 * which is not filtered by role at all.
 *
 * Clearing on sign-out alone is not enough. Sessions end in ways that never run
 * sign-out: the 30-minute timeout, a closed tab, an expired cookie, a crashed
 * kiosk. Scoping the key itself means a stale key is simply never read by
 * anyone else. Sign-out clearing (see `USER_SCOPED_PREFIXES`) stays as well, as
 * defence in depth.
 *
 * The suffix is the stable auth user id, never a display name — names contain
 * spaces, change, and collide between siblings.
 */

const SCOPE_SEPARATOR = "::";

/**
 * Namespace a base key to one user. With no user resolved there is nothing
 * trustworthy to attach the data to, so callers get a key they must treat as
 * scratch space rather than a shared bucket. Returning a *distinct* name (and
 * not the bare base key) is deliberate: an anonymous visitor must never read
 * another account's leftovers.
 */
export function userScopedKey(baseKey: string, userId: string | null | undefined): string {
  if (!userId) return `${baseKey}${SCOPE_SEPARATOR}anonymous`;
  return `${baseKey}${SCOPE_SEPARATOR}${userId}`;
}

/**
 * Every base key that holds per-user state. Sign-out walks this list and drops
 * each user's namespace.
 *
 * Keep in sync with the `userScopedKey` call sites — a key added there but not
 * here survives sign-out on a shared device.
 */
export const USER_SCOPED_PREFIXES = [
  "skoolmate_recent_pages",
  "assemble_recent_pages",
  "skoolmate_owly_messages_v1",
] as const;

/**
 * Drop every per-user namespace. Called on sign-out so the next person to use
 * the device inherits nothing.
 *
 * Iterates localStorage by key rather than trusting a remembered id list:
 * namespaces from earlier sessions (before this module existed) are otherwise
 * unreachable and would linger for years.
 */
export function clearUserScopedStorage(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.includes(SCOPE_SEPARATOR)) continue;
      const base = key.slice(0, key.lastIndexOf(SCOPE_SEPARATOR));
      if ((USER_SCOPED_PREFIXES as readonly string[]).includes(base)) doomed.push(key);
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    // Private mode / storage disabled — nothing to clear.
  }
}

/**
 * Read a scoped value as JSON, and sweep the previous account's copy while
 * we're here. Migration path: a key written before scoping cannot be trusted
 * (it may belong to another user), so it is dropped rather than adopted.
 */
export function readUserScoped<T>(baseKey: string, userId: string | null | undefined): T | null {
  try {
    const stored = localStorage.getItem(userScopedKey(baseKey, userId));
    if (stored === null) {
      // Clear any pre-scoping leftovers so they cannot resurface later.
      localStorage.removeItem(baseKey);
      return null;
    }
    return JSON.parse(stored) as T;
  } catch {
    return null;
  }
}

/** Write a scoped JSON value. Fails silently if storage is unavailable. */
export function writeUserScoped(baseKey: string, userId: string | null | undefined, value: unknown): void {
  try {
    localStorage.setItem(userScopedKey(baseKey, userId), JSON.stringify(value));
  } catch {
    // Storage full / private mode. The feature degrades, the app does not break.
  }
}