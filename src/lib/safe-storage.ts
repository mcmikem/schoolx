/**
 * Storage that never throws.
 *
 * A phone with cookies and site data blocked — a privacy hardening, a
 * school's shared device set to "block all cookies", or an old WebView in
 * restrictive mode — throws `SecurityError: Access is denied for this
 * document` the moment any of our code touches `window.localStorage`. That
 * single throw during a `useState` initialiser (theme, academic year,
 * language) took the whole page down to the error boundary, which is the
 * "Something went wrong" screen in the field photo. Nothing in the session
 * actually needed storage to be durable to render.
 *
 * So every read/write goes through this helper: if the property is denied or
 * broken, values keep flowing through an in-memory map for this page's life
 * (a reload starts empty, which is fine — the durable stores, IndexedDB and
 * the auth cookie, are unaffected) and the app renders. When storage is
 * available we hand straight through, same keys as before.
 */

let localStorageAvailable: boolean | null = null;
let sessionStorageAvailable: boolean | null = null;

const memoryFallback = new Map<string, string>();

function probe(kind: "local" | "session", marker: string): boolean {
  const cached = kind === "local" ? localStorageAvailable : sessionStorageAvailable;
  if (cached !== null) return cached;
  let usable = false;
  try {
    if (typeof window !== "undefined") {
      const store = kind === "local" ? window.localStorage : window.sessionStorage;
      store.setItem(marker, "1");
      store.removeItem(marker);
      usable = true;
    }
  } catch {
    usable = false;
  }
  if (kind === "local") {
    localStorageAvailable = usable;
  } else {
    sessionStorageAvailable = usable;
  }
  return usable;
}

function read(kind: "local" | "session", key: string): string | null {
  if (probe(kind, `__sm_probe_${key}`)) {
    try {
      return kind === "local" ? window.localStorage.getItem(key) : window.sessionStorage.getItem(key);
    } catch {
      // The device flipped storage off between probe and read — treat as denied.
    }
  }
  return memoryFallback.has(`${kind}:${key}`) ? (memoryFallback.get(`${kind}:${key}`) as string) : null;
}

function write(kind: "local" | "session", key: string, value: string): void {
  if (probe(kind, `__sm_probe_${key}`)) {
    try {
      if (kind === "local") {
        window.localStorage.setItem(key, value);
      } else {
        window.sessionStorage.setItem(key, value);
      }
      return;
    } catch {
      // Denial mid-session: keep working from memory.
    }
  }
  memoryFallback.set(`${kind}:${key}`, value);
}

function remove(kind: "local" | "session", key: string): void {
  if (probe(kind, `__sm_probe_${key}`)) {
    try {
      if (kind === "local") {
        window.localStorage.removeItem(key);
      } else {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // Treated as absent either way.
    }
  }
  memoryFallback.delete(`${kind}:${key}`);
}

export const safeLocalStorage = {
  getItem: (key: string) => read("local", key),
  setItem: (key: string, value: string) => write("local", key, value),
  removeItem: (key: string) => remove("local", key),
};

export const safeSessionStorage = {
  getItem: (key: string) => read("session", key),
  setItem: (key: string, value: string) => write("session", key, value),
  removeItem: (key: string) => remove("session", key),
};

export function safeGetItem(key: string): string | null {
  return safeLocalStorage.getItem(key);
}

export function safeSetItem(key: string, value: string): void {
  safeLocalStorage.setItem(key, value);
}

export function isLocalStorageAvailable(): boolean {
  let usable = false;
  try {
    if (typeof window !== "undefined") {
      const store = window.localStorage;
      store.setItem("__sm_probe_live", "1");
      store.removeItem("__sm_probe_live");
      usable = true;
    }
  } catch {
    usable = false;
  }
  return usable;
}
