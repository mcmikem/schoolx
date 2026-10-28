import { describe, expect, it, jest } from "@jest/globals";
import {
  type CachedQueryResponse,
  type QueryCacheStore,
  createOfflineAwareApiFetch,
  createOfflineAwareFetch,
  installOfflineApiFetch,
  isCacheableApiRequest,
  isCacheableRequest,
  isOnlineOnlyApiRequest,
  queryCacheKey,
  readHeader,
  recordToResponse,
  setOfflineCacheUser,
  userIdFromAuthorization,
} from "@/lib/offline-query-cache";

class MemoryStore implements QueryCacheStore {
  records = new Map<string, CachedQueryResponse>();
  async get(key: string) {
    return this.records.get(key) ?? null;
  }
  async put(record: CachedQueryResponse) {
    this.records.set(record.key, record);
  }
  async clear() {
    this.records.clear();
  }
}

class FakeHeaders {
  constructor(private pairs: [string, string][]) {}
  get(name: string) {
    return this.pairs.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] ?? null;
  }
  entries() {
    return this.pairs[Symbol.iterator]();
  }
}

class FakeResponse {
  status: number;
  statusText: string;
  headers: FakeHeaders;
  private body: string;
  constructor(body: string, init: { status?: number; statusText?: string; headers?: [string, string][] } = {}) {
    this.body = body;
    this.status = init.status ?? 200;
    this.statusText = init.statusText ?? "OK";
    this.headers = new FakeHeaders(init.headers ?? []);
  }
  get ok() {
    return this.status >= 200 && this.status < 300;
  }
  clone() {
    return new FakeResponse(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: Array.from(this.headers.entries()),
    });
  }
  text() {
    return Promise.resolve(this.body);
  }
  json() {
    return Promise.resolve(JSON.parse(this.body) as unknown);
  }
}

const asResponse = (response: FakeResponse) => response as unknown as Response;
const buildResponse = (record: CachedQueryResponse) =>
  asResponse(
    new FakeResponse(record.body, {
      status: record.status,
      statusText: record.statusText,
      headers: record.headers,
    }),
  );

function jwtFor(sub: string): string {
  const payload = Buffer.from(JSON.stringify({ sub })).toString("base64url");
  return `header.${payload}.signature`;
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { value, configurable: true });
}

const URL_STUDENTS = "https://proj.supabase.co/rest/v1/students?select=*&order=name";
const AUTH = `Bearer ${jwtFor("user-a")}`;

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

afterEach(() => {
  setOnline(true);
  setOfflineCacheUser(null);
});

describe("offline query cache: eligibility", () => {
  it("only caches authenticated browser GETs against PostgREST", () => {
    expect(isCacheableRequest(URL_STUDENTS, "GET")).toBe(true);
    expect(isCacheableRequest(URL_STUDENTS, "POST")).toBe(false);
    expect(isCacheableRequest("https://proj.supabase.co/auth/v1/token?grant_type=password", "GET")).toBe(false);
    expect(isCacheableRequest("https://proj.supabase.co/storage/v1/object/a/b", "GET")).toBe(false);
    expect(isCacheableRequest(URL_STUDENTS, "GET", "document")).toBe(false);
  });

  it("scopes the key by user and by Accept (single vs list responses)", () => {
    const list = queryCacheKey(URL_STUDENTS, "application/json", "user-a");
    const single = queryCacheKey(URL_STUDENTS, "application/vnd.pgrst.object+json", "user-a");
    const otherUser = queryCacheKey(URL_STUDENTS, "application/json", "user-b");
    expect(new Set([list, single, otherUser]).size).toBe(3);
    expect(list).toContain("user-a");
  });

  it("reads the subject from the JWT and refuses anything else", () => {
    expect(userIdFromAuthorization(AUTH)).toBe("user-a");
    expect(userIdFromAuthorization(`Bearer ${jwtFor("teacher-9")}`)).toBe("teacher-9");
    expect(userIdFromAuthorization("Bearer not-a-jwt")).toBeNull();
    expect(userIdFromAuthorization(null)).toBeNull();
  });

  it("reads headers from Headers, plain objects and pair arrays", () => {
    expect(readHeader(new FakeHeaders([["authorization", AUTH]]) as unknown as HeadersInit, "authorization")).toBe(
      AUTH,
    );
    expect(readHeader({ Authorization: AUTH }, "authorization")).toBe(AUTH);
    expect(readHeader([["authorization", AUTH]], "authorization")).toBe(AUTH);
    expect(readHeader(null, "authorization")).toBeNull();
  });
});

describe("offline query cache: replay", () => {
  it("rebuilds a response with its status and headers but no stale encoding", async () => {
    // The Jest environment replaces Response with a bare shim, so capture the
    // constructor arguments instead of depending on a real Response class.
    const originalResponse = global.Response;
    let captured: { body: unknown; init?: ResponseInit } | null = null;
    class CapturingResponse {
      status: number;
      statusText: string;
      headers: FakeHeaders;
      private body: string;
      constructor(body: string, init?: ResponseInit) {
        captured = { body, init };
        this.body = body;
        this.status = init?.status ?? 200;
        this.statusText = init?.statusText ?? "";
        this.headers = new FakeHeaders((init?.headers as [string, string][]) ?? []);
      }
      json() {
        return Promise.resolve(JSON.parse(this.body) as unknown);
      }
    }
    global.Response = CapturingResponse as unknown as typeof Response;
    try {
      const response = recordToResponse({
        key: "k",
        userId: "user-a",
        status: 200,
        statusText: "OK",
        headers: [
          ["content-type", "application/json"],
          ["content-range", "0-1/2"],
        ],
        body: '[{"id":1}]',
        savedAt: Date.now(),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-range")).toBe("0-1/2");
      expect(await response.json()).toEqual([{ id: 1 }]);
      const seen = captured as { body: unknown; init?: ResponseInit } | null;
      expect(seen?.body).toBe('[{"id":1}]');
      expect(seen?.init?.status).toBe(200);
    } finally {
      global.Response = originalResponse;
    }
  });

  it("serves the last successful read when the network dies", async () => {
    const store = new MemoryStore();
    const online = jest.fn(async () =>
      asResponse(
        new FakeResponse('[{"id":1,"name":"Amina"}]', {
          headers: [
            ["content-type", "application/json"],
            ["content-range", "0-0/1"],
            ["content-encoding", "gzip"],
          ],
        }),
      ),
    );
    const fetchWithCache = createOfflineAwareFetch(online, store, buildResponse);

    const first = (await fetchWithCache(URL_STUDENTS, { headers: { authorization: AUTH } })) as unknown as FakeResponse;
    expect(await first.json()).toEqual([{ id: 1, name: "Amina" }]);
    await settle();

    const key = queryCacheKey(URL_STUDENTS, "", "user-a");
    const cached = store.records.get(key);
    expect(cached).toBeDefined();
    expect(cached?.headers.map(([name]) => name)).not.toContain("content-encoding");

    setOnline(false);
    const base = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const offlineFetch = createOfflineAwareFetch(base, store, buildResponse);
    const replayed = (await offlineFetch(URL_STUDENTS, {
      headers: { authorization: AUTH },
    })) as unknown as FakeResponse;

    expect(base).not.toHaveBeenCalled();
    expect(replayed.status).toBe(200);
    expect(replayed.headers.get("content-range")).toBe("0-0/1");
    expect(await replayed.json()).toEqual([{ id: 1, name: "Amina" }]);
  });

  it("falls through to the real request when nothing is cached", async () => {
    setOnline(false);
    const error = new TypeError("Failed to fetch");
    const base = jest.fn(async () => {
      throw error;
    });
    const fetchWithCache = createOfflineAwareFetch(base, new MemoryStore(), buildResponse);
    await expect(fetchWithCache(URL_STUDENTS, { headers: { authorization: AUTH } })).rejects.toBe(error);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("does not cache errors or anonymous responses", async () => {
    const store = new MemoryStore();
    const base = jest.fn(async () =>
      asResponse(new FakeResponse('{"message":"denied"}', { status: 401, statusText: "Unauthorized" })),
    );
    const fetchWithCache = createOfflineAwareFetch(base, store, buildResponse);

    await fetchWithCache(URL_STUDENTS, { headers: { authorization: AUTH } });
    await fetchWithCache(URL_STUDENTS, { headers: {} });
    await settle();

    expect(store.records.size).toBe(0);
  });

  it("shows the last successful read when a request times out on a weak link", async () => {
    const store = new MemoryStore();
    const key = queryCacheKey(URL_STUDENTS, "", "user-a");
    store.records.set(key, {
      key,
      userId: "user-a",
      status: 200,
      statusText: "OK",
      headers: [["content-type", "application/json"]],
      body: '[{"id":7}]',
      savedAt: Date.now(),
    });

    const controller = new AbortController();
    controller.abort(new Error("Supabase request timed out after 15000ms."));
    const base = jest.fn(async () => {
      throw new Error("Supabase request timed out after 15000ms.");
    });
    const fetchWithCache = createOfflineAwareFetch(base, store, buildResponse);

    const response = (await fetchWithCache(URL_STUDENTS, {
      headers: { authorization: AUTH },
      signal: controller.signal,
    })) as unknown as FakeResponse;
    expect(await response.json()).toEqual([{ id: 7 }]);
  });

  it("never replaces a cancelled request with stale data", async () => {
    const store = new MemoryStore();
    const key = queryCacheKey(URL_STUDENTS, "", "user-a");
    store.records.set(key, {
      key,
      userId: "user-a",
      status: 200,
      statusText: "OK",
      headers: [],
      body: "[]",
      savedAt: Date.now(),
    });

    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    const base = jest.fn(async () => {
      throw abortError;
    });
    const controller = new AbortController();
    controller.abort();
    const fetchWithCache = createOfflineAwareFetch(base, store, buildResponse);

    await expect(
      fetchWithCache(URL_STUDENTS, { headers: { authorization: AUTH }, signal: controller.signal }),
    ).rejects.toBe(abortError);
  });
});

describe("offline api cache: eligibility", () => {
  it("caches same-origin JSON GETs and leaves session/payment routes alone", () => {
    expect(isCacheableApiRequest("/api/reports/?type=fees", "GET")).toBe(true);
    expect(isCacheableApiRequest("/api/attendance/report/?classId=c1", "GET")).toBe(true);
    expect(isCacheableApiRequest("/api/reports/", "POST")).toBe(false);
    expect(isCacheableApiRequest("/api/auth/me/", "GET")).toBe(true);
    expect(isCacheableApiRequest("/api/auth/session/", "GET")).toBe(false);
    expect(isCacheableApiRequest("/api/demo-login/", "GET")).toBe(false);
    expect(isCacheableApiRequest("/api/payment/invoices/?limit=10", "GET")).toBe(false);
    expect(isCacheableApiRequest("https://other.example/api/reports/", "GET")).toBe(false);
    expect(isCacheableApiRequest("https://proj.supabase.co/rest/v1/students", "GET")).toBe(false);
  });
});

describe("offline api cache: replay", () => {
  const URL_REPORT = "/api/reports/?type=attendance";

  it("stores a signed-in user's JSON read and replays it offline", async () => {
    setOfflineCacheUser("user-a");
    const store = new MemoryStore();
    const online = jest.fn(async () =>
      asResponse(
        new FakeResponse('{"rows":[{"id":1}]}', {
          headers: [
            ["content-type", "application/json"],
            ["content-encoding", "gzip"],
          ],
        }),
      ),
    );
    const fetchWithCache = createOfflineAwareApiFetch(online, store, buildResponse);

    const live = (await fetchWithCache(URL_REPORT)) as unknown as FakeResponse;
    expect(await live.json()).toEqual({ rows: [{ id: 1 }] });
    await settle();

    const cached = store.records.get("user-a::api::/api/reports/?type=attendance");
    expect(cached).toBeDefined();
    expect(cached?.headers.map(([name]) => name)).not.toContain("content-encoding");

    setOnline(false);
    const base = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const offlineFetch = createOfflineAwareApiFetch(base, store, buildResponse);
    const replayed = (await offlineFetch(URL_REPORT)) as unknown as FakeResponse;
    expect(base).not.toHaveBeenCalled();
    expect(await replayed.json()).toEqual({ rows: [{ id: 1 }] });
  });

  it("never serves one user's API response to another", async () => {
    setOfflineCacheUser("user-a");
    const store = new MemoryStore();
    const base = jest.fn(async () =>
      asResponse(new FakeResponse('{"rows":[]}', { headers: [["content-type", "application/json"]] })),
    );
    const fetchWithCache = createOfflineAwareApiFetch(base, store, buildResponse);
    await fetchWithCache(URL_REPORT);
    await settle();

    setOnline(false);
    setOfflineCacheUser("user-b");
    const otherBase = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const otherFetch = createOfflineAwareApiFetch(otherBase, store, buildResponse);
    await expect(otherFetch(URL_REPORT)).rejects.toBeInstanceOf(TypeError);
    expect(otherBase).toHaveBeenCalledTimes(1);
  });

  it("does not cache non-JSON downloads or no-store responses", async () => {
    setOfflineCacheUser("user-a");
    const store = new MemoryStore();
    const pdf = jest.fn(async () =>
      asResponse(new FakeResponse("%PDF-1.4", { headers: [["content-type", "application/pdf"]] })),
    );
    const noStore = jest.fn(async () =>
      asResponse(
        new FakeResponse('{"ok":true}', {
          headers: [
            ["content-type", "application/json"],
            ["cache-control", "no-store"],
          ],
        }),
      ),
    );

    await createOfflineAwareApiFetch(pdf, store, buildResponse)("/api/reports/export/");
    await createOfflineAwareApiFetch(noStore, store, buildResponse)("/api/reports/live/");
    await settle();

    expect(store.records.size).toBe(0);
  });

  it("does not touch blocked routes even with a cache present", async () => {
    setOfflineCacheUser("user-a");
    const store = new MemoryStore();
    store.records.set("user-a::api::/api/auth/session/", {
      key: "user-a::api::/api/auth/session/",
      userId: "user-a",
      status: 200,
      statusText: "OK",
      headers: [],
      body: '{"id":"user-a"}',
      savedAt: Date.now(),
    });
    setOnline(false);
    const base = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const fetchWithCache = createOfflineAwareApiFetch(base, store, buildResponse);

    await expect(fetchWithCache("/api/auth/session/")).rejects.toBeInstanceOf(TypeError);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("caches the bearer-authenticated profile before the provider knows the user", async () => {
    setOfflineCacheUser(null);
    const store = new MemoryStore();
    const base = jest.fn(async () =>
      asResponse(new FakeResponse('{"user":{"id":"user-a"}}', { headers: [["content-type", "application/json"]] })),
    );
    const fetchWithCache = createOfflineAwareApiFetch(base, store, buildResponse);

    await fetchWithCache("/api/auth/me/", { headers: { authorization: AUTH } });
    await settle();
    expect(store.records.has("user-a::api::/api/auth/me/")).toBe(true);

    setOnline(false);
    const offlineBase = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const offlineFetch = createOfflineAwareApiFetch(offlineBase, store, buildResponse);
    const replayed = (await offlineFetch("/api/auth/me/", {
      headers: { authorization: AUTH },
    })) as unknown as FakeResponse;
    expect(offlineBase).not.toHaveBeenCalled();
    expect(await replayed.json()).toEqual({ user: { id: "user-a" } });
  });

  it("does not replay stale data after the caller aborts", async () => {
    setOfflineCacheUser("user-a");
    const store = new MemoryStore();
    const key = "user-a::api::/api/reports/";
    store.records.set(key, {
      key,
      userId: "user-a",
      status: 200,
      statusText: "OK",
      headers: [],
      body: "[]",
      savedAt: Date.now(),
    });

    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    const base = jest.fn(async () => {
      throw abortError;
    });
    const controller = new AbortController();
    controller.abort();
    const fetchWithCache = createOfflineAwareApiFetch(base, store, buildResponse);

    await expect(fetchWithCache("/api/reports/", { signal: controller.signal })).rejects.toBe(abortError);
  });
});

describe("offline api actions that cannot be queued", () => {
  it("recognises provider-backed actions", () => {
    expect(isOnlineOnlyApiRequest("/api/sms/send")).toBe(true);
    expect(isOnlineOnlyApiRequest("/api/payment/checkout/")).toBe(true);
    expect(isOnlineOnlyApiRequest("/api/ai/ask/")).toBe(true);
    expect(isOnlineOnlyApiRequest("/api/import/students/")).toBe(true);
    expect(isOnlineOnlyApiRequest("/api/parent/fee-payment-claims/")).toBe(true);
    expect(isOnlineOnlyApiRequest("/api/automation/sms/run/")).toBe(true);
    expect(isOnlineOnlyApiRequest("/api/reports/attendance/")).toBe(false);
  });

  it("answers an offline write with a labelled 503 instead of a network error", async () => {
    setOnline(false);
    const base = jest.fn(async () => {
      throw new Error("network down");
    });
    const fetchWithCache = createOfflineAwareApiFetch(base, new MemoryStore(), buildResponse);
    const response = await fetchWithCache("/api/sms/send", {
      method: "POST",
      headers: { authorization: AUTH },
      body: JSON.stringify({ message: "hello" }),
    });
    expect(base).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect(response.headers.get("x-offline-action")).toBe("1");
    await expect(response.json()).resolves.toMatchObject({ offline: true });
  });

  it("still lets offline GETs read their saved copy", async () => {
    setOnline(false);
    setOfflineCacheUser("user-a");
    const store = new MemoryStore();
    const key = "user-a::api::/api/reports/";
    store.records.set(key, {
      key,
      userId: "user-a",
      status: 200,
      statusText: "OK",
      headers: [["content-type", "application/json"]],
      body: "[]",
      savedAt: Date.now(),
    });
    const base = jest.fn(async () => {
      throw new Error("network down");
    });
    const fetchWithCache = createOfflineAwareApiFetch(base, store, buildResponse);
    const response = (await fetchWithCache("/api/reports/")) as unknown as FakeResponse;
    expect(await response.json()).toEqual([]);
  });
});

describe("offline api cache: install", () => {
  it("wraps and restores window.fetch", () => {
    setOfflineCacheUser("user-a");
    const original = window.fetch;
    const cleanup = installOfflineApiFetch();
    expect(window.fetch).not.toBe(original);
    cleanup();
    expect(window.fetch).toBe(original);
  });
});
