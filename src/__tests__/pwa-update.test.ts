import * as fs from "node:fs";
import * as path from "node:path";

// The update banner's icon and its "Updating…" stall are static properties of
// files Jest cannot import (a stylesheet, the root layout, the service
// worker), so these tests read the sources as text and pin the invariants
// that keep them from regressing.

const ROOT = path.join(__dirname, "..", "..");
const read = (relativePath: string): string => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

describe("update banner icon font", () => {
  it("blocks icon ligatures instead of swapping in their names as text", () => {
    const css = read("src/app/globals.css");
    const symbolsFace = css.match(/@font-face\s*{[^}]*font-family:\s*"Material Symbols Outlined"[^}]*}/);
    expect(symbolsFace).not.toBeNull();
    // `swap` renders "system_update_alt" as giant fallback text while the
    // font is still arriving over a slow link. `block` keeps the glyph
    // invisible for the short block period instead.
    expect(symbolsFace![0]).toContain("font-display: block");
    expect(symbolsFace![0]).not.toContain("font-display: swap");
  });

  it("does not force every route to download the symbols font", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).not.toContain('href="/fonts/material-symbols-outlined.woff2"');
  });
});

describe("service worker navigation", () => {
  it("bounds network-first navigations with a timeout that falls back to cache", () => {
    const sw = read("public/sw.js");
    // Without this, the reload after tapping "Update now" hangs on the
    // network fetch and the banner sits on "Updating…" indefinitely.
    expect(sw).toContain("NAVIGATION_TIMEOUT_MS");
    expect(sw).toContain("Promise.race");
    // The timeout must land in the existing cache-fallback path (precached
    // app shell, offline page) rather than failing the navigation.
    expect(sw).toContain("navigation timeout");
    expect(sw).toContain("PAGE_CACHE");
  });
});

describe("service worker slow-link and offline behaviour", () => {
  const sw = read("public/sw.js");

  it("uses a shorter navigation deadline when a cached copy exists", () => {
    expect(sw).toContain("NAVIGATION_TIMEOUT_CACHED_MS");
    expect(sw).toMatch(/hasCachedCopy\s*\?\s*NAVIGATION_TIMEOUT_CACHED_MS\s*:\s*NAVIGATION_TIMEOUT_MS/);
  });

  it("falls back to the dashboard shell, never the public marketing page, for offline dashboard URLs", () => {
    expect(sw).toContain("caches.match('/dashboard/')");
    expect(sw).not.toMatch(/dashboardCached\s*=\s*await caches\.match\('\/'\)/);
  });

  it("serves self-hosted fonts cache-first", () => {
    expect(sw).toMatch(/pathname\.startsWith\('\/fonts\/'\)/);
  });

  it("skips background image revalidation when Save-Data is on", () => {
    expect(sw).toContain("saveData");
  });
});

describe("heavy dashboard widgets stay out of the first-load bundle", () => {
  it("fees page lazy-loads its modals and tab panels with idle prefetch", () => {
    const fees = read("src/app/dashboard/fees/page.tsx");
    expect(fees).toContain("lazyWithIdlePrefetch");
    for (const c of ["PaymentModal", "ReceiptModal", "FeeCashbook", "PaymentClaimsPanel"]) {
      expect(fees).not.toMatch(new RegExp(`^import ${c} from`, "m"));
    }
  });

  it("grades page lazy-loads the import modal", () => {
    const grades = read("src/app/dashboard/grades/page.tsx");
    expect(grades).not.toMatch(/^import \{ GradeImportModal \} from/m);
    expect(grades).toContain("lazyWithIdlePrefetch");
  });
});

/**
 * Stale module graph on install.
 *
 * Reported from the field: a teacher opened skoolmate.omuto.org and got the
 * error screen immediately, on every attempt, and the "Go to Dashboard" button
 * did nothing. Another teacher on the same phone model was fine — so the
 * difference was her install history, not the device.
 *
 * sw.js said it would "never cache Next.js/Turbopack runtime chunks to avoid
 * stale module graphs" and then cache-firsted every request under `/_next/`.
 * Next.js runtime entry points are not all content-hashed, so a deploy can
 * serve new HTML that references a runtime whose path is unchanged. Cache-first
 * then hands back the *previous* deploy's runtime, the module graph no longer
 * lines up, and the app throws during boot — before any route renders, which
 * is why "Go to Dashboard" could not recover.
 */
describe("service worker never serves a stale module graph", () => {
  const sw = read("public/sw.js");

  const nextHandler = () => {
    const start = sw.indexOf("url.pathname.startsWith('/_next/')");
    expect(start).toBeGreaterThan(-1);
    // Up to the next top-level `if (request.destination` / `if (` branch.
    const rest = sw.slice(start);
    const end = rest.indexOf("\n  if (", 10);
    return end === -1 ? rest : rest.slice(0, end);
  };

  it("must not serve /_next/ requests cache-first", () => {
    const handler = nextHandler();
    // A cache hit must not be returned unconditionally.
    expect(handler).not.toMatch(/caches\.match\(request\)\.then\(\(cached\)\s*=>\s*\{\s*if \(cached\) return cached;/);
  });

  it("falls back to the cache only when the network fails, not before it", () => {
    const handler = nextHandler();
    expect(handler).toMatch(/fetch\(request/);
    expect(handler).toMatch(/\.catch\(/);
    expect(handler).toMatch(/caches\.match\(request\)/);
    // The network is tried before the cache is ever consulted, so a cached
    // runtime can never win over the one the current HTML expects.
    expect(handler.indexOf("fetch(request")).toBeLessThan(handler.indexOf("caches.match(request)"));
  });

  it("does not answer a failed chunk fetch with an empty body", () => {
    // `new Response('', …)` for a script is a syntax error, so an offline or
    // flaky link produced a parse crash instead of a legible network failure.
    const handler = nextHandler();
    expect(handler).not.toMatch(/new Response\(''/);
  });

  it("keeps the intent documented next to the code that has to honour it", () => {
    // If someone restores cache-firsting, the stale comment goes with it.
    expect(sw).toMatch(/runtime chunks/i);
  });
});
