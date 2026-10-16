/**
 * Stand-in for `@supabase/realtime-js`, wired in via bundler alias.
 *
 * `SupabaseClient`'s constructor calls `_initRealtimeClient()` unconditionally,
 * so the real package is reachable from every page and lands in the first-paint
 * bundle whether or not anything ever opens a channel. There is no client option
 * to skip it. Its WebSocket transport was the single largest chunk on the
 * dashboard's critical path, carrying realtime for exactly one feature in the
 * whole app: a parent-portal notification channel. On a school tablet that
 * feature was already documented as "expensive/flaky on slow mobile networks",
 * and that one subscription now polls instead.
 *
 * So the whole transport is aliased away. Auth is untouched: this swaps only
 * the realtime module, not the client that `createBrowserClient` builds, so the
 * `sb-*-auth-token` cookie sync that `src/proxy.ts` gates server-side auth on
 * keeps working exactly as before.
 *
 * Types are still the real ones -- `tsc` resolves `@supabase/realtime-js`
 * normally and only the bundler is redirected -- so calling `.channel()` remains
 * a type-checked, valid-looking call. That is precisely the hazard here, so the
 * stub refuses loudly rather than quietly doing nothing.
 */

/** Subscribe states, mirroring the real client's shape for anyone reading them. */
export const REALTIME_SUBSCRIBE_STATES = {
  SUBSCRIBED: "SUBSCRIBED",
  TIMED_OUT: "TIMED_OUT",
  CLOSED: "CLOSED",
  CHANNEL_ERROR: "CHANNEL_ERROR",
} as const;

export const REALTIME_CHANNEL_STATES = {
  JOINED: "joined",
  CLOSED: "closed",
  LEAVING: "leaving",
  ERRORED: "errored",
} as const;

export const REALTIME_LISTEN_TYPES = {
  ALL: "*",
  BROADCAST: "broadcast",
  PRESENCE: "presence",
  PRESENCE_SYNC: "presence_sync",
  POSTGRES_CHANGES: "postgres_changes",
} as const;

export const REALTIME_POSTGRES_CHANGES_LISTEN_EVENT = "*" as const;
export const REALTIME_PRESENCE_LISTEN_EVENTS = ["presence", "sync"] as const;

const REFUSAL =
  "Realtime is not bundled. @supabase/realtime-js is aliased to a stub so that " +
  "the WebSocket transport stops riding along on the critical path of every page " +
  "for the sake of one parent-portal subscription, which polls instead. If you " +
  "need live updates here, use polling (see src/app/parent-portal/page.tsx) or " +
  "remove the alias in next.config.js.";

function refuse(): never {
  // Always throw. A silent no-op here would mean notifications that simply
  // never arrive, with nothing in the logs to explain why.
  throw new Error(REFUSAL);
}

/**
 * Arity is preserved so call sites still type-check. The real signatures take
 * arguments, and a stub that took none would turn every future `.on(...)` call
 * into a compile error -- which reads as "realtime was never possible here"
 * rather than "realtime was deliberately removed".
 */
type AnyArgs = unknown[];

export class RealtimeChannel {
  constructor(..._args: unknown[]) {
    refuse();
  }
  on(..._args: AnyArgs): never {
    refuse();
  }
  subscribe(..._args: AnyArgs): never {
    refuse();
  }
  unsubscribe(..._args: AnyArgs): never {
    refuse();
  }
  send(..._args: AnyArgs): never {
    refuse();
  }
  track(..._args: AnyArgs): never {
    refuse();
  }
  untrack(..._args: AnyArgs): never {
    refuse();
  }
  presence(..._args: AnyArgs): never {
    refuse();
  }
}

export class RealtimePresence {
  constructor(..._args: unknown[]) {
    refuse();
  }
}

/**
 * Constructed by `SupabaseClient` for every page, which is the entire problem
 * this stub exists to solve -- so construction itself must succeed silently.
 * Only the methods that actually need a live socket refuse.
 */
export class RealtimeClient {
  constructor(
    readonly url: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly options?: any,
  ) {}

  /** Only reachable if some future feature reintroduces a live subscription. */
  channel(..._args: AnyArgs): never {
    refuse();
  }
  removeChannel(..._args: AnyArgs): never {
    refuse();
  }
  removeAllChannels(..._args: AnyArgs): never {
    refuse();
  }
  setAuth(..._args: AnyArgs): never {
    refuse();
  }
  disconnect(..._args: AnyArgs): never {
    refuse();
  }
}
