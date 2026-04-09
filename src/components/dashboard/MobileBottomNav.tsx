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
      return {
        label: "Add Student",
        href: "/dashboard/students",
        icon: "person_add",
      };
    if (pathname.startsWith("/dashboard/students"))
      return {
        label: "Take Attendance",
        href: "/dashboard/attendance",
        icon: "how_to_reg",
      };
    if (pathname.startsWith("/dashboard/attendance"))
      return {
        label: "Record Fees",
        href: "/dashboard/fees",
        icon: "payments",
      };
    if (pathname.startsWith("/dashboard/fees"))
      return {
        label: "Send Reminder",
        href: "/dashboard/messages",
        icon: "sms",
      };
    return {
      label: "Add Student",
      href: "/dashboard/students",
      icon: "person_add",
    };
  }, [pathname]);

  return (
    <div className="mobile-bottom-nav">
      <Link
        href="/dashboard"
        className={`mobile-nav-item ${pathname === "/dashboard" ? "active" : ""}`}
      >
        <MaterialIcon icon="dashboard" size={20} />
        <span>Home</span>
      </Link>
      <Link
        href="/dashboard/students"
        className={`mobile-nav-item ${isActive("/dashboard/students") ? "active" : ""}`}
      >
        <MaterialIcon icon="group" size={20} />
        <span>Students</span>
      </Link>
      <Link
        href={quickStep.href}
        className="mobile-nav-item mobile-nav-item-primary"
      >
        <MaterialIcon icon={quickStep.icon} size={20} />
        <span>{quickStep.label}</span>
      </Link>
      <Link
        href="/dashboard/fees"
        className={`mobile-nav-item ${isActive("/dashboard/fees") ? "active" : ""}`}
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
