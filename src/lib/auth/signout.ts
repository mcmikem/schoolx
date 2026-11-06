// Sign-out logic extracted from auth-context.tsx.
// Force-clears cookies and storage even if the signOut API call fails.
import { OFFLINE_USER_KEY, OFFLINE_SCHOOL_KEY } from "../auth-context-types";
import { clearDemoStorage } from "../auth-demo";
import { logger } from "../logger";
import { supabase } from "../supabase";

export async function doSignOut(params: {
  router: { replace: (path: string) => void };
  explicitSignOutRef: { current: boolean };
  setUser: (u: null) => void;
  setSchool: (s: null) => void;
  setIsDemo: (v: boolean) => void;
  setIsTrialExpired: (v: boolean) => void;
}) {
  const { router, explicitSignOutRef, setUser, setSchool, setIsDemo, setIsTrialExpired } = params;
  explicitSignOutRef.current = true;
  try {
    await supabase!.auth.signOut({ scope: "local" });
  } catch {
    logger.warn("signOut API call failed, clearing session locally");
  }
  try {
    localStorage.removeItem(OFFLINE_USER_KEY);
    localStorage.removeItem(OFFLINE_SCHOOL_KEY);
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const name = cookie.split("=")[0].trim();
      if (name.startsWith("sb-")) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    }
  } catch {
    // Ignore cookie/storage clearing errors
  }
  setUser(null);
  setSchool(null);
  setIsDemo(false);
  setIsTrialExpired(false);
  clearDemoStorage();
  router.replace("/login");
}
