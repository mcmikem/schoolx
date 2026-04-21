"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useSidebar } from "@/contexts/SidebarContext";
import MaterialIcon from "@/components/MaterialIcon";

type QuickStep = {
  label: string;
  href: string;
  icon: string;
};

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { open: openSidebar } = useSidebar();

  const isActive = (path: string) =>
    pathname === path || pathname?.startsWith(path + "/");

  const quickStep = useMemo<QuickStep>(() => {
    if (!pathname)
      return { label: "Add Student", href: "/dashboard/students", icon: "person_add" };
    if (pathname.startsWith("/dashboard/students"))
      return { label: "Take Attendance", href: "/dashboard/attendance", icon: "how_to_reg" };
    if (pathname.startsWith("/dashboard/attendance"))
      return { label: "Record Fees", href: "/dashboard/fees", icon: "payments" };
    if (pathname.startsWith("/dashboard/fees"))
      return { label: "Send Reminder", href: "/dashboard/messages", icon: "sms" };
    return { label: "Add Student", href: "/dashboard/students", icon: "person_add" };
  }, [pathname]);

  return (
    <div className="mobile-bottom-nav">
      {/* Home */}
      <NavItem
        href="/dashboard"
        icon="home"
        label="Home"
        active={pathname === "/dashboard"}
      />
      {/* Attend */}
      <NavItem
        href="/dashboard/attendance"
        icon="how_to_reg"
        label="Attend"
        active={isActive("/dashboard/attendance")}
      />

      {/* Centre FAB — floats above the bar */}
      <Link
        href={quickStep.href}
        className="mobile-nav-fab"
        aria-label={quickStep.label}
      >
        <MaterialIcon icon={quickStep.icon} style={{ fontSize: 24 }} />
      </Link>

      {/* Fees */}
      <NavItem
        href="/dashboard/fees"
        icon="payments"
        label="Fees"
        active={isActive("/dashboard/fees")}
      />
      {/* More */}
      <button
        type="button"
        className={`mobile-nav-item`}
        onClick={() => openSidebar()}
        aria-label="Open more pages"
      >
        <MaterialIcon icon="apps" style={{ fontSize: 22 }} />
        <span>More</span>
      </button>
    </div>
  );
}

function NavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
}) {
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

