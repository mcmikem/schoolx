"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MaterialIcon from "@/components/MaterialIcon";

const railItems = [
  { href: "/dashboard", icon: "home", label: "Home" },
  { href: "/dashboard/calendar", icon: "calendar_month", label: "Calendar" },
  { href: "/dashboard/messages", icon: "notifications", label: "Alerts" },
  { href: "/dashboard/staff", icon: "group", label: "Teams" },
  { href: "/dashboard/settings", icon: "settings", label: "Settings" },
] as const;

function isActivePath(path: string, href: string) {
  if (href === "/dashboard") return path === href;
  return path === href || path.startsWith(`${href}/`);
}

export default function PageUtilityRail() {
  const pathname = usePathname() || "/dashboard";

  return (
    <div className="px-4 pt-3 sm:px-6 xl:px-0 xl:pt-4">
      <nav
        aria-label="Quick page tools"
        className="flex items-center gap-2 overflow-x-auto rounded-[20px] border border-[#cfe0e4] bg-white/85 p-2 backdrop-blur xl:sticky xl:top-[84px] xl:flex-col xl:items-center xl:gap-3 xl:overflow-visible xl:py-3"
      >
        {railItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${active ? "border-[#0f7f8f] bg-[#0f7f8f] text-white" : "border-[#d9e8ec] bg-white text-[#6f8794] hover:bg-[#edf5f7]"}`}
            >
              <MaterialIcon icon={item.icon} className="text-[17px]" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}