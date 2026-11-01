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
});
