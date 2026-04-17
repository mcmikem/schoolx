import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Use optional chaining with safe defaults for env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const publicPaths = [
  "/login",
  "/register",
  "/demo-login",
  "/setup",
  "/setup-admin",
  "/api/auth",
  "/api/demo-login",
  "/api/register",
  "/api/setup",
  "/api/payment/webhook",
  "/api/sms",
  "/api/schoolpay",
  "/api/reports",
  "/_next",
  "/favicon.ico",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths without auth check
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));
  if (isPublicPath) {
    return NextResponse.next({ request });
  }

  // If Supabase not configured, allow through to setup page
  if (!supabaseUrl || !supabaseAnonKey) {
    if (pathname === "/setup" || pathname === "/setup-admin") {
      return NextResponse.next({ request });
    }
    // Redirect to setup if not already going there
    if (!pathname.startsWith("/setup")) {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
    return NextResponse.next({ request });
  }

  // Create supabase client from request
  const supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh session if expired
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("Session error:", sessionError);
  }

  // No session - redirect to login
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check user is active
  if (session.user) {
    const { data: user } = await supabase
      .from("users")
      .select("is_active, role")
      .eq("auth_id", session.user.id)
      .single();

    if (user && !user.is_active) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/login?reason=inactive", request.url),
      );
    }

    // Add user info to headers for server components
    supabaseResponse.headers.set("x-user-id", session.user.id);
    supabaseResponse.headers.set("x-user-role", user?.role || "");
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
