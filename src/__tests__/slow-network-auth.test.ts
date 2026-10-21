import * as fs from "node:fs";
import * as path from "node:path";

/**
 * A slow phone must be able to sign in.
 *
 * Two things made a sign-in on a rural 3G connection take half a minute and
 * then fail, and both are invisible in a fast test environment:
 *
 *   1. The sign-in guessed which account a number belonged to. Accounts are
 *      stored as `256XXXXXXXXX@omuto.org` with a few legacy shapes, so the
 *      client tried each one in turn -- one round trip per guess, and every
 *      guess had its own deadline. The server now resolves the number and
 *      signs in, so the phone crosses the network once.
 *   2. The profile fetch asked the auth client for the session while the
 *      client was still holding its own storage lock (the library delivers
 *      its auth-state event from inside that lock). getSession() could not
 *      get in, gave up after five seconds, and the profile was never
 *      fetched -- so the login page sat there and then reported a failure
 *      for a sign-in that had actually worked.
 *
 * The second one is the important one: it turned a working sign-in into a
 * failed one on exactly the devices that can least afford it.
 */

const ROOT = path.join(__dirname, "..", "..");
const authContext = fs.readFileSync(path.join(ROOT, "src/lib/auth-context.tsx"), "utf8");
const offlineHooks = fs.readFileSync(path.join(ROOT, "src/lib/offline-hooks.tsx".replace(".tsx", ".ts")), "utf8");

describe("the profile fetch does not fight the auth client for the session", () => {
  it("uses the session the auth event already carries", () => {
    // The handler receives the session with the event. Asking for it again
    // means waiting on a lock the library is still holding.
    expect(authContext).toContain("fetchUserData(sessionUser.id, session)");
    expect(authContext).toMatch(/knownSession\?: \{/);
  });

  it("only falls back to getSession() when no session was handed over", () => {
    const fetchBody = authContext.match(/const fetchUserData = useCallback\([\s\S]*?\n  \);/);
    expect(fetchBody).not.toBeNull();
    const body = fetchBody![0];
    const guardAt = body.indexOf("if (!session) {");
    const getSessionAt = body.indexOf("supabase.auth.getSession()");
    expect(guardAt).toBeGreaterThan(-1);
    expect(getSessionAt).toBeGreaterThan(guardAt);
  });
});

describe("the sign-in asks the server which account the number belongs to", () => {
  it("has one route that resolves the identity", () => {
    const route = path.join(ROOT, "src/app/api/auth/signin/route.ts");
    expect(fs.existsSync(route)).toBe(true);
    const src = fs.readFileSync(route, "utf8");
    // The number is looked up, not guessed, and the password is only ever
    // used to sign in.
    expect(src).toContain("lookupProfileEmail");
    expect(src).toContain("signInWithEmail");
    // A wrong password and an unknown number must be indistinguishable: one
    // message, one status, no "no such account" to probe with.
    expect(src).toContain("Invalid phone number or password");
    const unauthorized = src.match(/apiError\([^)]*,\s*401\)/g) ?? [];
    expect(unauthorized.length).toBeGreaterThan(0);
    for (const call of unauthorized) {
      expect(call).toContain("Invalid phone number or password");
    }
  });

  it("keeps the client-side attempts as a fallback when the route is unreachable", () => {
    expect(authContext).toContain("apiSignIn");
    // The fallback must not swallow the request: a network error to our own
    // origin returns null so the old attempt loop can take over.
    expect(authContext).toMatch(/catch \{\s*\/\/ Our own API is unreachable[\s\S]*?return null;/);
  });
});

describe("the local database is not in front of the data", () => {
  it("reads the cache and the server at the same time", () => {
    // The cache used to be read first and the network second, which put the
    // whole cache round trip in front of every screen -- four seconds on a
    // phone whose database was slow to open, and zeros until a refresh when
    // it could not open at all.
    expect(offlineHooks).toContain("const cachePromise =");
    expect(offlineHooks).toContain("const networkPromise");
    const cacheAt = offlineHooks.indexOf("const cachePromise =");
    const networkAt = offlineHooks.indexOf("const networkPromise");
    expect(cacheAt).toBeGreaterThan(-1);
    expect(networkAt).toBeGreaterThan(-1);
  });

  it("gives the database long enough to open on a slow phone", () => {
    const offline = fs.readFileSync(path.join(ROOT, "src/lib/offline.ts"), "utf8");
    expect(offline).toContain("DB_OPEN_TIMEOUT_MS");
    const match = offline.match(/export const DB_OPEN_TIMEOUT_MS = (\d+)/);
    expect(match).not.toBeNull();
    // Four seconds was not enough for a phone creating 44 object stores.
    expect(Number(match![1])).toBeGreaterThanOrEqual(10000);
  });
});
