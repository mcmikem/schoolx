import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const isValidHttpUrl = (value?: string | null) => {
  if (!value || value.includes("your-supabase-url")) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

function createMockQueryBuilder() {
  const listResult = { data: [], error: null, count: 0 };
  const itemResult = { data: null, error: null, count: 0 };

  const builder: Record<string, any> = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    delete: () => builder,
    eq: () => builder,
    neq: () => builder,
    gt: () => builder,
    gte: () => builder,
    lt: () => builder,
    lte: () => builder,
    like: () => builder,
    ilike: () => builder,
    in: () => builder,
    contains: () => builder,
    overlaps: () => builder,
    is: () => builder,
    or: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    match: () => builder,
    then: (resolve: (value: typeof listResult) => unknown) =>
      Promise.resolve(resolve(listResult)),
    catch: () => Promise.resolve(listResult),
    finally: () => Promise.resolve(listResult),
    single: async () => itemResult,
    maybeSingle: async () => itemResult,
  };

  return builder;
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !isValidHttpUrl(supabaseUrl) ||
    !supabaseAnonKey ||
    supabaseAnonKey.startsWith("your-") ||
    supabaseAnonKey.includes("xxxxxxxx")
  ) {
    const mock = {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
      },
      from: () => createMockQueryBuilder(),
    };

    return mock as ReturnType<typeof createServerClient>;
  }

  return createServerClient(supabaseUrl as string, supabaseAnonKey as string, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}
