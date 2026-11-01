import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

    // Resolve identity + tokens via the existing signin endpoint.
    const signinRes = await fetch(new URL("/api/auth/signin/", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    const signinData = await signinRes.json();
    if (!signinData.success || !signinData.data?.access_token || !signinData.data?.refresh_token) {
      return NextResponse.redirect(new URL("/login/?error=invalid", request.url), 303);
    }

    const session = signinData.data;

    // Build the redirect response first, then let @supabase/ssr write the
    // session cookies onto it. createServerClient handles chunking, which is
    // required for iOS Safari (a single oversized cookie gets dropped, leaving
    // the dashboard with no session -> stuck on the loading skeleton).
    const response = NextResponse.redirect(new URL("/dashboard/", request.url), 303);

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn(),
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              path: options?.path ?? "/",
              sameSite: options?.sameSite ?? "lax",
              httpOnly: options?.httpOnly ?? false,
            });
          });
        },
      },
      cookieOptions: {
        name: "sb-gucxpmgwvnbqykevucbi-auth-token",
        maxAge: session.expires_in || 3600,
      },
    });

    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    return response;
  } catch (error) {
    return NextResponse.redirect(new URL("/login/?error=server", request.url), 303);
  }
}
