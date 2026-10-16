import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  REALTIME_CHANNEL_STATES,
  REALTIME_LISTEN_TYPES,
  REALTIME_SUBSCRIBE_STATES,
  RealtimeChannel,
  RealtimeClient,
  RealtimePresence,
} from "@/lib/supabase-realtime-stub";

/**
 * The stub stands in for @supabase/realtime-js in the bundle.
 *
 * Two failure modes matter and they pull in opposite directions:
 *
 *   - The stub must CONSTRUCT. `SupabaseClient` calls `_initRealtimeClient()`
 *     unconditionally for every page, so throwing here would break the entire
 *     app, not just realtime.
 *   - The stub must REFUSE LOUDLY. TypeScript still resolves the real
 *     `@supabase/realtime-js` types, so `.channel()` type-checks and looks
 *     legitimate. A silent no-op would mean notifications that never arrive
 *     and nothing in the logs to explain it.
 */

describe("realtime stub", () => {
  it("constructs, because SupabaseClient builds one for every page", () => {
    expect(() => new RealtimeClient("wss://example.supabase.co/realtime/v1", { params: {} })).not.toThrow();
  });

  it("keeps the url for anything that inspects it", () => {
    expect(new RealtimeClient("wss://example.test/realtime/v1").url).toBe("wss://example.test/realtime/v1");
  });

  it("refuses every entry point that would need a live socket", () => {
    const client = new RealtimeClient("wss://example.test");
    for (const call of [
      () => client.channel("x"),
      () => client.removeChannel(),
      () => client.removeAllChannels(),
      () => client.setAuth("token"),
      () => client.disconnect(),
    ]) {
      expect(call).toThrow(/Realtime is not bundled/);
    }
  });

  it("refuses construction of a channel, which is the thing apps call", () => {
    expect(() => new RealtimeChannel()).toThrow(/Realtime is not bundled/);
    expect(() => new RealtimePresence()).toThrow(/Realtime is not bundled/);
  });

  it("explains what to do instead, rather than just failing", () => {
    // A bare "not a function" leaves the next person guessing.
    expect(() => new RealtimeChannel()).toThrow(/polling/i);
    expect(() => new RealtimeChannel()).toThrow(/next\.config\.js/);
  });

  it("exports the constant shapes other code may read", () => {
    expect(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED).toBe("SUBSCRIBED");
    expect(REALTIME_CHANNEL_STATES.JOINED).toBe("joined");
    expect(REALTIME_LISTEN_TYPES.POSTGRES_CHANGES).toBe("postgres_changes");
  });
});

describe("the alias is declared for both bundlers", () => {
  const config = readFileSync(join(__dirname, "..", "..", "next.config.js"), "utf8");

  it("redirects @supabase/realtime-js under Turbopack", () => {
    expect(config).toContain("resolveAlias");
    expect(config).toContain('"@supabase/realtime-js": "./src/lib/supabase-realtime-stub.ts"');
  });

  it("redirects it under webpack too", () => {
    // NEXT_DISABLE_TURBOPACK=1 is a supported escape hatch. Without the webpack
    // alias that build would silently ship the WebSocket transport back.
    expect(config).toContain("webpack(config)");
    expect(config).toContain('"@supabase/realtime-js": path.resolve(__dirname, "src/lib/supabase-realtime-stub.ts")');
  });

  it("leaves the real package installed, so types still resolve", () => {
    // tsc must keep seeing the real types: that is what keeps `.channel()`
    // type-checked, and therefore the loud runtime refusal necessary.
    const pkg = readFileSync(join(__dirname, "..", "..", "node_modules/@supabase/realtime-js/package.json"), "utf8");
    expect(pkg).toContain('"name": "@supabase/realtime-js"');
  });
});
