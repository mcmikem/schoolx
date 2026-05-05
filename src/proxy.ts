import { logger } from "@/lib/logger";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const DEMO_KEY = "skoolmate_demo_v1";
const DEMO_MODE_ENABLED =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES === "true";
const DEMO_ALLOWED_ROLES = new Set([
  "headmaster",
  "dean_of_studies",
  "bursar",
  "teacher",
  "secretary",
  "dorm_master",
  "parent",
]);

function hasValidDemoSession(request: NextRequest) {
  if (!DEMO_MODE_ENABLED) return false;
  const cookieValue = request.cookies.get(DEMO_KEY)?.value;
  if (!cookieValue) return false;
  try {
    const decoded = Buffer.from(cookieValue, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as {
      demoUser?: { role?: unknown; name?: unknown };
      demoSchool?: { id?: unknown; name?: unknown };
    };
    return Boolean(
      parsed.demoSchool?.id &&
        parsed.demoSchool?.name &&
        typeof parsed.demoUser?.name === "string" &&
        typeof parsed.demoUser?.role === "string" &&
        DEMO_ALLOWED_ROLES.has(parsed.demoUser.role),
    );
  } catch {
    return false;
  }
}

const alwaysPublicPaths = [
  "/login",
  "/register",
  "/demo-login",
  "/privacy",
  "/api/auth",
  "/api/demo-login",
  "/api/register",
  "/api/setup",
  "/api/health",
  "/api/payment/webhook",
  "/api/payment/paypal/webhook",
  "/api/sms",
  "/api/schoolpay",
  "/api/students",
  "/api/reports",
  "/_next",
  "/downloads",
  "/sw.js",
  "/manifest.json",
  "/offline.html",
  "/favicon.ico",
];

const SETUP_PATHS = ["/setup", "/setup-admin"];

const PUBLIC_FILE_PATTERN = /\.(?:svg|png|jpg|jpeg|webp|gif|ico|css|js|map|txt|xml|json|woff|woff2|ttf|eot)$/i;

function hasAuthSessionCookie(request: NextRequest): boolean {
  const cookies = request.cookies.getAll();
  for (let i = 0; i < cookies.length; i++) {
    const name = cookies[i].name;
    if (name.startsWith("sb-") && name.endsWith("-auth-token")) {
      return true;
    }
  }
  return false;
}

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-XSS-Protection", "0");
  const isProduction = process.env.NODE_ENV === "production";
  const imgSrc = isProduction
    ? "img-src 'self' data: blob: https:"
    : "img-src 'self' data: blob: https: http:";
  const scriptSrc = isProduction
    ? "script-src 'self' 'unsafe-inline' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ blob:"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ blob:";

  // Build connect-src dynamically to include local Supabase in development
  const connectSrcParts = [
    "'self'",
    "https://*.supabase.co",
    "https://api.resend.com",
    "https://api.africastalking.com",
    "https://graph.facebook.com",
    "https://*.google.com",
    "https://*.gstatic.com",
  ];
  if (!isProduction) {
    connectSrcParts.push("http://127.0.0.1:*", "http://localhost:*", "ws://127.0.0.1:*", "ws://localhost:*");
  }
  const connectSrc = `connect-src ${connectSrcParts.join(" ")}`;

  const cspDirectives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    imgSrc,
    connectSrc,
    "frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/",
    "worker-src 'self' blob:",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  if (isProduction) {
    cspDirectives.push("upgrade-insecure-requests");
  }

  response.headers.set(
    "Content-Security-Policy",
    cspDirectives.join("; "),
  );
}

function issueCSRFToken(response: NextResponse) {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const token = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  response.headers.set("x-csrf-token", token);
  response.cookies.set("csrf-token", token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_FILE_PATTERN.test(pathname)) {
    return NextResponse.next({ request });
  }

  const isPublicPath =
    pathname === "/" ||
    alwaysPublicPaths.some((path) => pathname.startsWith(path));

  const isSetupPath = SETUP_PATHS.some((path) => pathname.startsWith(path));

  if (isPublicPath) {
    const response = NextResponse.next({ request });
    applySecurityHeaders(response);
    if (!request.cookies.get("csrf-token")) {
      issueCSRFToken(response);
    }
    return response;
  }

  if (isSetupPath) {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.next({ request });
    }
    try {
      const checkClient = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      });
      const { count, error } = await checkClient
        .from("schools")
        .select("*", { count: "exact", head: true });
      if (error) {
        return NextResponse.next({ request });
      }
      if (count && count > 0) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
      }
    } catch {
      return NextResponse.next({ request });
    }
    const response = NextResponse.next({ request });
    applySecurityHeaders(response);
    return response;
  }

  if (hasValidDemoSession(request) && pathname.startsWith("/dashboard")) {
    const response = NextResponse.next({ request });
    applySecurityHeaders(response);
    return response;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    if (!pathname.startsWith("/setup")) {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
    return NextResponse.next({ request });
  }

  const supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  applySecurityHeaders(supabaseResponse);

  if (!request.cookies.get("csrf-token")) {
    issueCSRFToken(supabaseResponse);
  }

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

  const {
    data: { user: authUser },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && userError.name !== "AuthSessionMissingError") {
    logger.error("Auth user error:", userError);
  }

  if (!authUser) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    // Distinguish session expiry from other redirects so the login page can
    // show a helpful message instead of silently presenting the form.
    loginUrl.searchParams.set("reason", "session_expired");
    return NextResponse.redirect(loginUrl);
  }

  const { data: user } = await supabase
    .from("users")
    .select("is_active, role")
    .eq("auth_id", authUser.id)
    .single();

  if (user && !user.is_active) {
    await supabase.auth.signOut();
    const inactiveUrl = new URL("/login", request.url);
    inactiveUrl.searchParams.set("reason", "inactive");
    return NextResponse.redirect(inactiveUrl);
  }

  supabaseResponse.headers.set("x-user-id", authUser.id);
  supabaseResponse.headers.set("x-user-role", user?.role || "");

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
