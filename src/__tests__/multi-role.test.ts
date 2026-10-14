import { canAccess, canAccessAny, hasAnyRole, primaryRole, isClassScopedAnyRole } from "@/lib/roles";
import { getNavigationForRole, getNavigationForRoles } from "@/lib/navigation";
import { readFileSync } from "fs";

/**
 * Rural schools are not staffed like corporate org charts. One person routinely
 * wears several hats: the headmaster usually also teaches, and the bursar is
 * frequently also a teacher (and often has their own child enrolled).
 *
 * These tests pin the behaviour that makes those combinations work. Before
 * this, a bursar who also taught had `grades: false` and no /dashboard/grades
 * entry in navigation at all, so teaching was impossible through the UI.
 */

const migration = readFileSync("supabase/migrations/20261113000000_multi_role_support.sql", "utf8");

describe("a bursar who is also a teacher can reach marks entry", () => {
  it("grants grades only when the teaching hat is present", () => {
    expect(canAccess("bursar", "grades")).toBe(false);
    expect(canAccessAny(["bursar"], "grades")).toBe(false);
    expect(canAccessAny(["bursar", "teacher"], "grades")).toBe(true);
  });

  it("keeps the bursar hat working alongside teaching", () => {
    expect(canAccessAny(["bursar", "teacher"], "invoicing")).toBe(true);
    expect(canAccessAny(["bursar", "teacher"], "fees")).toBe(true);
    expect(canAccessAny(["bursar", "teacher"], "payroll")).toBe(true);
  });

  it("does not hand marks to a plain bursar", () => {
    expect(canAccessAny(["bursar"], "grades")).toBe(false);
    expect(canAccessAny(["bursar"], "attendance")).toBe(false);
  });

  it("gives an HM/teacher both sets", () => {
    expect(canAccessAny(["headmaster", "teacher"], "grades")).toBe(true);
    expect(canAccessAny(["headmaster", "teacher"], "staff")).toBe(true);
    expect(canAccessAny(["headmaster", "teacher"], "settings")).toBe(true);
  });
});

describe("unknown and empty role sets never grant access", () => {
  it("returns false rather than throwing", () => {
    expect(canAccessAny(null, "grades")).toBe(false);
    expect(canAccessAny(undefined, "grades")).toBe(false);
    expect(canAccessAny([], "grades")).toBe(false);
    expect(canAccessAny(["", null, undefined], "grades")).toBe(false);
  });

  it("treats a role the permission table does not know as no access", () => {
    // "student" exists in the UserRole union but has no ROLE_PERMISSIONS entry.
    expect(canAccessAny(["student"], "grades")).toBe(false);
    expect(canAccessAny(["revoked_role"], "settings")).toBe(false);
  });
});

describe("role-union helpers", () => {
  it("answers role-intent questions across every hat", () => {
    expect(hasAnyRole(["bursar", "teacher"], ["teacher"])).toBe(true);
    expect(hasAnyRole(["bursar"], ["teacher"])).toBe(false);
    expect(hasAnyRole("headmaster", ["headmaster"])).toBe(true);
  });

  it("prefers the primary role for labels and receipts", () => {
    expect(primaryRole(["bursar", "teacher"], "bursar")).toBe("bursar");
    expect(primaryRole(["bursar", "teacher"], "headmaster")).toBe("bursar");
    expect(primaryRole([], "bursar")).toBe("bursar");
  });

  it("keeps class scoping when any hat implies it", () => {
    expect(isClassScopedAnyRole(["bursar"])).toBe(false);
    expect(isClassScopedAnyRole(["bursar", "teacher"])).toBe(true);
  });
});

describe("navigation unions across roles", () => {
  it("gives a bursar/teacher the grades route they previously lacked", () => {
    const bursarHrefs = getNavigationForRole("bursar")
      .flatMap((g) => g.items)
      .map((i) => (i as { href?: string }).href);
    expect(bursarHrefs).not.toContain("/dashboard/grades");

    const mergedHrefs = getNavigationForRoles(["bursar", "teacher"])
      .flatMap((g) => g.items)
      .map((i) => (i as { href?: string }).href);
    expect(mergedHrefs).toContain("/dashboard/grades");
    // The bursar hat still contributes its own destinations.
    expect(mergedHrefs).toContain("/dashboard/fees?tab=invoices");
    expect(mergedHrefs).toContain("/dashboard/payroll");
  });

  it("de-duplicates destinations offered by two hats", () => {
    const hrefs = getNavigationForRoles(["headmaster", "admin"])
      .flatMap((g) => g.items)
      .map((i) => (i as { href?: string }).href);
    const seen = hrefs.filter((h): h is string => typeof h === "string");
    expect(seen.length).toBe(new Set(seen).size);
  });

  it("behaves identically to the single-role path when given one role", () => {
    expect(getNavigationForRoles(["bursar"])).toEqual(getNavigationForRole("bursar"));
  });

  it("returns nothing for empty or malformed input", () => {
    expect(getNavigationForRoles([])).toEqual([]);
    expect(getNavigationForRoles(null)).toEqual([]);
    expect(getNavigationForRoles(["revoked_role"])).toEqual([]);
  });
});

describe("the multi-role migration is safe to re-apply", () => {
  it("backfills existing staff from users.role", () => {
    expect(migration).toContain("insert into public.user_roles");
    expect(migration).toContain("on conflict (user_id, role) do nothing");
  });

  it("keeps users.role as the primary role for existing queries", () => {
    expect(migration).toContain("is_primary");
    // The app still reads user.role, so it must not be dropped.
    expect(migration).not.toMatch(/drop\s+column\s+role/i);
  });

  it("locks down the SECURITY DEFINER helpers", () => {
    expect(migration).toContain("set search_path = public");
    // Every helper filters on auth.uid() inside the body.
    expect(migration).toMatch(/my_roles\(\)[\s\S]*auth\.uid\(\)/);
  });

  it("enables RLS on user_roles", () => {
    expect(migration).toMatch(/alter table public\.user_roles enable row level security/);
    expect(migration).toContain("Users read own roles");
  });

  it("constrains preferred_dashboard to real dashboards", () => {
    expect(migration).toContain("users_preferred_dashboard_check");
  });
});
