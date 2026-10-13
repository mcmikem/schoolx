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

  it("preloads the symbols font so it arrives before first paint", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('href="/fonts/material-symbols-outlined.woff2"');
    expect(layout).toMatch(/rel="preload"[^>]*material-symbols-outlined/);
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
