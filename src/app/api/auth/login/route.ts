import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiError, supabaseClientOptions } from "@/lib/api-utils";
import { normalizeAuthPhone } from "@/lib/validation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData().catch(() => null);
    const body = formData || (await request.json().catch(() => ({})));
    const identifier = String((body as any).identifier || (body as any).phone || "").trim();
    const password = String((body as any).password || "").trim();

    if (!identifier || !password) {
      return NextResponse.redirect(new URL("/login/?error=missing", request.url));
    }

    const normalized = normalizeAuthPhone(identifier);
    const candidates = [normalized, identifier];

    // Resolve email
    let email = `${normalized}@omuto.org`;
    // Try candidate emails
    const supabase = createClient(
      supabaseUrl!,
      supabaseAnonKey!,
      supabaseClientOptions({ auth: { persistSession: false } }),
    );

    // Use the signin API logic by calling it internally
    const signinRes = await fetch(new URL("/api/auth/signin/", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    const signinData = await signinRes.json();
    if (!signinData.success || !signinData.data?.access_token) {
      return NextResponse.redirect(new URL("/login/?error=invalid", request.url));
    }

    const session = signinData.data;
    const cookieValue =
      "base64-" +
      Buffer.from(
        JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          expires_at: Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
          token_type: "bearer",
          user: null,
        }),
      ).toString("base64url");

    const response = NextResponse.redirect(new URL("/dashboard/", request.url));
    response.cookies.set("sb-gucxpmgwvnbqykevucbi-auth-token", cookieValue, {
      path: "/",
      maxAge: session.expires_in || 3600,
      sameSite: "lax",
      httpOnly: false,
    });
    return response;
  } catch (error) {
    return NextResponse.redirect(new URL("/login/?error=server", request.url));
  }
}
