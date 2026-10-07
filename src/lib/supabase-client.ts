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

export function createFetchWithTimeout(defaultTimeout = SUPABASE_DEFAULT_TIMEOUT_MS) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutForRequest(input, defaultTimeout));
    const signal = init?.signal;
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timeoutId);
        controller.abort();
      });
    }
    return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
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
  return {
    ...options,
    global: {
      ...(existingGlobal ?? {}),
      fetch: createFetchWithTimeout(timeoutMs),
    },
  } as T & { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> } };
}
