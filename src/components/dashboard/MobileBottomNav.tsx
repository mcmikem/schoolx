"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useSidebar } from "@/contexts/SidebarContext";
import MaterialIcon from "@/components/MaterialIcon";

type QuickStep = {
  label: string;
  shortLabel: string;
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
      return {
        label: "Add Student",
        shortLabel: "Add",
        href: "/dashboard/students",
        icon: "person_add",
      };
    if (pathname.startsWith("/dashboard/students"))
      return {
        label: "Take Attendance",
        shortLabel: "Attend",
        href: "/dashboard/attendance",
        icon: "how_to_reg",
      };
    if (pathname.startsWith("/dashboard/attendance"))
      return {
        label: "Record Fees",
        shortLabel: "Fees",
        href: "/dashboard/fees",
        icon: "payments",
      };
    if (pathname.startsWith("/dashboard/fees"))
      return {
        label: "Send Reminder",
        shortLabel: "SMS",
        href: "/dashboard/messages",
        icon: "sms",
      };
    return {
      label: "Add Student",
      shortLabel: "Add",
      href: "/dashboard/students",
      icon: "person_add",
    };
  }, [pathname]);

  return (
    <div className="mobile-bottom-nav">
      <Link
        href="/dashboard"
        className={`mobile-nav-item ${pathname === "/dashboard" ? "active" : ""}`}
        aria-current={pathname === "/dashboard" ? "page" : undefined}
      >
        <MaterialIcon icon="dashboard" size={20} />
        <span>Home</span>
      </Link>
      <Link
        href="/dashboard/students"
        className={`mobile-nav-item ${isActive("/dashboard/students") ? "active" : ""}`}
        aria-current={isActive("/dashboard/students") ? "page" : undefined}
      >
        <MaterialIcon icon="group" size={20} />
        <span>Students</span>
      </Link>
      <Link
        href={quickStep.href}
        className="mobile-nav-item mobile-nav-item-primary"
        aria-label={quickStep.label}
      >
        <MaterialIcon icon={quickStep.icon} size={20} />
        <span>{quickStep.shortLabel}</span>
      </Link>
      <Link
        href="/dashboard/fees"
        className={`mobile-nav-item ${isActive("/dashboard/fees") ? "active" : ""}`}
        aria-current={isActive("/dashboard/fees") ? "page" : undefined}
      >
        <MaterialIcon icon="payments" size={20} />
        <span>Fees</span>
      </Link>
      <button
        type="button"
        className="mobile-nav-item"
        onClick={() => openSidebar()}
        aria-label="Open more pages"
      >
        <MaterialIcon icon="apps" size={20} />
        <span>More</span>
      </button>
    </div>
  );
}
