import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(process.cwd(), "scripts/stamp-sw-version.mjs");
const SW_SOURCE = "const CACHE_VERSION = 'skoolmate-v13';\nconst STATIC_CACHE = 1;\n";

function makeProject() {
  const dir = mkdtempSync(join(tmpdir(), "sw-stamp-"));
  mkdirSync(join(dir, "public"), { recursive: true });
  writeFileSync(join(dir, "public", "sw.js"), SW_SOURCE);
  return dir;
}

function stamp(cwd: string, env: Record<string, string> = {}, args: string[] = []) {
  return execFileSync("node", [SCRIPT, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function readVersion(dir: string): string {
  return readFileSync(join(dir, "public", "sw.js"), "utf8").match(/CACHE_VERSION = '([^']*)'/)?.[1] ?? "";
}

describe("stamp-sw-version", () => {
  const dirs: string[] = [];
  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it("leaves the file untouched for a local build", () => {
    const dir = makeProject();
    dirs.push(dir);

    const out = stamp(dir, { CI: "", VERCEL: "", VERCEL_ENV: "", GITHUB_ACTIONS: "" });

    expect(readVersion(dir)).toBe("skoolmate-v13");
    expect(out).toContain("skipping");
  });

  it("stamps a CI build with the commit sha", () => {
    const dir = makeProject();
    dirs.push(dir);

    stamp(dir, { CI: "true", GITHUB_SHA: "abcdef1234567890" });

    expect(readVersion(dir)).toBe("skoolmate-abcdef123456");
  });

  it("prefers the Vercel commit sha", () => {
    const dir = makeProject();
    dirs.push(dir);

    stamp(dir, { VERCEL: "1", VERCEL_GIT_COMMIT_SHA: "vccsha1234", GITHUB_SHA: "other" });

    expect(readVersion(dir)).toBe("skoolmate-vccsha1234");
  });

  it("produces a different version per build, which is the whole point", () => {
    const first = makeProject();
    const second = makeProject();
    dirs.push(first, second);

    stamp(first, { CI: "true", GITHUB_SHA: "commit-one" });
    stamp(second, { CI: "true", GITHUB_SHA: "commit-two" });

    expect(readVersion(first)).not.toBe(readVersion(second));
  });

  it("is idempotent for the same build", () => {
    const dir = makeProject();
    dirs.push(dir);

    stamp(dir, { CI: "true", GITHUB_SHA: "samecommit1" });
    const out = stamp(dir, { CI: "true", GITHUB_SHA: "samecommit1" });

    expect(readVersion(dir)).toBe("skoolmate-samecommit1");
    expect(out).toContain("already stamped");
  });

  it("fails loudly when the version declaration is missing", () => {
    const dir = makeProject();
    dirs.push(dir);
    writeFileSync(join(dir, "public", "sw.js"), "// no version here\n");

    expect(() => stamp(dir, { CI: "true", GITHUB_SHA: "x" })).toThrow();
  });
});
