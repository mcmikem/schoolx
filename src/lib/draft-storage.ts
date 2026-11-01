/** Small per-user, per-task drafts. Writes are synchronous so an Android process
 * termination cannot race an unload handler. Never report a failed write as saved. */
export function readDraft<T>(key: string, maxAge = 7 * 24 * 60 * 60 * 1000): T | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && Date.now() - value.at < maxAge ? (value.data as T) : null;
  } catch {
    return null;
  }
}
export function writeDraft<T>(key: string, data: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
    return true;
  } catch {
    return false;
  }
}
export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Keep a recoverable draft. */
  }
}
