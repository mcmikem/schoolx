"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { useSidebar } from "@/contexts/SidebarContext";
import { useAuth } from "@/lib/auth-context";
import { canAccess, type UserRole } from "@/lib/roles";

type QuickStep = {
  label: string;
  /** Compact label for the bottom bar. The full phrase ("Take Attendance") is
   *  far too wide for a nav slot on a 320px screen and gets truncated to an
   *  unreadable stub, so the bar uses a short noun instead. */
  navLabel: string;
  href: string;
  icon: string;
};

/**
 * The centre action in the mobile bar, declared per role.
 *
 * It used to be resolved by a capability priority — students, then attendance,
 * then fees. Every staff role except marketer can read `students`, so the
 * chain resolved the same step for six of seven roles: a bursar and a teacher
 * both got "Add Student" as their primary phone action, which is the daily task
 * of neither. Labels also promised an action while the href landed on a list
 * ("Add Student" → /dashboard/students), and the contextual swaps changed the
 * meaning of the same button depending on the current route.
 *
 * Two rules now hold: the label names the destination, and no entry duplicates
 * a destination the bar already carries (Home / Attend / Fees / More).
 *
 * The second rule used to be broken by the fallback: roles with no declared
 * entry all collapsed onto `DASHBOARD_FALLBACK` — { navLabel: "Home", href:
 * "/dashboard" } — so admin and school_admin saw the bar read "home, attend,
 * home, fees, more", with the second home lit whenever the first was. There is
 * no fallback any more; a role with no entry simply gets no centre slot.
 */
const ROLE_QUICK_ACTION: Record<string, QuickStep> = {
  // Attend already sits in the bar, so the next task is entering marks.
  teacher: { label: "Enter Marks", navLabel: "Marks", href: "/dashboard/grades", icon: "grade" },
  dean_of_studies: { label: "Academic Reports", navLabel: "Reports", href: "/dashboard/reports", icon: "description" },
  // Fees already sits in the bar; invoicing is the bursar's other daily task.
  bursar: { label: "Invoices", navLabel: "Invoices", href: "/dashboard/invoicing", icon: "description" },
  headmaster: { label: "Students", navLabel: "Students", href: "/dashboard/students", icon: "group" },
  secretary: { label: "Messages", navLabel: "Messages", href: "/dashboard/messages", icon: "chat" },
  dorm_master: { label: "Dorm Attendance", navLabel: "Dorm", href: "/dashboard/dorm-attendance", icon: "bed" },
  admin: { label: "Staff", navLabel: "Staff", href: "/dashboard/staff", icon: "person" },
  school_admin: { label: "Staff", navLabel: "Staff", href: "/dashboard/staff", icon: "person" },
  super_admin: { label: "Schools", navLabel: "Schools", href: "/dashboard/schools", icon: "school" },
};

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { open: openSidebar } = useSidebar();
  const { user } = useAuth();
  const role = user?.role as UserRole | undefined;

  const canUseAttendance = role ? canAccess(role, "attendance") : false;
  const canUseFees = role ? canAccess(role, "fees") : false;

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + "/");

  // Home / Attend / Fees already have their own slots — the centre action
  // must never repeat one, even if a future ROLE_QUICK_ACTION entry does.
  const RESERVED_HREFS = ["/dashboard", "/dashboard/attendance", "/dashboard/fees"];

  // Constant per role, and absent rather than invented when the role has no
  // entry — an invented fallback collided with Home.
  const quickStep = useMemo<QuickStep | null>(() => {
    if (!role) return null;
    const step = ROLE_QUICK_ACTION[role] ?? null;
    if (step && RESERVED_HREFS.includes(step.href)) return null;
    return step;
  }, [role]);

  const quickActive = quickStep ? isActive(quickStep.href) : false;

  // Exact match on the dashboard root only. isActive("/dashboard") also
  // matches "/dashboard/*", which lit Home alongside Fees/Students on every
  // subpage — reading as a second active Home. Trailing slash normalised
  // because next.config uses trailingSlash: true.
  const normalizedPath = (pathname ?? "").replace(/\/+$/, "") || "/";
  const isHome = normalizedPath === "/dashboard";

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {/* Home. */}
      <NavItem href="/dashboard" icon="home" label="Home" active={isHome} />
      {/* Attend */}
      {canUseAttendance && (
        <NavItem
          href="/dashboard/attendance"
          icon="how_to_reg"
          label="Attend"
          active={isActive("/dashboard/attendance")}
        />
      )}

      {/* Role-aware quick action stays in the same rhythm as the other
          destinations, and is omitted for roles that declare none. */}
      {quickStep && (
        <Link
          href={quickStep.href}
          className={`mobile-nav-item mobile-nav-action${quickActive ? " active" : ""}`}
          aria-label={quickStep.label}
          aria-current={quickActive ? "page" : undefined}
          title={quickStep.label}
          onClick={() => {
            try {
              navigator.vibrate?.(10);
            } catch {}
          }}
        >
          <MaterialIcon icon={quickStep.icon} style={{ fontSize: 22 }} />
          <span className="mobile-nav-label">{quickStep.navLabel}</span>
          {quickActive && <span className="mobile-nav-dot" aria-hidden />}
        </Link>
      )}

      {/* Fees */}
      {canUseFees && (
        <NavItem href="/dashboard/fees" icon="payments" label="Fees" active={isActive("/dashboard/fees")} />
      )}
      {/* More */}
      <button
        type="button"
        className="mobile-nav-item"
        onClick={() => {
          try {
            navigator.vibrate?.(10);
          } catch {}
          openSidebar();
        }}
        aria-label="Open more pages"
        title="More pages"
      >
        <MaterialIcon icon="apps" style={{ fontSize: 22 }} />
        <span className="mobile-nav-label">More</span>
      </button>
    </nav>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`mobile-nav-item${active ? " active" : ""}`}
      aria-current={active ? "page" : undefined}
      title={label}
    >
      <MaterialIcon icon={icon} style={{ fontSize: 22 }} />
      <span className="mobile-nav-label">{label}</span>
      {active && <span className="mobile-nav-dot" aria-hidden />}
    </Link>
  );
}
