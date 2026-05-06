import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/server/user-provisioning";
import { logger } from "@/lib/logger";

function sanitizeNext(nextParam: string | null): string {
  if (!nextParam || !nextParam.startsWith("/")) return "/dashboard";
  return nextParam;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=google_auth_failed`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logger.error("OAuth callback exchange failed:", error);
    return NextResponse.redirect(`${origin}/login?error=google_auth_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=google_auth_failed`);
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile) {
      const registerUrl = new URL("/register", origin);
      registerUrl.searchParams.set("oauth", "1");
      if (user.email) registerUrl.searchParams.set("email", user.email);
      return NextResponse.redirect(registerUrl);
    }
  } catch (callbackError) {
    logger.error("OAuth callback profile lookup failed:", callbackError);
    // Profile lookup failed — redirect to register so the user can complete setup
    // rather than landing on a broken dashboard with no profile data.
    const registerUrl = new URL("/register", origin);
    registerUrl.searchParams.set("oauth", "1");
    if (user.email) registerUrl.searchParams.set("email", user.email);
    return NextResponse.redirect(registerUrl);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
