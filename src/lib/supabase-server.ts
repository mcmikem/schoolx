/**
 * Server-side Supabase client for reading the signed-in pupil's own data.
 *
 * The student portal is the one page a pupil opens on a school tablet or a
 * shared phone, often on the slowest connection in the building. Measured on a
 * slow-3G link it took 11.1 seconds to become usable, and almost all of that was
 * JavaScript: 300KB across 22 separate files, where the round trips alone cost
 * about nine seconds at 400ms latency. The data itself was tiny.
 *
 * So the data moves to the server and arrives as HTML. The browser paints a real
 * screen as soon as the document arrives, and the pupil is no longer watching a
 * spinner while a quarter-megabyte of JavaScript crosses the country.
 *
 * This client runs with the pupil's own session rather than the service role,
 * which is the point: RLS decides what a pupil may read, and a pupil asking the
 * server for their own record is checked exactly as it would be from the
 * browser. Swapping in the service key here would quietly hand every pupil
 * every pupil's data.
 *
 * Every call is bounded. A slow or unreachable auth server must produce the
 * loading state, not a hung request -- a portal that never paints is worse than
 * a slow one.
 */

import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

/** How long the server will wait before handing the page over to the browser. */
const SERVER_FETCH_BUDGET_MS = 2500;

export interface PortalStudent {
  id: string;
  first_name: string;
  last_name: string;
  student_number: string;
  gender: string;
  class_id: string;
  status: string;
  classes?: { name: string; level: string } | null;
}

function url(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function key(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

/**
 * Read the pupil's own record on the server.
 *
 * Returns null whenever anything is uncertain -- no session, a slow auth server,
 * a revoked token. Null means "the client will fetch it", which is the state the
 * portal already worked in, so a failure here degrades to today's behaviour
 * instead of to a broken page.
 */
export async function readPortalStudent(): Promise<PortalStudent | null> {
  const supabaseUrl = url();
  const supabaseKey = key();
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const store = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cookiesToSet) {
          // A server component cannot set cookies. The proxy refreshes the
          // session on the way through, so writing here is not required; the
          // try/catch is because @supabase/ssr calls this unconditionally.
          try {
            for (const { name, value, options } of cookiesToSet) {
              store.set(name, value, options);
            }
          } catch {
            /* server components are not permitted to mutate cookies */
          }
        },
      },
    });

    const authResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), SERVER_FETCH_BUDGET_MS)),
    ]);

    // null here is the budget running out, not "signed out".
    if (!authResult || authResult.error || !authResult.data?.user) return null;
    const user = authResult.data.user;

    const { data, error } = await supabase
      .from("students")
      .select("id, first_name, last_name, student_number, gender, class_id, status, classes (name, level)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) return null;
    // PostgREST returns an embedded relation as an array even for a to-one
    // join; the shape the page wants is a single object.
    const embedded = Array.isArray(data.classes) ? data.classes[0] : data.classes;
    return { ...data, classes: embedded ?? null } as unknown as PortalStudent;
  } catch {
    // Any failure here must not take the page down: the browser-side fetch is
    // still there and the portal worked this way until this file existed.
    return null;
  }
}
