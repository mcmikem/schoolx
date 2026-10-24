// Recovery from a half-updated build.
//
// A service worker can hand back the previous deploy's HTML while the server
// already serves the new chunks. The document then asks for a module that no
// longer exists, boot fails, and the error screen's "Try Again" just re-renders
// the same broken tree. Clearing the worker + caches and reloading is the only
// in-app way out, so the error screens call this instead of leaving the user to
// hunt through Android settings.

const RECOVERY_KEY = "skoolmate-stale-build-recovery";
const RECOVERY_COOLDOWN_MS = 10 * 60 * 1000;

const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk [\w./-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|MIME type of .*text\/html/i;

export function isChunkLoadError(error: unknown): boolean {
  const value = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  return CHUNK_ERROR_PATTERN.test(value);
}

export async function clearAppCaches(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // Best effort: cache deletion below is the part that matters.
  }

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("skoolmate-")).map((key) => caches.delete(key)));
    }
  } catch {
    // A browser that blocks the Cache API cannot be helped further.
  }
}

/**
 * One automatic recovery per 10 minutes per tab. Without the guard a genuine
 * server outage (every chunk 500s) would reload the page in a loop.
 */
export function claimStaleBuildRecovery(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(window.sessionStorage.getItem(RECOVERY_KEY) || 0);
    if (Number.isFinite(last) && Date.now() - last < RECOVERY_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

export async function recoverFromStaleBuild(): Promise<void> {
  await clearAppCaches();
  window.location.reload();
}

/** Returns true when a recovery reload was started, false for other errors. */
export async function retryStaleBuildOnce(error: unknown): Promise<boolean> {
  if (!isChunkLoadError(error)) return false;
  if (!claimStaleBuildRecovery()) return false;
  await recoverFromStaleBuild();
  return true;
}

export const BUILD_RECOVERY_COOLDOWN_MS = RECOVERY_COOLDOWN_MS;
