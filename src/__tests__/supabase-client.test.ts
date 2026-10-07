import {
  createFetchWithTimeout,
  timeoutForRequest,
  SUPABASE_DEFAULT_TIMEOUT_MS,
  SUPABASE_STORAGE_TIMEOUT_MS,
} from "@/lib/supabase-client";

const REST_URL = "https://example.supabase.co/rest/v1/students?select=id";
const RPC_URL = "https://example.supabase.co/rpc/fee_summary";
const AUTH_URL = "https://example.supabase.co/auth/v1/token?grant_type=password";
const STORAGE_UPLOAD_URL =
  "https://example.supabase.co/storage/v1/object/student-photos/school-1/students/student-1.jpg";

function abortError() {
  const error = new Error("The user aborted a request.");
  error.name = "AbortError";
  return error;
}

describe("timeoutForRequest", () => {
  it("keeps request/response calls on the short budget", () => {
    expect(timeoutForRequest(REST_URL)).toBe(SUPABASE_DEFAULT_TIMEOUT_MS);
    expect(timeoutForRequest(RPC_URL)).toBe(SUPABASE_DEFAULT_TIMEOUT_MS);
    expect(timeoutForRequest(AUTH_URL)).toBe(SUPABASE_DEFAULT_TIMEOUT_MS);
  });

  it("gives file transfers the long budget", () => {
    expect(timeoutForRequest(STORAGE_UPLOAD_URL)).toBe(SUPABASE_STORAGE_TIMEOUT_MS);
    expect(timeoutForRequest(new URL(STORAGE_UPLOAD_URL))).toBe(SUPABASE_STORAGE_TIMEOUT_MS);
  });

  it("never shortens an explicitly larger caller budget", () => {
    expect(timeoutForRequest(STORAGE_UPLOAD_URL, 300000)).toBe(300000);
    expect(timeoutForRequest(REST_URL, 5000)).toBe(5000);
  });
});

describe("createFetchWithTimeout", () => {
  let signals: AbortSignal[] = [];

  beforeEach(() => {
    jest.useFakeTimers();
    signals = [];
    global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;
      if (signal) signals.push(signal);
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(abortError()));
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("still abandons a stuck query after 30 seconds", async () => {
    const doFetch = createFetchWithTimeout();
    const pending = doFetch(REST_URL, { method: "GET" });
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });

    jest.advanceTimersByTime(SUPABASE_DEFAULT_TIMEOUT_MS - 1);
    expect(signals[0].aborted).toBe(false);

    jest.advanceTimersByTime(1);
    expect(signals[0].aborted).toBe(true);
    await assertion;
  });

  it("lets a photo upload keep going past 30 seconds", async () => {
    const doFetch = createFetchWithTimeout();
    const pending = doFetch(STORAGE_UPLOAD_URL, { method: "POST" });
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });

    jest.advanceTimersByTime(SUPABASE_DEFAULT_TIMEOUT_MS);
    expect(signals[0].aborted).toBe(false);

    jest.advanceTimersByTime(SUPABASE_STORAGE_TIMEOUT_MS - SUPABASE_DEFAULT_TIMEOUT_MS);
    expect(signals[0].aborted).toBe(true);
    await assertion;
  });

  it("lets an upstream abort through immediately and clears the timer", async () => {
    const doFetch = createFetchWithTimeout();
    const upstream = new AbortController();
    const pending = doFetch(STORAGE_UPLOAD_URL, { method: "POST", signal: upstream.signal });
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });

    upstream.abort();
    expect(signals[0].aborted).toBe(true);
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });
});
