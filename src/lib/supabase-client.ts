// Lightweight Supabase client helpers.
// IMPORTANT: this module must NOT import @supabase/supabase-js (or anything that
// pulls it in) at the top level. Modules that use dynamic `import()` for the
// Supabase client (e.g. src/lib/africas-talking.ts) depend on being able to load
// these helpers without triggering a top-level supabase-js import, which breaks
// jest.mock()-based test mocks.

export const SUPABASE_DEFAULT_TIMEOUT_MS = 30000;

export function createFetchWithTimeout(defaultTimeout = SUPABASE_DEFAULT_TIMEOUT_MS) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), defaultTimeout);
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
