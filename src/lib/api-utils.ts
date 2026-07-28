import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@/types";
import { logger } from "@/lib/logger";
import { canAccess, type RolePermissions, type UserRole } from "@/lib/roles";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export function apiSuccess<T>(data: T, message?: string, status: number = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
    },
    { status },
  );
}

export function apiError(error: string, status: number = 400): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status },
  );
}

export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  Sentry.captureException(error);

  if (error instanceof Error) {
    logger.error("[Server Error]", {
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    return apiError(error.message, 500);
  }

  return apiError("An unexpected error occurred. Please try again later.", 500);
}

export function validateRequiredFields(body: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

// Rate limiting — hybrid approach:
// Primary: Supabase `rate_limit` table (persists across serverless cold starts).
// Fallback: in-memory Map (used when Supabase is unavailable or misconfigured).
// The Supabase table should be created via migration if it doesn't exist yet;
// the in-memory fallback ensures nothing breaks during cold-start races.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000;
const MAX_MAP_SIZE = 10000;

async function rateLimitViaSupabase(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ success: boolean; remaining: number; resetTime: number } | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  try {
    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const now = new Date();
    const windowStart = new Date(Date.now() - windowMs);

    // Count existing hits for this key within the current window
    const { count, error } = await sb
      .from("rate_limit_log")
      .select("*", { count: "exact", head: true })
      .eq("key", key)
      .gte("created_at", windowStart.toISOString());

    if (error) return null; // fall back to in-memory

    const hits = count ?? 0;
    if (hits >= limit) {
      return { success: false, remaining: 0, resetTime: Date.now() + windowMs };
    }

    // Record this hit
    await sb.from("rate_limit_log").insert({ key, created_at: now.toISOString() });

    return {
      success: true,
      remaining: limit - hits - 1,
      resetTime: Date.now() + windowMs,
    };
  } catch (err) {
    logger.error("[RateLimit] Supabase fallback error:", err);
    return null; // fall back to in-memory
  }
}

function rateLimitInMemory(
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number; resetTime: number } {
  const now = Date.now();

  if (rateLimitMap.size > MAX_MAP_SIZE || now - lastCleanup > CLEANUP_INTERVAL) {
    rateLimitMap.forEach((v, k) => {
      if (now > v.resetTime) rateLimitMap.delete(k);
    });
    lastCleanup = now;
  }

  if (rateLimitMap.size >= MAX_MAP_SIZE) {
    return { success: false, remaining: 0, resetTime: now + windowMs };
  }

  const record = rateLimitMap.get(key);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1, resetTime: now + windowMs };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count++;
  return { success: true, remaining: limit - record.count, resetTime: record.resetTime };
}

export async function rateLimitAsync(
  request: NextRequest,
  limit: number = 100,
  windowMs: number = 60000,
): Promise<{ success: boolean; remaining: number; resetTime: number }> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const key = `rl:${ip}`;

  const supabaseResult = await rateLimitViaSupabase(key, limit, windowMs);
  if (supabaseResult !== null) return supabaseResult;

  return rateLimitInMemory(key, limit, windowMs);
}

export function rateLimit(
  request: NextRequest,
  limit: number = 100,
  windowMs: number = 60000,
): { success: boolean; remaining: number; resetTime: number } {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const key = `rate_limit:${ip}`;
  const now = Date.now();

  // Periodic cleanup of expired entries to prevent memory leak
  if (rateLimitMap.size > MAX_MAP_SIZE || now - lastCleanup > CLEANUP_INTERVAL) {
    Array.from(rateLimitMap.entries()).forEach(([k, v]) => {
      if (now > v.resetTime) rateLimitMap.delete(k);
    });
    lastCleanup = now;
  }

  // Don't allow new entries if map is too large
  if (rateLimitMap.size >= MAX_MAP_SIZE) {
    return { success: false, remaining: 0, resetTime: now + windowMs };
  }

  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1, resetTime: now + windowMs };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count++;
  return {
    success: true,
    remaining: limit - record.count,
    resetTime: record.resetTime,
  };
}

export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  limit: number = 100,
  windowMs: number = 60000,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    const { success, remaining, resetTime } = await rateLimitAsync(request, limit, windowMs);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": Math.ceil(resetTime / 1000).toString(),
          },
        },
      );
    }

    const response = await handler(request);
    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", Math.ceil(resetTime / 1000).toString());
    return response;
  };
}

// CSRF Protection — session-backed for API routes.
// The proxy (src/proxy.ts) issues a csrf-token cookie on GET requests.
// For non-GET API requests we accept either:
// 1) a same-origin browser request (`Origin` / `Sec-Fetch-Site`), or
// 2) an explicit x-csrf-token header matching the csrf-token cookie.
// This protects cookie-authenticated APIs without forcing every existing
// same-origin fetch call to manually copy the token header.
export function validateCSRFToken(request: NextRequest): boolean {
  const cookie = request.cookies.get("csrf-token")?.value;
  const origin = request.headers.get("origin");
  const secFetchSite = request.headers.get("sec-fetch-site");
  const requestOrigin = request.nextUrl.origin;

  if (origin && origin === requestOrigin) {
    return true;
  }

  if (secFetchSite && ["same-origin", "same-site"].includes(secFetchSite)) {
    return true;
  }

  if (!cookie) {
    return false;
  }

  const token = request.headers.get("x-csrf-token");
  return token === cookie;
}

function requireSameOriginWriteOrDeny(request: NextRequest): { ok: true } | { ok: false; response: NextResponse } {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return { ok: true };
  }

  if (!validateCSRFToken(request)) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Invalid CSRF token" }, { status: 403 }),
    };
  }

  return { ok: true };
}

export function withCSRFProtection(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    if (request.method !== "GET" && !validateCSRFToken(request)) {
      return NextResponse.json({ success: false, error: "Invalid CSRF token" }, { status: 403 });
    }
    return handler(request);
  };
}

// Combined middleware
export function withSecurity(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: {
    rateLimit?: { limit: number; windowMs: number };
    csrf?: boolean;
  } = {},
) {
  let securedHandler = handler;

  if (options.csrf) {
    securedHandler = withCSRFProtection(securedHandler);
  }

  if (options.rateLimit) {
    securedHandler = withRateLimit(securedHandler, options.rateLimit.limit, options.rateLimit.windowMs);
  }

  return securedHandler;
}

export interface AuthenticatedUserContext {
  authUserId: string;
}

export async function requireAuthenticatedUser(
  request: NextRequest,
): Promise<{ ok: true; context: AuthenticatedUserContext } | { ok: false; response: NextResponse }> {
  const csrfCheck = requireSameOriginWriteOrDeny(request);
  if (!csrfCheck.ok) return csrfCheck;

  // Use x-user-id header set by middleware if available — avoids a second
  // getUser() call that may fail if the middleware refreshed cookies that
  // haven't propagated to the API route yet.
  const middlewareUserId = request.headers.get("x-user-id");
  if (middlewareUserId) {
    return { ok: true, context: { authUserId: middlewareUserId } };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 }),
    };
  }

  return {
    ok: true,
    context: {
      authUserId: data.user.id,
    },
  };
}

export interface UserWithSchoolContext extends AuthenticatedUserContext {
  user: User;
  schoolId: string | null;
}

type ServiceRoleClient = ReturnType<typeof createClient>;

export async function requireUserWithSchool(
  request: NextRequest,
): Promise<{ ok: true; context: UserWithSchoolContext } | { ok: false; response: NextResponse }> {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { data: userRow, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", auth.context.authUserId)
    .maybeSingle();

  if (error || !userRow) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "User profile not found" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    context: {
      authUserId: auth.context.authUserId,
      user: userRow as User,
      schoolId: ((userRow as Record<string, unknown>).school_id as string | null) ?? null,
    },
  };
}

export function assertSchoolScopeOrDeny(params: {
  userSchoolId: string | null;
  requestedSchoolId: unknown;
}): { ok: true; schoolId: string } | { ok: false; response: NextResponse } {
  const { userSchoolId, requestedSchoolId } = params;

  if (!userSchoolId) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "School context required" }, { status: 403 }),
    };
  }

  if (typeof requestedSchoolId !== "string" || requestedSchoolId.length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "School ID is required" }, { status: 400 }),
    };
  }

  if (requestedSchoolId !== userSchoolId) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, schoolId: requestedSchoolId };
}

export function assertUserRoleOrDeny(params: {
  userRole: string;
  allowedRoles: string[];
}): { ok: true } | { ok: false; response: NextResponse } {
  const { userRole, allowedRoles } = params;

  if (!allowedRoles.includes(userRole)) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true };
}

export function assertUserPermissionOrDeny(params: {
  userRole: string;
  permission: keyof RolePermissions;
}): { ok: true } | { ok: false; response: NextResponse } {
  const allowed = hasUserPermission(params);
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true };
}

export function hasUserPermission(params: { userRole: string; permission: keyof RolePermissions }): boolean {
  const { userRole, permission } = params;
  return canAccess(userRole as UserRole, permission);
}

export function hasApiAccess(params: {
  userRole: string;
  permission?: keyof RolePermissions;
  allowedRoles?: string[];
}): boolean {
  const { userRole, permission, allowedRoles } = params;

  if (permission && !hasUserPermission({ userRole, permission })) {
    return false;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return false;
  }

  return true;
}

export function assertApiAccessOrDeny(params: {
  userRole: string;
  permission?: keyof RolePermissions;
  allowedRoles?: string[];
}): { ok: true } | { ok: false; response: NextResponse } {
  if (!hasApiAccess(params)) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true };
}

export function requireDevelopmentRouteOrDeny():
  | {
      ok: true;
    }
  | {
      ok: false;
      response: NextResponse;
    } {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isExplicitlyEnabled = process.env.ENABLE_DEV_TEST_ROUTES === "true";

  if (!isDevelopment || !isExplicitlyEnabled) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Not found" }, { status: 404 }),
    };
  }

  return { ok: true };
}

export function requireCronSecretOrDeny(request: NextRequest): { ok: true } | { ok: false; response: NextResponse } {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 }),
    };
  }

  const provided = request.headers.get("x-cron-secret") || "";

  if (provided !== expected) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true };
}

function createFetchWithTimeout(defaultTimeout = 30000) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), defaultTimeout);
    const signal = init?.signal;
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timeoutId);
        controller.abort();
      });
    }
    return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
  };
}

export function createServiceRoleClientOrThrow() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Service role client is not configured");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: createFetchWithTimeout(30000),
    },
  });
}

export async function requireExistingSchoolOrDeny(params: {
  supabase: any;
  schoolId: unknown;
}): Promise<{ ok: true; schoolId: string; school: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  const { supabase, schoolId } = params;

  if (typeof schoolId !== "string" || schoolId.length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "School ID is required" }, { status: 400 }),
    };
  }

  const { data: school, error } = await supabase
    .from("schools")
    .select("id, name, school_code, subscription_status")
    .eq("id", schoolId)
    .maybeSingle();

  if (error || !school) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "School not found" }, { status: 404 }),
    };
  }

  return {
    ok: true,
    schoolId,
    school: school as Record<string, unknown>,
  };
}
