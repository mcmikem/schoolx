import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAuthCookieName } from "@/lib/supabase-cookie";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData().catch(() => null);
    let identifier = "";
    let password = "";
    if (formData) {
      identifier = String(formData.get("identifier") || formData.get("phone") || "").trim();
      password = String(formData.get("password") || "").trim();
    } else {
      const body = await request.json().catch(() => ({}));
      identifier = String((body as any).identifier || (body as any).phone || "").trim();
      password = String((body as any).password || "").trim();
    }

    if (!identifier || !password) {
      return NextResponse.redirect(new URL("/login/?error=missing", request.url), 303);
    }

    const signinRes = await fetch(new URL("/api/auth/signin/", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    const signinData = await signinRes.json();
    if (!signinData.success || !signinData.data?.access_token) {
      return NextResponse.redirect(new URL("/login/?error=invalid", request.url), 303);
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

    const response = NextResponse.redirect(new URL("/dashboard/", request.url), 303);
    const cookieName = getSupabaseAuthCookieName(process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (cookieName) {
      response.cookies.set(cookieName, cookieValue, {
        path: "/",
        maxAge: session.expires_in || 3600,
        sameSite: "lax",
        httpOnly: false,
      });
    }
    return response;
  } catch (error) {
    return NextResponse.redirect(new URL("/login/?error=server", request.url), 303);
  }
}
