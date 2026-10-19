import StudentPortalClient from "./StudentPortalClient";
import { readPortalStudent } from "@/lib/supabase-server";

/**
 * The student portal's document.
 *
 * This is the one page a pupil opens on a shared phone or a school tablet,
 * usually on the slowest connection in the building. Measured on a slow-3G link
 * it took 11.1 seconds to become usable, and the cause was not the data: it was
 * JavaScript. Three hundred kilobytes spread over twenty-two separate files,
 * where the round trips alone accounted for about nine seconds at 400ms
 * latency. Repeat visits were already fast -- the service worker serves them in
 * around 40ms -- so the entire cost was the first one.
 *
 * So the pupil's own record is read here, on the server, and rendered into the
 * HTML. The document has always arrived in about a quarter of a second; what
 * was slow is everything that waited behind the script tags. The name, class and
 * student number are on screen as soon as the browser can paint.
 *
 * If this cannot be read -- no session yet, a slow or unreachable auth server,
 * a revoked token -- it returns null and the client fetches the record itself,
 * which is exactly what this page did until now. A failure here degrades to the
 * old behaviour rather than to an error page, because a portal that never
 * paints is worse than a slow one.
 */

export const dynamic = "force-dynamic";

export default async function StudentPortalPage() {
  const student = await readPortalStudent();
  return <StudentPortalClient initial={{ student }} />;
}
