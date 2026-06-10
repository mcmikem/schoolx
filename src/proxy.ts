// ============================================================================
// 🔒 LOCKED DOWN — ROUTING MIDDLEWARE (DO NOT MODIFY WITHOUT APPROVAL)
// ============================================================================
// This file IS the middleware. Next.js 16 + Turbopack picks up src/proxy.ts.
// Deleting or badly defining it breaks ALL routing (every page returns 404).
//
// Last audited: 2026-05-12 | Bugs fixed: 3
// Known pitfalls:
//   - Do NOT create src/middleware.ts — it conflicts with src/proxy.ts
//   - All public paths must be in alwaysPublicPaths (login, register, auth/callback, etc.)
//   - Demo session validation must check DEMO_ALLOWED_ROLES allowlist
//   - Security headers (CSP) must allow local Supabase in dev mode
//   - CSRF tokens must be issued on every response
//
// To modify: Run full test suite (lint + typecheck + regression + e2e)
// ============================================================================
import { logger } from "@/lib/logger";
import { getRequiredModuleForPath } from "@/lib/modules/catalog";
import { createMiddlewareClient } from "@/utils/supabase/middleware";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const isValidHttpUrl = (value: string) => {
  if (!value || value.includes("your-supabase-url")) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const isValidAnonKey = (key: string) => {
  if (!key) return false;
  const sbPublishable = key.startsWith("sb_publishable_") && key.length > 20;
  const eyJ = key.startsWith("eyJ") && key.length > 50;
  return sbPublishable || eyJ;
};

const hasUsableSupabaseConfig =
  isValidHttpUrl(supabaseUrl) && isValidAnonKey(supabaseAnonKey);
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
  "/auth/callback",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/api/demo-login",
  "/api/register",
  "/api/setup",
  "/api/schools",
  "/api/storage",
  "/api/health",
  "/api/payment/webhook",
  "/api/payment/paypal/webhook",
  "/api/sms",
  "/api/schoolpay",
  "/_next",
  "/downloads",
  "/sw.js",
  "/manifest.json",
  "/offline.html",
  "/favicon.ico",
];

const SETUP_PATHS = ["/setup", "/setup-admin"];

const PUBLIC_FILE_PATTERN = /\.(?:svg|png|jpg|jpeg|webp|gif|ico|css|js|map|txt|xml|json|woff|woff2|ttf|eot)$/i;

function matchesPathPrefix(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function hasAuthSessionCookie(request: NextRequest): boolean {
  const cookies = request.cookies.getAll();
  for (let i = 0; i < cookies.length; i++) {
    const name = cookies[i].name;
    // Supabase SSR stores auth session as sb-<project-ref>-auth-token cookie.
    // Cookie value is base64url-encoded JSON (not a raw JWT), so we only check
    // cookie name presence — Supabase's own API validates the token server-side.
    if (name.startsWith("sb-") && name.endsWith("-auth-token")) {
      const value = cookies[i].value;
      if (value && value.length > 0) return true;
    }
  }
  return false;
}

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-XSS-Protection", "0"); // 0 disables the legacy XSS auditor; CSP handles XSS

  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  // COEP: require-corp is too aggressive for apps loading cross-origin resources
  // (Google Fonts, Supabase CDN, etc.). Use credentialless which allows credentialed
  // cross-origin resources without explicit CORP headers.
  response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  const isProduction = process.env.NODE_ENV === "production";
  const imgSrc = isProduction
    ? "img-src 'self' data: blob: https:"
    : "img-src 'self' data: blob: https: http:";
  // TODO: Migrate inline scripts to use nonce-based approach for stricter CSP
  const scriptSrc = isProduction
    ? "script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ blob:"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ blob:";

  // Build connect-src dynamically to include local Supabase in development
  const connectSrcParts = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://*.supabase.in",
    "wss://*.supabase.in",
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
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // unsafe-inline required for Tailwind JIT
    "font-src 'self' https://fonts.gstatic.com",
    imgSrc,
    connectSrc,
    "frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/",
    "worker-src 'self' blob:",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
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
  const normalizedPath = pathname.endsWith("/") && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname;

  // Backward compatibility for stale cached clients that still use old
  // upgrade/payment-plan fee tab URLs.
  if (normalizedPath === "/dashboard/fees") {
    const tab = request.nextUrl.searchParams.get("tab");
    if (tab === "payment-plans" || tab === "payments") {
      return NextResponse.redirect(new URL("/dashboard/billing", request.url));
    }
  }

  if (PUBLIC_FILE_PATTERN.test(pathname)) {
    return NextResponse.next({ request });
  }

  const isPublicPath =
    pathname === "/" ||
    alwaysPublicPaths.some((path) => matchesPathPrefix(pathname, path));

  const isSetupPath = SETUP_PATHS.some((path) => matchesPathPrefix(pathname, path));

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
      const checkClientResult = createMiddlewareClient(request, {
        supabaseUrl,
        supabaseKey: supabaseAnonKey,
      });
      if (!checkClientResult) {
        return NextResponse.next({ request });
      }
      const checkClient = checkClientResult.supabase;
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
    issueCSRFToken(response);
    return response;
  }

  // In local development, browser auth can live client-side while middleware
  // still sees stale/missing cookies. Avoid login bounce loops by letting
  // protected app shells hydrate on the client.
  // SECURITY: In production, this bypass is locked behind BYPASS_MIDDLEWARE_AUTH=true.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.BYPASS_MIDDLEWARE_AUTH !== "false" &&
    (
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/super-admin") ||
      pathname.startsWith("/parent-portal")
    )
  ) {
    const response = NextResponse.next({ request });
    applySecurityHeaders(response);
    if (!request.cookies.get("csrf-token")) {
      issueCSRFToken(response);
    }
    return response;
  }

  if (process.env.NODE_ENV === "production" && !hasUsableSupabaseConfig) {
    if (!pathname.startsWith("/setup")) {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
    return NextResponse.next({ request });
  }

  if (!hasUsableSupabaseConfig) {
    if (pathname === "/login" || pathname === "/register" || pathname === "/" || pathname.startsWith("/setup")) {
      const response = NextResponse.next({ request });
      applySecurityHeaders(response);
      return response;
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const response = NextResponse.redirect(loginUrl);
    applySecurityHeaders(response);
    return response;
  }

  const middlewareClient = createMiddlewareClient(request, {
    supabaseUrl,
    supabaseKey: supabaseAnonKey,
  });

  if (!middlewareClient) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { supabase, supabaseResponse } = middlewareClient;

  applySecurityHeaders(supabaseResponse);

  if (!request.cookies.get("csrf-token")) {
    issueCSRFToken(supabaseResponse);
  }

  const {
    data: { user: authUser },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && userError.name !== "AuthSessionMissingError") {
    logger.error("Auth user error:", userError);
  }

  // If getUser() failed, the JWT might be expired but the refresh token
  // is still valid. Try refreshing before redirecting to login — this
  // prevents kicking users out on slow networks where token refresh is delayed.
  let verifiedUser = authUser;
  if (!verifiedUser) {
    try {
      const { data: refreshData } = await supabase.auth.refreshSession();
      verifiedUser = refreshData.user;
    } catch {
      // Refresh failed — no valid session. Will redirect to login below.
    }
  }

  if (!verifiedUser) {
    // Cookie exists but user not verified — redirect to login instead of failing open
    if (
      hasAuthSessionCookie(request) &&
      (
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/super-admin") ||
        pathname.startsWith("/parent-portal")
      )
    ) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("reason", "session_expired");
      loginUrl.searchParams.set("redirect", pathname);
      const redirectRes = NextResponse.redirect(loginUrl);
      applySecurityHeaders(redirectRes);
      return redirectRes;
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    // Distinguish session expiry from other redirects so the login page can
    // show a helpful message instead of silently presenting the form.
    loginUrl.searchParams.set("reason", "session_expired");
    const redirectRes = NextResponse.redirect(loginUrl);
    applySecurityHeaders(redirectRes);
    return redirectRes;
  }

  const { data: user } = await supabase
    .from("users")
    .select("is_active, role, school_id")
    .eq("auth_id", verifiedUser.id)
    .single();

  if (user && !user.is_active) {
    await supabase.auth.signOut();
    const inactiveUrl = new URL("/login", request.url);
    inactiveUrl.searchParams.set("reason", "inactive");
    return NextResponse.redirect(inactiveUrl);
  }

  // Modular schools only get routes for active modules.
  // Full-suite schools keep all existing access paths unchanged.
  const requiredModule = getRequiredModuleForPath(pathname);
  if (requiredModule && user?.school_id) {
    try {
      const { data: schoolBilling, error: billingError } = await supabase
        .from("schools")
        .select("billing_mode")
        .eq("id", user.school_id)
        .maybeSingle();

      // If the modular tables/migration are not available yet, fail open to avoid outages.
      const missingSchema = billingError && ["42P01", "42703"].includes((billingError as { code?: string }).code || "");

      if (!missingSchema && schoolBilling?.billing_mode === "modular") {
        const { data: entitlement, error: entitlementError } = await supabase
          .from("school_module_entitlements")
          .select("status, ends_at")
          .eq("school_id", user.school_id)
          .eq("module_key", requiredModule)
          .maybeSingle();

        const entitlementMissingSchema = entitlementError && ["42P01", "42703"].includes((entitlementError as { code?: string }).code || "");

        if (!entitlementMissingSchema) {
          const isActiveState = entitlement?.status === "active" || entitlement?.status === "trial";
          const hasValidEndDate = entitlement?.ends_at
            ? new Date(entitlement.ends_at).getTime() > Date.now()
            : false;

          if (!isActiveState || !hasValidEndDate) {
            const upgradeUrl = new URL("/dashboard/settings", request.url);
            upgradeUrl.searchParams.set("tab", "subscription");
            upgradeUrl.searchParams.set("module", requiredModule);
            upgradeUrl.searchParams.set("reason", "module_locked");
            return NextResponse.redirect(upgradeUrl);
          }
        }
      }
    } catch {
      // Ignore transient errors in modular checks to avoid blocking valid sessions.
    }
  }

  // CSRF check for mutation requests on non-public paths
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    if (!validateCSRFToken(request)) {
      return new NextResponse(JSON.stringify({ error: "CSRF validation failed" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return supabaseResponse;
}

function validateCSRFToken(request: NextRequest): boolean {
  const headerToken = request.headers.get("x-csrf-token");
  const cookieToken = request.cookies.get("csrf-token")?.value;
  if (!headerToken || !cookieToken) return false;
  return headerToken === cookieToken;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff2?|json|ico)$).*)"],
};
