import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const defaultSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const defaultSupabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

interface MiddlewareClientOptions {
  supabaseUrl?: string;
  supabaseKey?: string;
}

export const createMiddlewareClient = (
  request: NextRequest,
  options?: MiddlewareClientOptions,
) => {
  const supabaseUrl = options?.supabaseUrl || defaultSupabaseUrl;
  const supabaseKey = options?.supabaseKey || defaultSupabaseKey;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  // Create an unmodified response.
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  return { supabase, supabaseResponse };
};

// Backward-compatible helper from the original scaffold.
export const createClient = (request: NextRequest) => {
  const middlewareClient = createMiddlewareClient(request);
  if (!middlewareClient) {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }

  return middlewareClient.supabaseResponse;
};
