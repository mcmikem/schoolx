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
      const proxy = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/proxy.ts"),
        "utf8",
      );
      expect(proxy).toContain('"parent"');
    });

    it("should have CSRF token as non-httpOnly", () => {
      const proxy = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/proxy.ts"),
        "utf8",
      );
      expect(proxy).toContain("httpOnly: false");
    });
  });

  describe("Automation Fixes", () => {
    it("should use sendAfricasTalkingSMSWithRetry in fee reminders", () => {
      const feeReminder = require("fs").readFileSync(
        require("path").join(
          process.cwd(),
          "src/app/api/automation/auto-fee-reminder/route.ts",
        ),
        "utf8",
      );
      expect(feeReminder).toContain("sendAfricasTalkingSMSWithRetry");
    });

    it("should use sendAfricasTalkingSMSWithRetry in attendance followup", () => {
      const attendanceFollowup = require("fs").readFileSync(
        require("path").join(
          process.cwd(),
          "src/app/api/automation/auto-attendance-followup/route.ts",
        ),
        "utf8",
      );
      expect(attendanceFollowup).toContain("sendAfricasTalkingSMSWithRetry");
    });

    it("should use sendAfricasTalkingSMSWithRetry in installment reminders", () => {
      const installmentReminder = require("fs").readFileSync(
        require("path").join(
          process.cwd(),
          "src/app/api/automation/auto-installment-reminder/route.ts",
        ),
        "utf8",
      );
      expect(installmentReminder).toContain("sendAfricasTalkingSMSWithRetry");
    });

    it("should use sendAfricasTalkingSMSWithRetry in attendance heartbeat", () => {
      const heartbeat = require("fs").readFileSync(
        require("path").join(
          process.cwd(),
          "src/app/api/automation/attendance-heartbeat/route.ts",
        ),
        "utf8",
      );
      expect(heartbeat).toContain("sendAfricasTalkingSMSWithRetry");
    });

    it("should use sendAfricasTalkingSMSWithRetry in inventory alerts", () => {
      const inventoryAlerts = require("fs").readFileSync(
        require("path").join(
          process.cwd(),
          "src/app/api/automation/auto-inventory-alerts/route.ts",
        ),
        "utf8",
      );
      expect(inventoryAlerts).toContain("sendAfricasTalkingSMSWithRetry");
    });

    it("should use sendAfricasTalkingSMSWithRetry in term-end", () => {
      const termEnd = require("fs").readFileSync(
        require("path").join(
          process.cwd(),
          "src/app/api/automation/term-end/route.ts",
        ),
        "utf8",
      );
      expect(termEnd).toContain("sendAfricasTalkingSMSWithRetry");
    });

    it("should have idempotency check in term-end report cards", () => {
      const termEnd = require("fs").readFileSync(
        require("path").join(
          process.cwd(),
          "src/app/api/automation/term-end/route.ts",
        ),
        "utf8",
      );
      expect(termEnd).toContain("existingCard");
    });

    it("should track failed seeding in onboarding", () => {
      const onboarding = require("fs").readFileSync(
        require("path").join(
          process.cwd(),
          "src/components/onboarding/OnboardingFlow.tsx",
        ),
        "utf8",
      );
      expect(onboarding).toContain("failedSeeding");
    });

    it("should have error logging in term-end catch blocks", () => {
      const termEnd = require("fs").readFileSync(
        require("path").join(
          process.cwd(),
          "src/app/api/automation/term-end/route.ts",
        ),
        "utf8",
      );
      expect(termEnd).toContain("logger.warn");
      expect(termEnd).not.toMatch(/catch\s*\(\s*_\s*\)\s*\{/);
    });
  });

  describe("Webhook Fixes", () => {
    it("should not return 500 in Stripe webhook handlers", () => {
      const stripeWebhook = require("fs").readFileSync(
        require("path").join(
          process.cwd(),
          "src/app/api/payment/webhook/route.ts",
        ),
        "utf8",
      );
      expect(stripeWebhook).not.toContain(
        'return new NextResponse(\n            JSON.stringify({ error: "Failed to process checkout session" })',
      );
    });

    it("should have charge.refunded handler in Stripe webhook", () => {
      const stripeWebhook = require("fs").readFileSync(
        require("path").join(
          process.cwd(),
          "src/app/api/payment/webhook/route.ts",
        ),
        "utf8",
      );
      expect(stripeWebhook).toContain("charge.refunded");
    });

    it("should have NODE_ENV guard in mobile money webhook", () => {
      const mobileMoney = require("fs").readFileSync(
        require("path").join(
          process.cwd(),
          "src/app/api/payment/webhook/mobile-money/route.ts",
        ),
        "utf8",
      );
      expect(mobileMoney).toContain('process.env.NODE_ENV === "development"');
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
      expect(syncRoute).not.toContain(
        "supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY",
      );
    });

    it("should have SMS delivery DB update uncommented", () => {
      const smsRoute = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/api/sms/route.ts"),
        "utf8",
      );
      expect(smsRoute).toContain(".from(\"messages\")");
      expect(smsRoute).toContain(".update({ status, delivery_status: status })");
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
        require("path").join(
          process.cwd(),
          "src/app/api/cron/sms-reminders/route.ts",
        ),
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
      const feesLookupPath = path.join(
        process.cwd(),
        "src/app/dashboard/fees-lookup/page.tsx",
      );
      expect(fs.existsSync(feesLookupPath)).toBe(false);
    });

    it("should have PWA install prompt component", () => {
      const fs = require("fs");
      const path = require("path");
      const pwaPromptPath = path.join(
        process.cwd(),
        "src/components/PWAInstallPrompt.tsx",
      );
      expect(fs.existsSync(pwaPromptPath)).toBe(true);
    });
  });

  describe("Cron Configuration", () => {
    it("should have auto-promote cron in vercel.json", () => {
      const vercel = require("fs").readFileSync(
        require("path").join(process.cwd(), "vercel.json"),
        "utf8",
      );
      expect(vercel).toContain("auto-promote");
    });

    it("should have auto-payroll cron in vercel.json", () => {
      const vercel = require("fs").readFileSync(
        require("path").join(process.cwd(), "vercel.json"),
        "utf8",
      );
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
            if (
              content.includes("console.") &&
              !fullPath.includes("logger.ts") &&
              !fullPath.includes("layout.tsx")
            ) {
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
      const authContext = fs.readFileSync(
        path.join(process.cwd(), "src/lib/auth-context.tsx"),
        "utf8",
      );
      // The inProgress guard caused login to fail because signIn() and
      // onAuthStateChange both call fetchUserData() concurrently. The
      // second call saw inProgress=true and returned null immediately.
      expect(authContext).not.toContain("fetchUserDataInProgress");
      expect(authContext).not.toContain("fetchUserDataInProgress.current");
    });

    it("should NOT early-return from fetchUserData on in-progress check", () => {
      const fs = require("fs");
      const path = require("path");
      const authContext = fs.readFileSync(
        path.join(process.cwd(), "src/lib/auth-context.tsx"),
        "utf8",
      );
      // Ensure no "if (.*inProgress.*) return null" pattern exists
      expect(authContext).not.toMatch(/if\s*\([^)]*inProgress[^)]*\)\s*return\s+null/);
    });
  });

  describe("Auth – signIn robustness", () => {
    it("should NOT call fetchUserData inside signIn() to avoid race conditions", () => {
      const fs = require("fs");
      const path = require("path");
      const authContext = fs.readFileSync(
        path.join(process.cwd(), "src/lib/auth-context.tsx"),
        "utf8",
      );
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
      const authContext = fs.readFileSync(
        path.join(process.cwd(), "src/lib/auth-context.tsx"),
        "utf8",
      );
      expect(authContext).not.toContain("signInInProgress");
      expect(authContext).not.toContain("signInInProgress.current");
    });

    it("should show specific error messages for rate limit and network errors in login page", () => {
      const fs = require("fs");
      const path = require("path");
      const loginPage = fs.readFileSync(
        path.join(process.cwd(), "src/app/login/page.tsx"),
        "utf8",
      );
      expect(loginPage).toContain("rate limit");
      expect(loginPage).toContain("Connection error");
      expect(loginPage).toContain("email not confirmed");
    });

    it("should try multiple email formats including raw phone format for legacy accounts", () => {
      const fs = require("fs");
      const path = require("path");
      const authLogin = fs.readFileSync(
        path.join(process.cwd(), "src/lib/auth-login.ts"),
        "utf8",
      );
      // Should have logic to try raw phone format (e.g., 0777777777) alongside normalized (256777777777)
      expect(authLogin).toContain("rawWithCountry");
      // Should NOT fast-fail on generic 'invalid credentials' - must try all formats
      const authContext = fs.readFileSync(
        path.join(process.cwd(), "src/lib/auth-context.tsx"),
        "utf8",
      );
      // When receiving 'invalid credentials' (not explicit 'wrong password'), should try next format
      expect(authContext).toContain("isUserNotFound");
    });
  });

  describe("Auth – OTP optional and working", () => {
    it("should generate magic link token in verify-otp API", () => {
      const fs = require("fs");
      const path = require("path");
      const verifyOtp = fs.readFileSync(
        path.join(process.cwd(), "src/app/api/auth/verify-otp/route.ts"),
        "utf8",
      );
      expect(verifyOtp).toContain('type: "magiclink"');
      expect(verifyOtp).toContain("generateLink");
      expect(verifyOtp).toContain("token");
    });

    it("should verify magic link token in login page OTP handler", () => {
      const fs = require("fs");
      const path = require("path");
      const loginPage = fs.readFileSync(
        path.join(process.cwd(), "src/app/login/page.tsx"),
        "utf8",
      );
      expect(loginPage).toContain("verifyOtp");
      expect(loginPage).toContain("token: data.token");
      expect(loginPage).toContain('type: "magiclink"');
      expect(loginPage).toContain("email: data.email");
    });

    it("should have OTP toggle in login page (optional, not forced)", () => {
      const fs = require("fs");
      const path = require("path");
      const loginPage = fs.readFileSync(
        path.join(process.cwd(), "src/app/login/page.tsx"),
        "utf8",
      );
      expect(loginPage).toContain("otpMode");
      expect(loginPage).toContain("Login with password");
      expect(loginPage).toContain("Login with OTP instead");
    });
  });

  describe("Parent Portal – Navigation", () => {
    it("should wrap fees page in ParentPortalShell", () => {
      const fs = require("fs");
      const path = require("path");
      const feesPage = fs.readFileSync(
        path.join(process.cwd(), "src/app/parent-portal/fees/page.tsx"),
        "utf8",
      );
      expect(feesPage).toContain("ParentPortalShell");
      expect(feesPage).not.toContain("useParentPortalGuard");
    });

    it("should wrap messages page in ParentPortalShell", () => {
      const fs = require("fs");
      const path = require("path");
      const messagesPage = fs.readFileSync(
        path.join(process.cwd(), "src/app/parent-portal/messages/page.tsx"),
        "utf8",
      );
      expect(messagesPage).toContain("ParentPortalShell");
      expect(messagesPage).not.toContain("useParentPortalGuard");
    });

    it("should wrap notices page in ParentPortalShell", () => {
      const fs = require("fs");
      const path = require("path");
      const noticesPage = fs.readFileSync(
        path.join(process.cwd(), "src/app/parent-portal/notices/page.tsx"),
        "utf8",
      );
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
