import { getSupabaseAuthCookieName } from "@/lib/supabase-cookie";

describe("getSupabaseAuthCookieName", () => {
  it("uses the active Supabase project ref", () => {
    expect(getSupabaseAuthCookieName("https://zkyuicmssloyvrrkbbnd.supabase.co")).toBe(
      "sb-zkyuicmssloyvrrkbbnd-auth-token",
    );
  });

  it("returns null for missing or malformed configuration", () => {
    expect(getSupabaseAuthCookieName()).toBeNull();
    expect(getSupabaseAuthCookieName("not a url")).toBeNull();
  });
});
