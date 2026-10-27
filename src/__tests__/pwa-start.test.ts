"use client";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.join(__dirname, "..", "..");
const read = (p: string): string => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("PWA cold open remembers the session", () => {
  it("starts into /start/, not the login page", () => {
    // start_url on /login/ meant every resume flashed the login form and then
    // "signed itself in" as the client restored the session. Resume is not a
    // login, and it must not look like one.
    const manifest = read("public/manifest.json");
    expect(manifest).toContain('"/start/"');
    expect(manifest).not.toContain('"/login/"');
  });

  it("resolves /start/ server-side, cookie-first", () => {
    const proxy = read("src/proxy.ts");
    expect(proxy).toContain('normalizedPath === "/start"');
    expect(proxy).toContain("hasValidDemoSession(request)");
    expect(proxy).toContain('"/dashboard/" : "/login/"');
  });

  it("serves maskable icons so the phone splash centres the logo", () => {
    const manifest = read("public/manifest.json");
    expect(manifest).toContain('"purpose": "maskable"');
    for (const size of [192, 512]) {
      expect(fs.existsSync(path.join(ROOT, "public", "icons", `icon-${size}-maskable.png`))).toBe(true);
    }
  });

  it("resolves /start/ from the shell cache when the device is offline", () => {
    // A cold open at a school with no signal used to meet the offline
    // fallback, because start_url was not an app-section page. The shell
    // documents are exactly what she opens the app INTO now.
    const sw = read("public/sw.js");
    expect(sw).toContain("'/start/'");
    expect(sw).toContain("await pageCache.match('/dashboard/')");
  });
});
