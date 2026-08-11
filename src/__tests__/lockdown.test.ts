// ============================================================================
// 🔒 LOCKDOWN TESTS — LOGIN / REGISTER / AUTH FLOW
// ============================================================================
// These tests verify critical invariants that MUST NOT change.
// If any test fails, DO NOT modify the test — fix the source code.
//
// Run: npm test -- --testPathPattern=lockdown
// ============================================================================

import { describe, it, expect } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";

const ROOT = process.cwd();

function read(filePath: string): string {
  return fs.readFileSync(path.join(ROOT, filePath), "utf8");
}

// ============================================================================
// TIER 1: CRITICAL — Login Page Invariants
// ============================================================================
describe("🔒 LOCKDOWN: Login Page", () => {
  const loginPage = read("src/app/login/page.tsx");

  it("must use router.replace() for post-login redirects (not router.push)", () => {
    expect(loginPage).toContain("router.replace(");
    expect(loginPage).not.toMatch(/router\.push\(["']\/dashboard/);
    expect(loginPage).not.toMatch(/router\.push\(["']\/super-admin/);
    expect(loginPage).not.toMatch(/router\.push\(["']\/parent-portal/);
  });

  it("must have correct 12-digit demo phone numbers", () => {
    expect(loginPage).toContain("256700000001");
    expect(loginPage).toContain("256700000002");
    expect(loginPage).toContain("256700000003");
    expect(loginPage).toContain("256700000004");
    // Must NOT have 11-digit variants
    expect(loginPage).not.toContain("25670000001");
    expect(loginPage).not.toContain("25670000002");
  });

  it("must use magiclink type for OTP verification (not email type)", () => {
    // Check the actual verifyOtp call, not comments
    expect(loginPage).toContain('type: "magiclink"');
    expect(loginPage).toContain("token: data.token");
    expect(loginPage).toContain("email: data.email");
    // Must NOT use the old broken pattern in actual code (check for the call, not comments)
    const verifyCall = loginPage.match(/verifyOtp\(\{[\s\S]*?\}\)/);
    expect(verifyCall).toBeTruthy();
    expect(verifyCall![0]).toContain("token: data.token");
    expect(verifyCall![0]).not.toContain("token_hash");
    expect(verifyCall![0]).not.toContain('type: "email"');
  });

  it("must normalize phone numbers before login attempt", () => {
    expect(loginPage).toContain("normalizeAuthPhone");
  });

  it("must have client-side rate limiting with lockout", () => {
    expect(loginPage).toContain("lockoutUntil");
    expect(loginPage).toContain("failedAttempts");
    expect(loginPage).toContain("Too many attempts");
  });

  it("must have Google OAuth with correct callback URL", () => {
    expect(loginPage).toContain("/auth/callback");
    expect(loginPage).toContain('prompt: "select_account"');
  });

  it("must have OTP mode toggle", () => {
    expect(loginPage).toContain("otpMode");
    expect(loginPage).toContain("Login with OTP instead");
    expect(loginPage).toContain("Login with password");
  });

  it("must have demo mode with correct env var checks", () => {
    expect(loginPage).toContain("NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES");
    expect(loginPage).toContain("DEMO_MODE_ENABLED");
  });

  it("must have slow connection message", () => {
    expect(loginPage).toContain("showSlowMessage");
    expect(loginPage).toContain("Connection seems slow");
  });

  it("must have remember session feature", () => {
    expect(loginPage).toContain("remember_session");
    expect(loginPage).toContain("rememberSession");
  });
});

// ============================================================================
// TIER 1: CRITICAL — Register Page Invariants
// ============================================================================
describe("🔒 LOCKDOWN: Register Page", () => {
  const registerPage = read("src/app/register/page.tsx");

  it("must use router.replace() for all redirects (not router.push)", () => {
    expect(registerPage).toContain("router.replace(");
    expect(registerPage).not.toMatch(/router\.push\(["']\/dashboard/);
    expect(registerPage).not.toMatch(/router\.push\(["']\/login/);
  });

  it("must try both email candidates for auto sign-in", () => {
    expect(registerPage).toContain("emailCandidates");
    expect(registerPage).toContain("@omuto.org");
  });

  it("must use trailing slash on API endpoints", () => {
    expect(registerPage).toContain("/api/register/");
    expect(registerPage).toContain("/api/register/oauth/");
  });

  it("must have Google OAuth registration mode", () => {
    expect(registerPage).toContain("googleRegisterMode");
    expect(registerPage).toContain("oauth");
  });

  it("must validate Uganda phone format", () => {
    expect(registerPage).toContain("0700000000");
    expect(registerPage).toContain("+256700000000");
  });

  it("must have 3-step registration flow", () => {
    expect(registerPage).toContain("Step 1 of 3");
    expect(registerPage).toContain("Step 2 of 3");
    expect(registerPage).toContain("Step 3 of 3");
  });

  it("must use withSupabaseLockRetry for sign-in attempts", () => {
    expect(registerPage).toContain("withSupabaseLockRetry");
  });

  it("must have progressive back-off for auto sign-in retries", () => {
    expect(registerPage).toContain("attempt * 1500");
  });
});

// ============================================================================
// TIER 1: CRITICAL — Auth Context Invariants
// ============================================================================
describe("🔒 LOCKDOWN: Auth Context", () => {
  const authContext = read("src/lib/auth-context.tsx");

  it("must use local scope for signOut", () => {
    expect(authContext).toContain('scope: "local"');
    expect(authContext).not.toContain('scope: "global"');
  });

  it("must use router.replace() for signOut redirect", () => {
    expect(authContext).toContain('router.replace("/login")');
    expect(authContext).not.toContain('router.push("/login")');
  });

  it("must use router.replace() for visibility change redirect", () => {
    // The visibility change handler must use replace, not push
    const visibilityHandler = authContext.match(/handleVisibilityChange[\s\S]*?router\.(push|replace)/);
    expect(visibilityHandler).toBeTruthy();
    expect(visibilityHandler![0]).toContain("replace");
  });

  it("must NOT call fetchUserData from signIn()", () => {
    // signIn() returns early — onAuthStateChange is the single source of truth
    // Extract the signIn function body (between "async function signIn" and the closing "}"
    const signInMatch = authContext.match(/async function signIn\([\s\S]*?^\s{2}\}\s*$/m);
    expect(signInMatch).toBeTruthy();
    const signInBody = signInMatch![0];
    // The signIn function should NOT contain fetchUserData call
    expect(signInBody).not.toMatch(/await\s+fetchUserData/);
    expect(signInBody).not.toMatch(/fetchUserData\(/);
  });

  it("must only set loading=true on SIGNED_IN event", () => {
    expect(authContext).toContain('if (event === "SIGNED_IN") setLoading(true)');
    // Must NOT set loading on INITIAL_SESSION or TOKEN_REFRESHED
    expect(authContext).not.toContain('if (event === "INITIAL_SESSION") setLoading');
    expect(authContext).not.toContain('if (event === "TOKEN_REFRESHED") setLoading');
  });

  it("must use withSupabaseLockRetry for getUser calls", () => {
    expect(authContext).toContain("withSupabaseLockRetry");
  });

  it("must have network error detection that preserves user state", () => {
    expect(authContext).toContain("isNetworkError");
    expect(authContext).toContain("keeping cached user");
    expect(authContext).toContain("visibilitychange");
  });

  it("must have safety timer for auth initialization", () => {
    expect(authContext).toContain("safetyTimer");
    expect(authContext).toContain("2000");
  });

  it("must have signIn lock to prevent double-click", () => {
    expect(authContext).toContain("signInLock");
    expect(authContext).toContain("Login already in progress");
  });

  it("must have offline cache persistence", () => {
    expect(authContext).toContain("OFFLINE_USER_KEY");
    expect(authContext).toContain("OFFLINE_SCHOOL_KEY");
  });

  it("must reset authFetchAborted on mount (StrictMode compat)", () => {
    expect(authContext).toContain("authFetchAborted.current = false");
  });

  it("must have demo mode support with decryptDemoData", () => {
    expect(authContext).toContain("decryptDemoData");
    expect(authContext).toContain("readDemoStorage");
  });

  it("must NOT short-circuit on demo data when SIGNED_IN fires", () => {
    // The broken pattern was: if (isCurrentlyDemo && event !== "SIGNED_OUT") return;
    // This silently swallows real SIGNED_IN events when demo localStorage exists.
    // The correct handler clears demo storage on SIGNED_IN and falls through.
    const demoCheckLine = authContext.match(/if \(isCurrentlyDemo && event !== "SIGNED_OUT"\)\s*\{/);
    expect(demoCheckLine).toBeTruthy();
    const lineStart = authContext.indexOf(demoCheckLine![0]);
    const block = authContext.slice(lineStart, lineStart + 1600);
    // Must not be the broken single-line return
    expect(block).not.toMatch(/isCurrentlyDemo && event !== "SIGNED_OUT"\) return;/);
    // Must have the SIGNED_IN branch that clears demo storage
    expect(block).toContain('if (event === "SIGNED_IN") {');
    expect(block).toContain("clearDemoStorage()");
  });

  it("must handle 401/404/502/503/504 errors in fetchUserData", () => {
    expect(authContext).toContain("res.status === 404");
    expect(authContext).toContain("res.status === 401");
    expect(authContext).toContain("res.status === 502");
    expect(authContext).toContain("res.status === 503");
    expect(authContext).toContain("res.status === 504");
  });

  it("must refresh offline cache on successful sign-in", () => {
    expect(authContext).toContain("offlineDB");
    expect(authContext).toContain("refreshAll");
  });

  it("must keep a valid session when profile fetch fails (degraded login, NOT signout)", () => {
    // A valid Supabase session must never be discarded just because the profile
    // endpoint errored. Fall back to the cached/metadata user instead — the old
    // "logged in on another device" lockout stranded users on login.
    expect(authContext).toContain("applyDegradedUser");
    expect(authContext).toContain("applyDegradedUser(verifiedUser)");
    expect(authContext).toContain("applyDegradedUser(authUser)");
    expect(authContext).not.toMatch(/if \(!profile && navigator\.onLine\) \{\s*clearAuthState\(\);/);
    expect(authContext).not.toContain("another device");
  });

  it("must still sign out (and only sign out) when the profile is genuinely missing (404)", () => {
    expect(authContext).toContain("res.status === 404");
    expect(authContext).toContain("signOut()");
    expect(authContext).toContain("clearAuthState()");
  });

  it("must build a degraded user from auth user_metadata role", () => {
    // role must be read from user_metadata (every provisioning path stores it)
    expect(authContext).toContain('typeof meta.role === "string" ? (meta.role as User["role"]) : undefined');
  });

  it("login page must not blame another device when profile load fails", () => {
    const loginPage = read("src/app/login/page.tsx");
    expect(loginPage).not.toContain("another device");
    expect(loginPage).toContain("refresh the page to try again");
  });
});

// ============================================================================
// TIER 1: CRITICAL — Proxy/Middleware Invariants
// ============================================================================
describe("🔒 LOCKDOWN: Proxy Middleware", () => {
  const proxy = read("src/proxy.ts");

  it("must have /auth/callback in public paths", () => {
    expect(proxy).toContain('"/auth/callback"');
  });

  it("must have /forgot-password in public paths", () => {
    expect(proxy).toContain('"/forgot-password"');
  });

  it("must have /reset-password in public paths", () => {
    expect(proxy).toContain('"/reset-password"');
  });

  it("must have /login in public paths", () => {
    expect(proxy).toContain('"/login"');
  });

  it("must have /register in public paths", () => {
    expect(proxy).toContain('"/register"');
  });

  it("must have parent role in DEMO_ALLOWED_ROLES", () => {
    expect(proxy).toContain('"parent"');
  });

  it("must have CSRF token issuance", () => {
    expect(proxy).toContain("csrf-token");
    expect(proxy).toContain("httpOnly: false");
  });

  it("must have security headers (HSTS, X-Frame-Options, CSP)", () => {
    expect(proxy).toContain("Strict-Transport-Security");
    expect(proxy).toContain("X-Frame-Options");
    expect(proxy).toContain("Content-Security-Policy");
  });

  it("must allow local Supabase in dev CSP", () => {
    expect(proxy).toContain("http://127.0.0.1:*");
    expect(proxy).toContain("http://localhost:*");
  });

  it("must redirect unauthenticated users to login with redirect param", () => {
    expect(proxy).toContain('"/login"');
    expect(proxy).toContain("redirect");
    expect(proxy).toContain("session_expired");
  });

  it("must check user is_active status", () => {
    expect(proxy).toContain("is_active");
    expect(proxy).toContain('"inactive"');
  });
});

// ============================================================================
// TIER 1: CRITICAL — Register API Invariants
// ============================================================================
describe("🔒 LOCKDOWN: Register API", () => {
  const registerApi = read("src/app/api/register/route.ts");

  it("must use supabaseAdmin (service role)", () => {
    expect(registerApi).toContain("supabaseAdmin");
    expect(registerApi).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("must have rate limiting", () => {
    expect(registerApi).toContain("rateLimit");
    expect(registerApi).toContain("600_000"); // 10 minutes
  });

  it("must have honeypot field for bot protection", () => {
    expect(registerApi).toContain("_gotcha");
  });

  it("must generate unique school code with timestamp", () => {
    expect(registerApi).toContain("Date.now()");
    expect(registerApi).toContain("schoolCode");
  });

  it("must have cleanup on failure (delete auth user + school)", () => {
    expect(registerApi).toContain("deleteUser");
    expect(registerApi).toContain(".delete()");
  });

  it("must auto-confirm email", () => {
    expect(registerApi).toContain("email_confirm: true");
  });

  it("must use @omuto.org email fallback", () => {
    expect(registerApi).toContain("@omuto.org");
  });

  it("must seed curriculum data (subjects, classes, terms, events)", () => {
    expect(registerApi).toContain("subjects");
    expect(registerApi).toContain("classes");
    expect(registerApi).toContain("academic_terms");
    expect(registerApi).toContain("events");
  });

  it("must set trial subscription status", () => {
    expect(registerApi).toContain('"trial"');
    expect(registerApi).toContain("trial_ends_at");
  });
});

// ============================================================================
// TIER 1: CRITICAL — OAuth Register API Invariants
// ============================================================================
describe("🔒 LOCKDOWN: OAuth Register API", () => {
  const oauthApi = read("src/app/api/register/oauth/route.ts");

  it("must check authenticated user before registration", () => {
    expect(oauthApi).toContain("supabase.auth.getUser()");
  });

  it("must check for existing auth_id", () => {
    expect(oauthApi).toContain("existingByAuth");
    expect(oauthApi).toContain("auth_id");
  });

  it("must check for existing phone number", () => {
    expect(oauthApi).toContain("existingByPhone");
  });

  it("must use school provisioning helpers", () => {
    expect(oauthApi).toContain("reserveUniqueSchoolCode");
    expect(oauthApi).toContain("seedSchoolDefaults");
  });

  it("must update auth user metadata", () => {
    expect(oauthApi).toContain("updateUserById");
    expect(oauthApi).toContain("oauth_registered");
  });
});

// ============================================================================
// TIER 1: CRITICAL — Auth Callback Invariants
// ============================================================================
describe("🔒 LOCKDOWN: Auth Callback", () => {
  const callback = read("src/app/auth/callback/route.ts");

  it("must exchange code for session", () => {
    expect(callback).toContain("exchangeCodeForSession");
  });

  it("must check for existing profile", () => {
    expect(callback).toContain("maybeSingle");
    expect(callback).toContain("profile");
  });

  it("must redirect to register if no profile found", () => {
    expect(callback).toContain("/register");
    expect(callback).toContain('"oauth"');
  });

  it("must sanitize next param to prevent open redirect", () => {
    expect(callback).toContain("sanitizeNext");
    expect(callback).toContain('startsWith("/")');
  });
});

// ============================================================================
// TIER 1: CRITICAL — OTP API Invariants
// ============================================================================
describe("🔒 LOCKDOWN: OTP APIs", () => {
  const otpSend = read("src/app/api/auth/otp/route.ts");
  const otpVerify = read("src/app/api/auth/verify-otp/route.ts");

  it("OTP send must use Africa's Talking SMS", () => {
    expect(otpSend).toContain("sendAfricasTalkingSMSWithRetry");
    expect(otpSend).toContain("formatUgandaPhone");
  });

  it("OTP send must not leak user existence", () => {
    expect(otpSend).toContain("If this phone is registered");
  });

  it("OTP send must have demo mode fallback", () => {
    expect(otpSend).toContain("demoOtp");
    expect(otpSend).toContain("AFRICAS_TALKING_API_KEY");
  });

  it("OTP verify must return email for magiclink verification", () => {
    expect(otpVerify).toContain("email: authEmail");
    expect(otpVerify).toContain("token");
  });

  it("OTP verify must use generateLink for session creation", () => {
    expect(otpVerify).toContain("generateLink");
    expect(otpVerify).toContain("magiclink");
  });

  it("OTP verify must mark OTP as used", () => {
    expect(otpVerify).toContain("used: true");
  });

  it("OTP verify must check expiry", () => {
    expect(otpVerify).toContain("expires_at");
  });
});

// ============================================================================
// TIER 2: Auth Library Invariants
// ============================================================================
describe("🔒 LOCKDOWN: Auth Library", () => {
  it("auth-login must build email from phone with @omuto.org", () => {
    const authLogin = read("src/lib/auth-login.ts");
    expect(authLogin).toContain("@omuto.org");
    expect(authLogin).toContain("buildAuthEmailFromPhone");
  });

  it("auth-login must build login attempts array", () => {
    const authLogin = read("src/lib/auth-login.ts");
    expect(authLogin).toContain("buildAuthLoginAttempts");
  });

  it("auth-phone must build lookup candidates", () => {
    const authPhone = read("src/lib/auth-phone.ts");
    expect(authPhone).toContain("buildPhoneLookupCandidates");
  });

  it("auth-demo must have encrypt/decrypt functions", () => {
    const authDemo = read("src/lib/auth-demo.ts");
    expect(authDemo).toContain("decryptDemoData");
    expect(authDemo).toContain("readDemoStorage");
    expect(authDemo).toContain("clearDemoStorage");
  });

  it("supabase-lock must have retry function", () => {
    const supabaseLock = read("src/lib/supabase-lock.ts");
    expect(supabaseLock).toContain("withSupabaseLockRetry");
    expect(supabaseLock).toContain("isSupabaseLockAbortError");
  });

  it("validation must have normalizeAuthPhone", () => {
    const validation = read("src/lib/validation.ts");
    expect(validation).toContain("normalizeAuthPhone");
  });

  it("session timeout must have 30-minute default", () => {
    const sessionTimeout = read("src/lib/useSessionTimeout.ts");
    expect(sessionTimeout).toContain("30");
    expect(sessionTimeout).toContain("60");
    expect(sessionTimeout).toContain("1000");
  });
});

// ============================================================================
// TIER 2: Demo Login API Invariants
// ============================================================================
describe("🔒 LOCKDOWN: Demo Login API", () => {
  const demoLogin = read("src/app/api/demo-login/route.ts");

  it("must require development route", () => {
    expect(demoLogin).toContain("requireDevelopmentRouteOrDeny");
  });

  it("must have rate limiting", () => {
    expect(demoLogin).toContain("rateLimit");
  });

  it("must validate demo password", () => {
    expect(demoLogin).toContain("DEMO_ADMIN_PASSWORD");
  });
});

// ============================================================================
// TIER 2: Password Reset API Invariants
// ============================================================================
describe("🔒 LOCKDOWN: Password Reset APIs", () => {
  it("forgot-password must use Supabase resetPassword", () => {
    const forgotPassword = read("src/app/api/forgot-password/route.ts");
    expect(forgotPassword).toContain("resetPasswordForEmail");
  });

  it("reset-password must validate token", () => {
    const resetPassword = read("src/app/api/reset-password/route.ts");
    expect(resetPassword).toContain("token");
    expect(resetPassword).toContain("updateUserById");
  });
});

// ============================================================================
// TIER 2: Onboarding Invariants
// ============================================================================
describe("🔒 LOCKDOWN: Onboarding", () => {
  const onboarding = read("src/components/onboarding/OnboardingFlow.tsx");

  it("must have 5 steps", () => {
    expect(onboarding).toContain("TOTAL_STEPS");
  });

  it("must save fees with class_id: null", () => {
    expect(onboarding).toContain("class_id: null");
  });

  it("must have handleGenericNext that checks save success", () => {
    expect(onboarding).toContain("handleGenericNext");
    // Must check return value of save functions
    expect(onboarding).toMatch(/if \(await save\w+\(\)\)/);
  });

  it("must seed classes, terms, events, subjects on completion", () => {
    expect(onboarding).toContain("buildDefaultClasses");
    expect(onboarding).toContain("buildUgandaAcademicTerms");
    expect(onboarding).toContain("buildUgandaCalendarEvents");
  });

  it("must update onboarding_completed flag", () => {
    expect(onboarding).toContain("onboarding_completed");
    expect(onboarding).toContain("onboarding_complete");
  });
});
