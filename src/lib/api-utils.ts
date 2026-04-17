import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@/types";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export function apiSuccess<T>(
  data: T,
  message?: string,
  status: number = 200,
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
    },
    { status },
  );
}

export function apiError(
  error: string,
  status: number = 400,
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status },
  );
}

export function handleApiError(error: unknown): NextResponse<ApiResponse> {
  // Sanitize error messages to prevent information leakage
  const sanitizedMessage =
    "An unexpected error occurred. Please try again later.";

  // Log the full error server-side for debugging
  if (error instanceof Error) {
    console.error("[Server Error]", {
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
  }

  return apiError(sanitizedMessage, 500);
}

export function validateRequiredFields(
  body: Record<string, unknown>,
  fields: string[],
): string | null {
  for (const field of fields) {
    if (
      body[field] === undefined ||
      body[field] === null ||
      body[field] === ""
    ) {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000; // Cleanup every minute
const MAX_MAP_SIZE = 10000; // Prevent unbounded growth

export function rateLimit(
  request: NextRequest,
  limit: number = 100,
  windowMs: number = 60000,
): { success: boolean; remaining: number; resetTime: number } {
  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const key = `rate_limit:${ip}`;
  const now = Date.now();

  // Periodic cleanup of expired entries to prevent memory leak
  if (
    rateLimitMap.size > MAX_MAP_SIZE ||
    now - lastCleanup > CLEANUP_INTERVAL
  ) {
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
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const { success, remaining, resetTime } = rateLimit(
      request,
      limit,
      windowMs,
    );

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
    response.headers.set(
      "X-RateLimit-Reset",
      Math.ceil(resetTime / 1000).toString(),
    );
    return response;
  };
}

// CSRF Protection
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function validateCSRFToken(request: NextRequest): boolean {
  const token = request.headers.get("x-csrf-token");
  const cookie = request.cookies.get("csrf-token")?.value;

  if (!token || !cookie) {
    return false;
  }

  return token === cookie;
}

export function withCSRFProtection(
  handler: (request: NextRequest) => Promise<NextResponse>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    if (request.method !== "GET" && !validateCSRFToken(request)) {
      return NextResponse.json(
        { success: false, error: "Invalid CSRF token" },
        { status: 403 },
      );
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
    securedHandler = withRateLimit(
      securedHandler,
      options.rateLimit.limit,
      options.rateLimit.windowMs,
    );
  }

  return securedHandler;
}

export interface AuthenticatedUserContext {
  authUserId: string;
}

export async function requireAuthenticatedUser(
  request: NextRequest,
): Promise<
  | { ok: true; context: AuthenticatedUserContext }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      ),
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
): Promise<
  | { ok: true; context: UserWithSchoolContext }
  | { ok: false; response: NextResponse }
> {
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
      response: NextResponse.json(
        { success: false, error: "User profile not found" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    context: {
      authUserId: auth.context.authUserId,
      user: userRow as User,
      schoolId: (userRow as any).school_id ?? null,
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
      response: NextResponse.json(
        { success: false, error: "School context required" },
        { status: 403 },
      ),
    };
  }

  if (typeof requestedSchoolId !== "string" || requestedSchoolId.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "School ID is required" },
        { status: 400 },
      ),
    };
  }

  if (requestedSchoolId !== userSchoolId) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      ),
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
      response: NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      ),
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
      response: NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 },
      ),
    };
  }

  return { ok: true };
}

export function requireCronSecretOrDeny(
  request: NextRequest,
): { ok: true } | { ok: false; response: NextResponse } {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 },
      ),
    };
  }

  const provided =
    request.headers.get("x-cron-secret") ||
    request.nextUrl.searchParams.get("cron_secret") ||
    "";

  if (provided !== expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  return { ok: true };
}

export function createServiceRoleClientOrThrow(): any {
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
  }) as any;
}

export async function requireExistingSchoolOrDeny(params: {
  supabase: any;
  schoolId: unknown;
}): Promise<
  | { ok: true; schoolId: string; school: Record<string, unknown> }
  | { ok: false; response: NextResponse }
> {
  const { supabase, schoolId } = params;

  if (typeof schoolId !== "string" || schoolId.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "School ID is required" },
        { status: 400 },
      ),
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
      response: NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 },
      ),
    };
  }

  return {
    ok: true,
    schoolId,
    school: school as Record<string, unknown>,
  };
}
