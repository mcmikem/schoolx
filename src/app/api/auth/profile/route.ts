import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// Simple in-memory cache for profile responses. Keyed by a hash of the auth
// token. TTL of 30s — short enough that role/plan changes propagate quickly,
// long enough to eliminate repeated round-trips on page navigations.
const CACHE_TTL_MS = 30_000;
const profileCache = new Map<string, { data: unknown; expires: number }>();

function cacheKey(token: string): string {
  // Use last 16 chars of token as key (avoids storing full token in memory)
  return token.slice(-16);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const key = cacheKey(token);

  // Check cache
  const cached = profileCache.get(key);
  if (cached && Date.now() < cached.expires) {
    return NextResponse.json(cached.data, {
      headers: { "X-Cache": "HIT" },
    });
  }

  // Fetch fresh
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/auth/me/`, {
      headers: { authorization: authHeader },
    });
    if (!res.ok) {
      return new NextResponse(res.body, { status: res.status });
    }
    const data = await res.json();
    profileCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });

    // Evict expired entries periodically
    if (profileCache.size > 100) {
      const now = Date.now();
      for (const [k, v] of profileCache) {
        if (now > v.expires) profileCache.delete(k);
      }
    }

    return NextResponse.json(data, {
      headers: { "X-Cache": "MISS" },
    });
  } catch (error) {
    logger.error("[profile-cache] fetch failed:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}
