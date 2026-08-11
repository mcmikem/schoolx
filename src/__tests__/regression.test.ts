// Regression tests for all fixes applied during production hardening
// Run: npm test -- --testPathPattern=regression

import { describe, it, expect } from "@jest/globals";

describe("Production Hardening Regression Tests", () => {
  describe("Auth Flow", () => {
    it("should have trailing slash on register API endpoint", () => {
      const registerPage = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/register/page.tsx"),
        "utf8",
      );
      expect(registerPage).toContain("/api/register/");
    });

    it("should have trailing slash on setup-admin API endpoint", () => {
      const setupAdminPage = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/setup-admin/page.tsx"),
        "utf8",
      );
      expect(setupAdminPage).toContain("/api/setup-admin/");
    });

    it("should use local scope for signOut", () => {
      const authContext = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/lib/auth-context.tsx"),
        "utf8",
      );
      expect(authContext).toContain('scope: "local"');
      expect(authContext).not.toContain('scope: "global"');
    });

    it("should have parent role in DEMO_ALLOWED_ROLES", () => {
      const proxy = require("fs").readFileSync(require("path").join(process.cwd(), "src/proxy.ts"), "utf8");
      expect(proxy).toContain('"parent"');
    });

    it("should have CSRF token as non-httpOnly", () => {
      const proxy = require("fs").readFileSync(require("path").join(process.cwd(), "src/proxy.ts"), "utf8");
      expect(proxy).toContain("httpOnly: false");
    });
  });

  describe("Automation Fixes", () => {
    it("should use sendAfricasTalkingSMSWithRetry in fee reminders", () => {
      const feeReminder = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/automation/auto-fee-reminder/route.ts"),
        "utf8",
      );
      expect(feeReminder).toContain("sendAfricasTalkingSMSWithRetry");
    });

    it("should use sendAfricasTalkingSMSWithRetry in attendance followup", () => {
      const attendanceFollowup = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/automation/auto-attendance-followup/route.ts"),
        "utf8",
      );
      expect(attendanceFollowup).toContain("sendAfricasTalkingSMSWithRetry");
    });

    it("should use sendAfricasTalkingSMSWithRetry in installment reminders", () => {
      const installmentReminder = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/automation/auto-installment-reminder/route.ts"),
        "utf8",
      );
      expect(installmentReminder).toContain("sendAfricasTalkingSMSWithRetry");
    });

    it("should use sendAfricasTalkingSMSWithRetry in attendance heartbeat", () => {
      const heartbeat = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/automation/attendance-heartbeat/route.ts"),
        "utf8",
      );
      expect(heartbeat).toContain("sendAfricasTalkingSMSWithRetry");
    });

    it("should use sendAfricasTalkingSMSWithRetry in inventory alerts", () => {
      const inventoryAlerts = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/automation/auto-inventory-alerts/route.ts"),
        "utf8",
      );
      expect(inventoryAlerts).toContain("sendAfricasTalkingSMSWithRetry");
    });

    it("should use sendAfricasTalkingSMSWithRetry in term-end", () => {
      const termEnd = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/automation/term-end/route.ts"),
        "utf8",
      );
      expect(termEnd).toContain("sendAfricasTalkingSMSWithRetry");
    });

    it("should have idempotency check in term-end report cards", () => {
      const termEnd = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/automation/term-end/route.ts"),
        "utf8",
      );
      expect(termEnd).toContain("existingCard");
    });

    it("should track failed seeding in onboarding", () => {
      const onboarding = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/components/onboarding/OnboardingFlow.tsx"),
        "utf8",
      );
      expect(onboarding).toContain("failedSeeding");
    });

    it("should have error logging in term-end catch blocks", () => {
      const termEnd = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/automation/term-end/route.ts"),
        "utf8",
      );
      expect(termEnd).toContain("logger.warn");
      expect(termEnd).not.toMatch(/catch\s*\(\s*_\s*\)\s*\{/);
    });
  });

  describe("Webhook Fixes", () => {
    it("should not return 500 in Stripe webhook handlers", () => {
      const stripeWebhook = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/payment/webhook/route.ts"),
        "utf8",
      );
      expect(stripeWebhook).not.toContain(
        'return new NextResponse(\n            JSON.stringify({ error: "Failed to process checkout session" })',
      );
    });

    it("should have charge.refunded handler in Stripe webhook", () => {
      const stripeWebhook = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/payment/webhook/route.ts"),
        "utf8",
      );
      expect(stripeWebhook).toContain("charge.refunded");
    });

    it("should have MoneyUnify HMAC signature verification in mobile money webhook", () => {
      const mobileMoney = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/payment/webhook/mobile-money/route.ts"),
        "utf8",
      );
      expect(mobileMoney).toContain("verifyMoneyUnifySignature");
      expect(mobileMoney).toContain("crypto.timingSafeEqual");
    });
  });

  describe("API Route Fixes", () => {
    it("should have rate limiting on sync endpoint", () => {
      const syncRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/sync/route.ts"),
        "utf8",
      );
      expect(syncRoute).toContain("withSecurity");
      expect(syncRoute).toContain("rateLimit");
    });

    it("should not fall back to anon key in sync endpoint", () => {
      const syncRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/sync/route.ts"),
        "utf8",
      );
      expect(syncRoute).not.toContain("supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
    });

    it("should have SMS delivery DB update uncommented", () => {
      const smsRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/sms/route.ts"),
        "utf8",
      );
      expect(smsRoute).toContain('.from("messages")');
      expect(smsRoute).toContain(".update({ status })");
      expect(smsRoute).toContain(".update({ delivery_status");
    });

    it("should use direct SMS call in sms-automation", () => {
      const smsAutomation = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/lib/sms-automation.ts"),
        "utf8",
      );
      expect(smsAutomation).toContain("sendAfricasTalkingSMS");
      expect(smsAutomation).not.toContain("fetch('/api/sms'");
    });

    it("should iterate over schools in cron job", () => {
      const cronRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/cron/sms-reminders/route.ts"),
        "utf8",
      );
      expect(cronRoute).toContain("schools");
    });

    it("should have health endpoint auth check", () => {
      const healthRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/health/route.ts"),
        "utf8",
      );
      expect(healthRoute).toContain("CRON_SECRET");
    });
  });

  describe("UI/UX Fixes", () => {
    it("should use shared MaterialIcon in login page", () => {
      const loginPage = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/login/page.tsx"),
        "utf8",
      );
      expect(loginPage).toContain('from "@/components/MaterialIcon"');
    });

    it("should use shared MaterialIcon in register page", () => {
      const registerPage = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/register/page.tsx"),
        "utf8",
      );
      expect(registerPage).toContain('from "@/components/MaterialIcon"');
    });

    it("should have responsive widths for OwlAssistant", () => {
      const owlAssistant = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/components/OwlAssistant.tsx"),
        "utf8",
      );
      expect(owlAssistant).toContain("max-w-[360px]");
    });

    it("should have avatar lazy loading", () => {
      const uiIndex = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/components/ui/index.tsx"),
        "utf8",
      );
      expect(uiIndex).toContain('loading="lazy"');
    });

    it("should not have duplicate fees-lookup route", () => {
      const fs = require("fs");
      const path = require("path");
      const feesLookupPath = path.join(process.cwd(), "src/app/dashboard/fees-lookup/page.tsx");
      expect(fs.existsSync(feesLookupPath)).toBe(false);
    });

    it("should have PWA install prompt component", () => {
      const fs = require("fs");
      const path = require("path");
      const pwaPromptPath = path.join(process.cwd(), "src/components/PWAInstallPrompt.tsx");
      expect(fs.existsSync(pwaPromptPath)).toBe(true);
    });
  });

  describe("Marketer Features", () => {
    it("should have commission amounts (70k/80k/4k) in marketer logic", () => {
      const marketerLogic = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/lib/server/marketer-logic.ts"),
        "utf8",
      );
      expect(marketerLogic).toContain("70000");
      expect(marketerLogic).toContain("80000");
      expect(marketerLogic).toContain("4000");
    });

    it("should have digitization fee validation (10000-50000) in register route", () => {
      const registerRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/marketers/register/route.ts"),
        "utf8",
      );
      expect(registerRoute).toContain("10000");
      expect(registerRoute).toContain("50000");
    });

    it("should return adminPhone and adminEmail in registration response", () => {
      const registerRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/marketers/register/route.ts"),
        "utf8",
      );
      expect(registerRoute).toContain("adminPhone");
      expect(registerRoute).toContain("adminEmail");
    });

    it("should validate required fields in marketer registration", () => {
      const registerRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/marketers/register/route.ts"),
        "utf8",
      );
      expect(registerRoute).toContain("All required fields must be filled");
      expect(registerRoute).toContain("School name must be at least 3 characters");
      expect(registerRoute).toContain("Password must be at least 8 characters");
      expect(registerRoute).toContain("Invalid phone number format");
    });

    it("should have Sign Out button in MarketerDashboard", () => {
      const dashboard = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/dashboard/dashboards/MarketerDashboard.tsx"),
        "utf8",
      );
      expect(dashboard).toContain("Sign Out");
    });

    it("should query onboarding_completed in marketer data route", () => {
      const dataRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/marketers/data/route.ts"),
        "utf8",
      );
      expect(dataRoute).toContain("onboarding_completed");
    });

    it("should have COMMISSION_RATES map in MarketerDashboard", () => {
      const dashboard = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/dashboard/dashboards/MarketerDashboard.tsx"),
        "utf8",
      );
      expect(dashboard).toContain("COMMISSION_RATES");
      expect(dashboard).toContain("70000");
      expect(dashboard).toContain("80000");
    });
  });

  describe("Super Admin Features", () => {
    it("should check super_admin role in audit route", () => {
      const auditRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/audit/route.ts"),
        "utf8",
      );
      expect(auditRoute).toContain('role !== "super_admin"');
    });

    it("should have marketer analytics summary cards in super admin page", () => {
      const superAdminPage = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/super-admin/_marketers-tab.tsx"),
        "utf8",
      );
      expect(superAdminPage).toContain("totalEarnings");
      expect(superAdminPage).toContain("totalPending");
      expect(superAdminPage).toContain("avgPerMarketer");
      expect(superAdminPage).toContain("marketers.length");
    });
  });

  describe("Cron – Trial Expiry", () => {
    it("should use requireCronSecretOrDeny guard in expire-trials", () => {
      const cronRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/cron/expire-trials/route.ts"),
        "utf8",
      );
      expect(cronRoute).toContain("requireCronSecretOrDeny");
    });

    it("should filter by subscription_status = trial and trial_ends_at < now", () => {
      const cronRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/cron/expire-trials/route.ts"),
        "utf8",
      );
      expect(cronRoute).toContain('"trial"');
      expect(cronRoute).toContain("trial_ends_at");
    });

    it("should set subscription_status to expired on update", () => {
      const cronRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/cron/expire-trials/route.ts"),
        "utf8",
      );
      expect(cronRoute).toContain('"expired"');
    });
  });

  describe("Admin Login Link (Magic Link)", () => {
    it("should have send-admin-login-link API endpoint", () => {
      const route = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/marketers/send-admin-login-link/route.ts"),
        "utf8",
      );
      expect(route).toContain("generateLink");
      expect(route).toContain("magiclink");
      expect(route).toContain("resend.com/emails");
    });

    it("should require marketer role in send-admin-login-link", () => {
      const route = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/marketers/send-admin-login-link/route.ts"),
        "utf8",
      );
      expect(route).toContain('"marketer"');
      expect(route).toContain("requireAuthenticatedUser");
    });

    it("should have Send Login Link button in MarketerDashboard", () => {
      const dashboard = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/dashboard/dashboards/MarketerDashboard.tsx"),
        "utf8",
      );
      expect(dashboard).toContain("sendLoginLink");
      expect(dashboard).toContain("Send Login Link");
      expect(dashboard).toContain("/api/marketers/send-admin-login-link/");
    });
  });

  describe("Subscription Upgrade", () => {
    it("should validate plan ordering in upgrade route", () => {
      const upgradeRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/subscription/upgrade/route.ts"),
        "utf8",
      );
      expect(upgradeRoute).toContain("free_trial");
      expect(upgradeRoute).toContain("starter");
      expect(upgradeRoute).toContain("growth");
      expect(upgradeRoute).toContain("enterprise");
      expect(upgradeRoute).toContain("newIdx <= currentIdx");
    });

    it("should allow super_admin to bypass upgrade-only constraint", () => {
      const upgradeRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/subscription/upgrade/route.ts"),
        "utf8",
      );
      expect(upgradeRoute).toContain('super_admin"');
    });
  });

  describe("Cron Configuration", () => {
    it("should have auto-promote cron in vercel.json", () => {
      const vercel = require("fs").readFileSync(require("path").join(process.cwd(), "vercel.json"), "utf8");
      expect(vercel).toContain("auto-promote");
    });

    it("should have auto-payroll cron in vercel.json", () => {
      const vercel = require("fs").readFileSync(require("path").join(process.cwd(), "vercel.json"), "utf8");
      expect(vercel).toContain("auto-payroll");
    });
  });

  describe("No Regression: console.* calls", () => {
    it("should have no console.* outside logger.ts and test files", () => {
      const fs = require("fs");
      const path = require("path");
      const srcDir = path.join(process.cwd(), "src");

      function findConsoleCalls(dir: string): string[] {
        const results: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name === "node_modules" || entry.name === ".next") continue;
            results.push(...findConsoleCalls(fullPath));
          } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
            if (entry.name.includes(".test.")) continue;
            const content = fs.readFileSync(fullPath, "utf8");
            if (content.includes("console.") && !fullPath.includes("logger.ts") && !fullPath.includes("layout.tsx")) {
              results.push(fullPath);
            }
          }
        }
        return results;
      }

      const filesWithConsole = findConsoleCalls(srcDir);
      expect(filesWithConsole).toEqual([]);
    });
  });

  describe("Auth – fetchUserData race condition", () => {
    it("should NOT have fetchUserDataInProgress guard that blocks concurrent calls", () => {
      const fs = require("fs");
      const path = require("path");
      const authContext = fs.readFileSync(path.join(process.cwd(), "src/lib/auth-context.tsx"), "utf8");
      // The inProgress guard caused login to fail because signIn() and
      // onAuthStateChange both call fetchUserData() concurrently. The
      // second call saw inProgress=true and returned null immediately.
      expect(authContext).not.toContain("fetchUserDataInProgress");
      expect(authContext).not.toContain("fetchUserDataInProgress.current");
    });

    it("should NOT early-return from fetchUserData on in-progress check", () => {
      const fs = require("fs");
      const path = require("path");
      const authContext = fs.readFileSync(path.join(process.cwd(), "src/lib/auth-context.tsx"), "utf8");
      // Ensure no "if (.*inProgress.*) return null" pattern exists
      expect(authContext).not.toMatch(/if\s*\([^)]*inProgress[^)]*\)\s*return\s+null/);
    });
  });

  describe("Auth – signIn robustness", () => {
    it("should NOT call fetchUserData inside signIn() to avoid race conditions", () => {
      const fs = require("fs");
      const path = require("path");
      const authContext = fs.readFileSync(path.join(process.cwd(), "src/lib/auth-context.tsx"), "utf8");
      // signIn() should not call fetchUserData — onAuthStateChange is the
      // single source of truth for populating user after auth.
      const signInMatch = authContext.match(/async function signIn[\s\S]*?^  }/m);
      expect(signInMatch).toBeTruthy();
      const signInBody = signInMatch![0];
      expect(signInBody).not.toContain("fetchUserData(");
    });

    it("should NOT have signInInProgress ref that blocks onAuthStateChange", () => {
      const fs = require("fs");
      const path = require("path");
      const authContext = fs.readFileSync(path.join(process.cwd(), "src/lib/auth-context.tsx"), "utf8");
      expect(authContext).not.toContain("signInInProgress");
      expect(authContext).not.toContain("signInInProgress.current");
    });

    it("should show specific error messages for rate limit and network errors in login page", () => {
      const fs = require("fs");
      const path = require("path");
      const loginPage = fs.readFileSync(path.join(process.cwd(), "src/app/login/page.tsx"), "utf8");
      expect(loginPage).toContain("rate limit");
      expect(loginPage).toContain("Connection error");
      expect(loginPage).toContain("email not confirmed");
    });

    it("should try multiple email formats including raw phone format for legacy accounts", () => {
      const fs = require("fs");
      const path = require("path");
      const authLogin = fs.readFileSync(path.join(process.cwd(), "src/lib/auth-login.ts"), "utf8");
      // Should have logic to try raw phone format (e.g., 0777777777) alongside normalized (256777777777)
      expect(authLogin).toContain("rawWithCountry");
      // Should NOT fast-fail on generic 'invalid credentials' - must try all formats
      const authContext = fs.readFileSync(path.join(process.cwd(), "src/lib/auth-context.tsx"), "utf8");
      // When receiving 'invalid credentials' (not explicit 'wrong password'), should try next format
      expect(authContext).toContain("isUserNotFound");
    });
  });

  describe("Auth – OTP optional and working", () => {
    it("should generate magic link token in verify-otp API", () => {
      const fs = require("fs");
      const path = require("path");
      const verifyOtp = fs.readFileSync(path.join(process.cwd(), "src/app/api/auth/verify-otp/route.ts"), "utf8");
      expect(verifyOtp).toContain('type: "magiclink"');
      expect(verifyOtp).toContain("generateLink");
      expect(verifyOtp).toContain("token");
    });

    it("should verify magic link token in login page OTP handler", () => {
      const fs = require("fs");
      const path = require("path");
      const loginPage = fs.readFileSync(path.join(process.cwd(), "src/app/login/page.tsx"), "utf8");
      expect(loginPage).toContain("verifyOtp");
      expect(loginPage).toContain("token: data.token");
      expect(loginPage).toContain('type: "magiclink"');
      expect(loginPage).toContain("email: data.email");
    });

    it("should have OTP toggle in login page (optional, not forced)", () => {
      const fs = require("fs");
      const path = require("path");
      const loginPage = fs.readFileSync(path.join(process.cwd(), "src/app/login/page.tsx"), "utf8");
      expect(loginPage).toContain("otpMode");
      expect(loginPage).toContain("Login with password");
      expect(loginPage).toContain("Login with OTP instead");
    });
  });

  describe("Parent Portal – Navigation", () => {
    it("should wrap fees page in ParentPortalShell", () => {
      const fs = require("fs");
      const path = require("path");
      const feesPage = fs.readFileSync(path.join(process.cwd(), "src/app/parent-portal/fees/page.tsx"), "utf8");
      expect(feesPage).toContain("ParentPortalShell");
      expect(feesPage).not.toContain("useParentPortalGuard");
    });

    it("should wrap messages page in ParentPortalShell", () => {
      const fs = require("fs");
      const path = require("path");
      const messagesPage = fs.readFileSync(path.join(process.cwd(), "src/app/parent-portal/messages/page.tsx"), "utf8");
      expect(messagesPage).toContain("ParentPortalShell");
      expect(messagesPage).not.toContain("useParentPortalGuard");
    });

    it("should wrap notices page in ParentPortalShell", () => {
      const fs = require("fs");
      const path = require("path");
      const noticesPage = fs.readFileSync(path.join(process.cwd(), "src/app/parent-portal/notices/page.tsx"), "utf8");
      expect(noticesPage).toContain("ParentPortalShell");
      expect(noticesPage).not.toContain("useParentPortalGuard");
    });

    it("should wrap attendance page in ParentPortalShell", () => {
      const fs = require("fs");
      const path = require("path");
      const attendancePage = fs.readFileSync(
        path.join(process.cwd(), "src/app/parent-portal/attendance/page.tsx"),
        "utf8",
      );
      expect(attendancePage).toContain("ParentPortalShell");
      expect(attendancePage).not.toContain("useParentPortalGuard");
    });

    it("should wrap academics page in ParentPortalShell", () => {
      const fs = require("fs");
      const path = require("path");
      const academicsPage = fs.readFileSync(
        path.join(process.cwd(), "src/app/parent-portal/academics/page.tsx"),
        "utf8",
      );
      expect(academicsPage).toContain("ParentPortalShell");
      expect(academicsPage).not.toContain("useParentPortalGuard");
    });
  });
});

describe("NCDC Curriculum Data", () => {
  it("should export NCDC topics for all primary levels P1-P7", () => {
    const {
      P1_ALL_SUBJECTS,
      P2_ALL_SUBJECTS,
      P3_ALL_SUBJECTS,
      P4_ALL_SUBJECTS,
      P5_ALL_SUBJECTS,
      P6_ALL_SUBJECTS,
      P7_ALL_SUBJECTS,
    } = require("@/lib/ndc-syllabus");
    expect(Array.isArray(P1_ALL_SUBJECTS)).toBe(true);
    expect(P1_ALL_SUBJECTS.length).toBeGreaterThan(0);
    expect(Array.isArray(P2_ALL_SUBJECTS)).toBe(true);
    expect(P2_ALL_SUBJECTS.length).toBeGreaterThan(0);
    expect(Array.isArray(P3_ALL_SUBJECTS)).toBe(true);
    expect(P3_ALL_SUBJECTS.length).toBeGreaterThan(0);
    expect(Array.isArray(P4_ALL_SUBJECTS)).toBe(true);
    expect(P4_ALL_SUBJECTS.length).toBeGreaterThan(0);
    expect(Array.isArray(P5_ALL_SUBJECTS)).toBe(true);
    expect(P5_ALL_SUBJECTS.length).toBeGreaterThan(0);
    expect(Array.isArray(P6_ALL_SUBJECTS)).toBe(true);
    expect(P6_ALL_SUBJECTS.length).toBeGreaterThan(0);
    expect(Array.isArray(P7_ALL_SUBJECTS)).toBe(true);
    expect(P7_ALL_SUBJECTS.length).toBeGreaterThan(0);
  });

  it("should export NCDC topics for all secondary levels S1-S6", () => {
    const {
      S1_ALL_SUBJECTS,
      S2_ALL_SUBJECTS,
      S3_ALL_SUBJECTS,
      S4_ALL_SUBJECTS,
      S5_ALL_SUBJECTS,
      S6_ALL_SUBJECTS,
    } = require("@/lib/ndc-syllabus");
    expect(Array.isArray(S1_ALL_SUBJECTS)).toBe(true);
    expect(S1_ALL_SUBJECTS.length).toBeGreaterThan(0);
    expect(Array.isArray(S2_ALL_SUBJECTS)).toBe(true);
    expect(S2_ALL_SUBJECTS.length).toBeGreaterThan(0);
    expect(Array.isArray(S3_ALL_SUBJECTS)).toBe(true);
    expect(S3_ALL_SUBJECTS.length).toBeGreaterThan(0);
    expect(Array.isArray(S4_ALL_SUBJECTS)).toBe(true);
    expect(S4_ALL_SUBJECTS.length).toBeGreaterThan(0);
    expect(Array.isArray(S5_ALL_SUBJECTS)).toBe(true);
    expect(S5_ALL_SUBJECTS.length).toBeGreaterThan(0);
    expect(Array.isArray(S6_ALL_SUBJECTS)).toBe(true);
    expect(S6_ALL_SUBJECTS.length).toBeGreaterThan(0);
  });
});

describe("Subject Names Matching", () => {
  it("should match Math with Mathematics", () => {
    const { subjectNamesMatch } = require("@/lib/academics-utils");
    expect(subjectNamesMatch("Math", "Mathematics")).toBe(true);
  });

  it("should match SST with Social Studies", () => {
    const { subjectNamesMatch } = require("@/lib/academics-utils");
    expect(subjectNamesMatch("SST", "Social Studies")).toBe(true);
  });

  it("should match PE with Physical Education", () => {
    const { subjectNamesMatch } = require("@/lib/academics-utils");
    expect(subjectNamesMatch("PE", "Physical Education")).toBe(true);
  });

  it("should not match unrelated names", () => {
    const { subjectNamesMatch } = require("@/lib/academics-utils");
    expect(subjectNamesMatch("Math", "English")).toBe(false);
  });
});

describe("Syllabus Schema", () => {
  it("should have syllabus table in schema.sql", () => {
    const fs = require("fs");
    const path = require("path");
    const schema = fs.readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS syllabus (");
  });

  it("should have topic_coverage table in schema.sql", () => {
    const fs = require("fs");
    const path = require("path");
    const schema = fs.readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS topic_coverage (");
  });
});
