import "@testing-library/jest-dom";

// jsdom ships no matchMedia. Components that pick a layout from it on mount
// (the grades page switches between the focused pupil card on phones and the
// full register on laptops) crash every test that renders them, so tests see
// a desktop-width viewport by default. A test that needs another width
// redefines window.matchMedia locally.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

if (typeof global.Request === "undefined") {
  class RequestShim {}

  class ResponseShim {
    status: number;
    private body: unknown;

    constructor(body?: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }

    static json(body: unknown, init?: { status?: number }) {
      return new ResponseShim(body, init);
    }

    json() {
      return Promise.resolve(this.body);
    }
  }

  class HeadersShim {}

  global.Request = RequestShim as unknown as typeof Request;
  global.Response = ResponseShim as unknown as typeof Response;
  global.Headers = HeadersShim as unknown as typeof Headers;
  global.fetch = jest.fn() as unknown as typeof fetch;
}

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    };
  },
  usePathname() {
    return "";
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

// Mock supabase
const mockChannelOn = jest.fn().mockReturnThis();
const mockChannelSubscribe = jest.fn().mockReturnValue({ unsubscribe: jest.fn() });
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
    channel: jest.fn(() => ({
      on: mockChannelOn,
      subscribe: mockChannelSubscribe,
    })),
    removeChannel: jest.fn(),
  },
}));

// Mock localStorage
// Mirrors the Storage interface, including key() and length. Without them a
// helper that walks localStorage by index -- e.g. sweeping every per-user
// namespace on sign-out -- silently does nothing under test while working in
// the browser, which is the worst possible failure mode for a privacy fix.
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length;
    },
  };
})();
if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", { value: localStorageMock });
}
