import React from "react";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import MobileBottomNav from "@/components/dashboard/MobileBottomNav";

/**
 * The mobile bar's centre action used to be resolved by a capability priority
 * (students → attendance → fees). Every staff role except marketer can read
 * `students`, so the chain produced the same step for six of seven roles —
 * bursar and teacher alike were given "Add Student" as their primary phone
 * action. The label also promised an action while the href landed on a list.
 *
 * These tests pin the two properties that fix must hold:
 *   1. the centre action actually differs per role
 *   2. its label describes the destination it navigates to
 */

let mockRole: string | undefined = "bursar";
let mockPathname = "/dashboard";

jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: { id: "u1", role: mockRole } }) }));
jest.mock("@/contexts/SidebarContext", () => ({ useSidebar: () => ({ open: jest.fn() }) }));
jest.mock("@/components/MaterialIcon", () => ({
  __esModule: true,
  default: ({ icon }: { icon: string }) => <span data-testid="icon">{icon}</span>,
}));

function centre() {
  // The quick action carries its own class, so it is unambiguous — unlike the
  // other items, which are identified only by href.
  return document.querySelector<HTMLAnchorElement>(".mobile-nav-action");
}

function centreLabel() {
  return (centre()?.getAttribute("aria-label") || "").trim();
}

function barHrefs() {
  return Array.from(screen.getByRole("navigation", { name: /mobile navigation/i }).querySelectorAll("a")).map((a) =>
    a.getAttribute("href"),
  );
}

describe("MobileBottomNav centre action", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
    mockRole = "bursar";
  });

  it.each([
    ["teacher", "Enter Marks", "/dashboard/grades"],
    ["dean_of_studies", "Academic Reports", "/dashboard/reports"],
    ["bursar", "Invoices", "/dashboard/invoicing"],
    ["headmaster", "Students", "/dashboard/students"],
    ["secretary", "Messages", "/dashboard/messages"],
    ["dorm_master", "Dorm Attendance", "/dashboard/dorm-attendance"],
  ])("gives %s its own action: %s", (role, label, href) => {
    mockRole = role;
    render(<MobileBottomNav />);

    expect(centreLabel()).toBe(label);
    expect(centre()?.getAttribute("href")).toBe(href);
  });

  it("does not give a teacher or a bursar 'Add Student' as their primary action", () => {
    for (const role of ["teacher", "bursar", "dorm_master", "secretary"]) {
      mockRole = role;
      const { unmount } = render(<MobileBottomNav />);
      expect(centreLabel()).not.toMatch(/add student/i);
      unmount();
    }
  });

  it("falls back to the dashboard for a role with no declared action", () => {
    mockRole = "marketer";
    render(<MobileBottomNav />);

    expect(centre()?.getAttribute("href")).toBe("/dashboard");
  });

  it("does not duplicate a destination the bar already carries", () => {
    // Home / Attend / Fees are separate items; the centre must not repeat one.
    for (const role of ["teacher", "dean_of_studies", "bursar", "headmaster", "dorm_master"]) {
      mockRole = role;
      const { unmount } = render(<MobileBottomNav />);
      const hrefs = barHrefs();
      const centreHref = centre()?.getAttribute("href");
      expect(hrefs.filter((h) => h === centreHref).length).toBe(1);
      expect(["/dashboard", "/dashboard/attendance", "/dashboard/fees"]).not.toContain(centreHref);
      unmount();
    }
  });

  it("keeps the same action regardless of the current route", () => {
    mockRole = "teacher";
    mockPathname = "/dashboard/students";
    const { unmount } = render(<MobileBottomNav />);
    const onStudents = centre()?.getAttribute("href");
    unmount();

    mockPathname = "/dashboard/attendance";
    render(<MobileBottomNav />);
    expect(centre()?.getAttribute("href")).toBe(onStudents);
  });

  it("marks the centre action as current when on its destination", () => {
    mockRole = "bursar";
    mockPathname = "/dashboard/invoicing";
    render(<MobileBottomNav />);

    const el = centre();
    expect(el?.getAttribute("aria-current")).toBe("page");
    expect(el?.className).toMatch(/active/);
    fireEvent.click(el as Element);
  });
});
