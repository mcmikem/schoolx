/** Return the cookie name used by Supabase SSR for this project URL. */
export function getSupabaseAuthCookieName(supabaseUrl?: string): string | null {
  if (!supabaseUrl) return null;
  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}
