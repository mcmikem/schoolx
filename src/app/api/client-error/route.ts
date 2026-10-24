import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, supabaseClientOptions } from "@/lib/api-utils";
import { sanitizeClientErrorPayload } from "@/lib/client-error-payload";
import { logger } from "@/lib/logger";

/**
 * Unauthenticated crash beacon.
 *
 * Some phones fail during the first render, before sign-in, so the normal
 * error_logs writer (authenticated + RLS) never fires. This route sanitises a
 * small JSON body and writes it with the service role so the failure is
 * visible to us instead of only on the user's screen.
 *
 * It must always answer quickly and never throw: the client calls it with
 * keepalive while showing an error page.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function serviceClient() {
  if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey.length < 20) return null;
  return createClient(supabaseUrl, supabaseServiceKey, supabaseClientOptions({ auth: { persistSession: false } }));
}

export async function POST(request: NextRequest) {
  const { success } = rateLimit(request, 30, 60_000);
  if (!success) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  const payload = sanitizeClientErrorPayload(raw);
  if (!payload) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  logger.error("[client-error]", payload);

  try {
    const client = serviceClient();
    if (client) {
      await client.from("error_logs").insert({
        error_message: payload.message,
        error_stack: payload.stack,
        page_url: payload.url,
        browser_info: payload.ua,
        severity: "error",
      });
    }
  } catch (error) {
    logger.warn("[client-error] failed to persist", error);
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
