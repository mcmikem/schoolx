// Lightweight Supabase client helpers.
// IMPORTANT: this module must NOT import @supabase/supabase-js (or anything that
// pulls it in) at the top level. Modules that use dynamic `import()` for the
// Supabase client (e.g. src/lib/africas-talking.ts) depend on being able to load
// these helpers without triggering a top-level supabase-js import, which breaks
// jest.mock()-based test mocks.

export const SUPABASE_DEFAULT_TIMEOUT_MS = 30000;

// Storage transfers are bounded by bytes on the wire, not by round-trips. A
// 5MB photo at the ~130KB/s this project actually sees takes ~40s to PUT, so
// the blanket 30s budget cut every large photo upload off with a bare
// AbortError that read to the user as "fetch is aborted". Queries and RPC
// calls still get the short budget — they are request/response, so exceeding
// it really does mean the call is stuck.
export const SUPABASE_STORAGE_TIMEOUT_MS = 120000;

const STORAGE_PATH_MARKER = "/storage/v1/";

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input?.url ?? "";
}

/** The budget for one call: file transfers get the long one, everything else
 *  keeps the short one, and an explicitly larger caller timeout always wins. */
export function timeoutForRequest(input: RequestInfo | URL, defaultTimeout = SUPABASE_DEFAULT_TIMEOUT_MS): number {
  if (!requestUrl(input).includes(STORAGE_PATH_MARKER)) return defaultTimeout;
  return Math.max(defaultTimeout, SUPABASE_STORAGE_TIMEOUT_MS);
}

/** An abort that names itself. Chrome renders a reason-less `abort()` as
 *  "signal is aborted without reason", so a timed-out query reached the console
 *  with no explanation at all. The `name` stays "AbortError" because
 *  `super-admin/_shared.ts`, `register/page.tsx` and `isSupabaseLockAbortError`
 *  all branch on it — only the message is added. */
function abortReason(message: string): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function createFetchWithTimeout(
  defaultTimeout = SUPABASE_DEFAULT_TIMEOUT_MS,
  baseFetch: FetchLike = (input, init) => fetch(input, init),
) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const callerSignal = init?.signal;
    const budget = timeoutForRequest(input, defaultTimeout);

    const onCallerAbort = () => controller.abort(callerSignal?.reason ?? abortReason("Request aborted by caller."));

    // A signal that is *already* aborted never fires a freshly-added "abort"
    // listener, so the abort has to be propagated here. Otherwise the request
    // ignored the caller and ran on to the full 30s timeout.
    if (callerSignal?.aborted) {
      controller.abort(callerSignal.reason);
    } else {
      callerSignal?.addEventListener("abort", onCallerAbort, { once: true });
    }

    const timeoutId = setTimeout(() => {
      controller.abort(abortReason(`Supabase request timed out after ${budget}ms.`));
    }, budget);

    return baseFetch(input, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timeoutId);
      // Otherwise a long-lived caller signal accumulates one listener per call.
      callerSignal?.removeEventListener("abort", onCallerAbort);
    });
  };
}

/** Builds Supabase client options with a fetch-level timeout so every query, insert,
 *  update, RPC and storage call aborts instead of hanging forever. Merges with any
 *  existing `global` options (e.g. per-request auth headers). */
export function supabaseClientOptions<T extends object = object>(
  options?: T,
  timeoutMs = SUPABASE_DEFAULT_TIMEOUT_MS,
): T & { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> } } {
  const existingGlobal = (options as { global?: Record<string, unknown> } | undefined)?.global;
  // Compose instead of replacing: the browser client installs an offline cache
  // in `global.fetch`, and the timeout must still wrap it. Replacing dropped
  // the cache entirely, so every page went back to network-only reads.
  const existingFetch = existingGlobal?.fetch;
  const fetchImpl =
    typeof existingFetch === "function"
      ? (existingFetch as FetchLike)
      : (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init);
  return {
    ...options,
    global: {
      ...(existingGlobal ?? {}),
      fetch: createFetchWithTimeout(timeoutMs, fetchImpl),
    },
  } as T & { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> } };
}
