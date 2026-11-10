import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createHash } from "crypto";

// Simple in-memory cache for profile responses. Keyed by a hash of the auth
// token. TTL of 30s — short enough that role/plan changes propagate quickly,
// long enough to eliminate repeated round-trips on page navigations.
const CACHE_TTL_MS = 30_000;
const PRIVATE_NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const profileCache = new Map<string, { data: unknown; expires: number }>();

function cacheKey(token: string): string {
  // Store only a one-way digest and use the complete token as input: partial
  // suffixes can collide and return another user's cached profile.
  return createHash("sha256").update(token).digest("hex");
}

function cacheProfile(key: string, data: unknown) {
  profileCache.delete(key);
  if (profileCache.size >= 100) {
    const oldestKey = profileCache.keys().next().value;
    if (oldestKey) profileCache.delete(oldestKey);
  }
  profileCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7).trim();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = cacheKey(token);

  // Check cache
  const cached = profileCache.get(key);
  if (cached && Date.now() < cached.expires) {
    return NextResponse.json(cached.data, {
      headers: { ...PRIVATE_NO_STORE_HEADERS, "X-Cache": "HIT" },
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
    cacheProfile(key, data);

    return NextResponse.json(data, {
      headers: { ...PRIVATE_NO_STORE_HEADERS, "X-Cache": "MISS" },
    });
  } catch (error) {
    logger.error("[profile-cache] fetch failed:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}
