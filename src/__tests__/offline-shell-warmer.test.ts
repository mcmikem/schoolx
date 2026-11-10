import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

describe("offline shell preparation", () => {
  it("stores successful pages while skipping redirects and tolerating failed downloads", async () => {
    const source = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
    const start = source.indexOf("async function warmAppShell()");
    const end = source.indexOf("self.addEventListener('install'", start);
    const put = jest.fn().mockResolvedValue(undefined);
    const routes = ["/dashboard/", "/dashboard/attendance/", "/redirect/", "/failed/"];
    const fetchPage = jest.fn(async (url: string) => {
      if (url === "/failed/") throw new Error("Network unavailable");
      return { ok: true, redirected: url === "/redirect/" };
    });
    await runInNewContext(`${source.slice(start, end)}; warmAppShell()`, {
      APP_SHELL_ROUTES: routes,
      PAGE_CACHE: "test-pages",
      caches: { open: async () => ({ put, match: async () => undefined }) },
      fetch: fetchPage,
    });
    expect(fetchPage).toHaveBeenCalledTimes(4);
    expect(put.mock.calls.map(([url]) => url)).toEqual(routes.slice(0, 2));
  });

  it("removes school-specific pages, RSC, and images on sign-out while keeping auth shells", async () => {
    const source = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
    const start = source.indexOf("async function clearPrivateAppCaches()");
    const end = source.indexOf("self.addEventListener('install'", start);
    const pageEntries = new Map<string, { clone: () => unknown }>([
      ["/login/", { clone: () => ({ public: "login" }) }],
      ["/start/", { clone: () => ({ public: "start" }) }],
      ["/dashboard/", { clone: () => ({ private: "school page" }) }],
    ]);
    const deleted: string[] = [];
    const put = jest.fn(async (route: string) => pageEntries.set(route, { clone: () => ({ route }) }));
    const cache = {
      match: async (route: string) => pageEntries.get(route),
      put,
    };
    const cachesMock = {
      open: async () => cache,
      delete: async (name: string) => {
        deleted.push(name);
        pageEntries.clear();
        return true;
      },
    };
    await runInNewContext(`${source.slice(start, end)}; clearPrivateAppCaches()`, {
      PAGE_CACHE: "pages",
      RSC_CACHE: "rsc",
      IMAGE_CACHE: "images",
      caches: cachesMock,
      Promise,
    });
    expect(deleted).toEqual(["pages", "rsc", "images"]);
    expect(put.mock.calls.map(([route]) => route)).toEqual(["/login/", "/start/"]);
  });
});
