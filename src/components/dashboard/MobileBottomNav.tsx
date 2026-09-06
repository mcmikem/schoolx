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
    if (!role) return { label: "Open Dashboard", href: "/dashboard", icon: "dashboard" };

    if (!pathname)
      return canUseStudents
        ? { label: "Add Student", href: "/dashboard/students", icon: "person_add" }
        : canUseAttendance
          ? { label: "Take Attendance", href: "/dashboard/attendance", icon: "how_to_reg" }
          : canUseFees
            ? { label: "Record Fees", href: "/dashboard/fees", icon: "payments" }
            : { label: "Open Dashboard", href: "/dashboard", icon: "dashboard" };

    if (pathname.startsWith("/dashboard/students") && canUseAttendance)
      return { label: "Take Attendance", href: "/dashboard/attendance", icon: "how_to_reg" };
    if (pathname.startsWith("/dashboard/attendance") && canUseFees)
      return { label: "Record Fees", href: "/dashboard/fees", icon: "payments" };
    if (pathname.startsWith("/dashboard/fees") && canUseMessages)
      return { label: "Send Reminder", href: "/dashboard/messages", icon: "sms" };

    if (canUseStudents) {
      return { label: "Add Student", href: "/dashboard/students", icon: "person_add" };
    }
    if (canUseAttendance) {
      return { label: "Take Attendance", href: "/dashboard/attendance", icon: "how_to_reg" };
    }
    if (canUseFees) {
      return { label: "Record Fees", href: "/dashboard/fees", icon: "payments" };
    }
    return { label: "Open Dashboard", href: "/dashboard", icon: "dashboard" };
  }, [pathname, role, canUseStudents, canUseAttendance, canUseFees, canUseMessages]);

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
        className="mobile-nav-item mobile-nav-action"
        aria-label={quickStep.label}
        onClick={() => {
          try {
            navigator.vibrate?.(10);
          } catch {}
        }}
      >
        <MaterialIcon icon={quickStep.icon} style={{ fontSize: 22 }} />
        <span>{quickStep.label}</span>
      </Link>

      {/* Fees */}
      {canUseFees && (
        <NavItem href="/dashboard/fees" icon="payments" label="Fees" active={isActive("/dashboard/fees")} />
      )}
      {/* More */}
      <button
        type="button"
        className={`mobile-nav-item`}
        onClick={() => {
          try {
            navigator.vibrate?.(10);
          } catch {}
          openSidebar();
        }}
        aria-label="Open more pages"
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
    >
      <MaterialIcon icon={icon} style={{ fontSize: 22 }} />
      <span>{label}</span>
      {active && <span className="mobile-nav-dot" aria-hidden />}
    </Link>
  );
}
