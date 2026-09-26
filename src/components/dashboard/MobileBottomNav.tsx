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

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { open: openSidebar } = useSidebar();
  const { user } = useAuth();
  const role = user?.role as UserRole | undefined;

  const canUseStudents = role ? canAccess(role, "students") : false;
  const canUseAttendance = role ? canAccess(role, "attendance") : false;
  const canUseFees = role ? canAccess(role, "fees") : false;
  const canUseMessages = role ? canAccess(role, "messages") : false;

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + "/");

  const quickStep = useMemo<QuickStep>(() => {
    if (!role) return { label: "Open Dashboard", navLabel: "Home", href: "/dashboard", icon: "dashboard" };

    if (!pathname)
      return canUseStudents
        ? { label: "Add Student", navLabel: "Students", href: "/dashboard/students", icon: "person_add" }
        : canUseAttendance
          ? { label: "Take Attendance", navLabel: "Register", href: "/dashboard/attendance", icon: "how_to_reg" }
          : canUseFees
            ? { label: "Record Fees", navLabel: "Fees", href: "/dashboard/fees", icon: "payments" }
            : { label: "Open Dashboard", navLabel: "Home", href: "/dashboard", icon: "dashboard" };

    if (pathname.startsWith("/dashboard/students") && canUseAttendance)
      return { label: "Take Attendance", navLabel: "Register", href: "/dashboard/attendance", icon: "how_to_reg" };
    if (pathname.startsWith("/dashboard/attendance") && canUseFees)
      return { label: "Record Fees", navLabel: "Fees", href: "/dashboard/fees", icon: "payments" };
    if (pathname.startsWith("/dashboard/fees") && canUseMessages)
      return { label: "Send Reminder", navLabel: "Messages", href: "/dashboard/messages", icon: "sms" };

    if (canUseStudents) {
      return { label: "Add Student", navLabel: "Students", href: "/dashboard/students", icon: "person_add" };
    }
    if (canUseAttendance) {
      return { label: "Take Attendance", navLabel: "Register", href: "/dashboard/attendance", icon: "how_to_reg" };
    }
    if (canUseFees) {
      return { label: "Record Fees", navLabel: "Fees", href: "/dashboard/fees", icon: "payments" };
    }
    return { label: "Open Dashboard", navLabel: "Home", href: "/dashboard", icon: "dashboard" };
  }, [pathname, role, canUseStudents, canUseAttendance, canUseFees, canUseMessages]);

  const quickActive = isActive(quickStep.href);

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {/* Home */}
      <NavItem href="/dashboard" icon="home" label="Home" active={pathname === "/dashboard"} />
      {/* Attend */}
      {canUseAttendance && (
        <NavItem
          href="/dashboard/attendance"
          icon="how_to_reg"
          label="Attend"
          active={isActive("/dashboard/attendance")}
        />
      )}

      {/* Role-aware quick action stays in the same rhythm as the other destinations. */}
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
        <span>{quickStep.navLabel}</span>
        {quickActive && <span className="mobile-nav-dot" aria-hidden />}
      </Link>

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
        <span>More</span>
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
      <span>{label}</span>
      {active && <span className="mobile-nav-dot" aria-hidden />}
    </Link>
  );
}
