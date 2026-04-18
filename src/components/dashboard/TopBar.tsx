"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import GlobalSearch from "@/components/GlobalSearch";
import MaterialIcon from "@/components/MaterialIcon";
import { useTheme } from "@/lib/theme-context";
import { useNotifications } from "@/lib/notifications";
import { useSidebar } from "@/contexts/SidebarContext";

type DashboardNotification = {
  id: string;
  type?: string;
  title: string;
  message: string;
  created_at: string;
  link?: string;
  read: boolean;
};

function getNextStep(path: string): {
  label: string;
  href: string;
  icon: string;
} {
  if (path === "/dashboard")
    return {
      label: "Add students",
      href: "/dashboard/students",
      icon: "person_add",
    };
  if (path.startsWith("/dashboard/students"))
    return {
      label: "Take attendance",
      href: "/dashboard/attendance",
      icon: "how_to_reg",
    };
  if (path.startsWith("/dashboard/attendance"))
    return { label: "Record fees", href: "/dashboard/fees", icon: "payments" };
  if (path.startsWith("/dashboard/fees"))
    return {
      label: "Send reminders",
      href: "/dashboard/messages",
      icon: "sms",
    };
  if (path.startsWith("/dashboard/messages"))
    return {
      label: "View notices",
      href: "/dashboard/notices",
      icon: "campaign",
    };
  return { label: "Back to dashboard", href: "/dashboard", icon: "dashboard" };
}

function NotificationsPanel({
  open,
  onClose,
  notifications,
  onDismiss,
}: {
  open: boolean;
  onClose: () => void;
  notifications: DashboardNotification[];
  onDismiss: (id: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-[14px] shadow-[var(--sh3)] min-w-[300px] max-w-[360px] z-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[var(--t1)]">
          Notifications
        </span>
        <span className="text-[11px] text-[var(--t3)]">
          {notifications.length} items
        </span>
      </div>
      <div className="max-h-[320px] overflow-y-auto">
        {notifications.length === 0 && (
          <div className="px-4 py-[18px] text-[12px] text-[var(--t3)]">
            You are caught up. No urgent items right now.
          </div>
        )}
        {notifications.map((n) => {
          let icon = "notifications";
          let color = "var(--primary)";
          
          switch(n.type) {
            case "warning": icon = "warning"; color = "var(--amber)"; break;
            case "error": icon = "error"; color = "var(--red)"; break;
            case "success": icon = "check_circle"; color = "var(--green)"; break;
            case "payment": icon = "payments"; color = "var(--green)"; break;
            case "attendance": icon = "how_to_reg"; color = "var(--amber)"; break;
          }

          return (
            <div
              key={n.id}
              className={`flex gap-3 px-4 py-3.5 border-b border-[var(--border)] hover:bg-[var(--bg)] transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}
              onClick={() => {
                if (!n.read) onDismiss(n.id);
                if (n.link) window.location.href = n.link;
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}20` }}
              >
                <MaterialIcon
                  icon={icon}
                  style={{ fontSize: 15, color: color }}
                />
              </div>
              <div className="flex-1 min-w-0 cursor-pointer">
                <div className={`text-[12px] text-[var(--t1)] ${!n.read ? 'font-bold' : 'font-semibold'}`}>
                  {n.title}
                </div>
                <div className="text-[11px] text-[var(--t3)] mt-0.5 truncate">
                  {n.message}
                </div>
                <div className="text-[10px] text-[var(--t4)] mt-1">
                  {new Date(n.created_at).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
              {!n.read && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(n.id);
                }}
                className="text-[var(--t4)] hover:text-[var(--t2)] transition-colors self-start mt-1"
                aria-label="Mark as read"
              >
                <MaterialIcon icon="check" style={{ fontSize: 14 }} />
              </button>
              )}
            </div>
          )
        })}
      </div>
      {notifications.length > 0 && (
        <button
          onClick={() => {
             notifications.forEach(n => !n.read && onDismiss(n.id));
             onClose();
          }}
          className="w-full block px-4 py-[10px] text-center text-[12px] text-[var(--primary)] font-medium border-t border-[var(--border)] no-underline hover:bg-[var(--bg)] transition-colors"
        >
          Mark all as read
        </button>
      )}
    </div>
  );
}

function UserMenu({
  open,
  onClose,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const { user, school } = useAuth();
  const schoolName = school?.name || "School";

  if (!open) return null;

  return (
    <div className="absolute top-full right-0 mt-2 bg-[var(--surface)] border border-[var(--border)] rounded-[14px] shadow-[var(--sh3)] min-w-[180px] z-100 overflow-hidden">
      <Link
        href="/dashboard/settings"
        onClick={onClose}
        className="flex items-center gap-2 px-4 py-[10px] text-[13px] text-[var(--t2)] no-underline hover:bg-[var(--bg)] transition-colors"
      >
        <MaterialIcon icon="settings" style={{ fontSize: 16 }} />
        Settings
      </Link>
      <div className="border-t border-[var(--border)]" />
      <button
        onClick={onSignOut}
        className="w-full flex items-center gap-2 px-4 py-[10px] text-[13px] text-[var(--red)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
      >
        <MaterialIcon icon="logout" style={{ fontSize: 16 }} />
        Sign Out
      </button>
    </div>
  );
}

export default function TopBar({
  pageTitle,
  onSignOut,
}: {
  pageTitle: string;
  onSignOut: () => void;
}) {
  const { user, school } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { currentTerm } = useAcademic();
  const pathname = usePathname();
  const path = pathname ?? "";
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [dismissedNotifs, setDismissedNotifs] = useState<Set<string>>(
    new Set(),
  );
  const { isOpen, open: openSidebar, close: closeSidebar } = useSidebar();

  const { notifications, unreadCount, markAsRead } = useNotifications();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuOpen && !(event.target as Element).closest(".user-menu")) {
        setUserMenuOpen(false);
      }
      if (notifOpen && !(event.target as Element).closest(".notif-panel")) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [userMenuOpen, notifOpen]);

  const schoolName = school?.name || "My School";
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString("en-UG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const routeLabels: Record<string, string> = {
    dashboard: "Home",
    students: "Student Hub",
    fees: "Payments",
    grades: "Record Marks",
    staff: "Staff List",
    attendance: "Attendance",
    messages: "Phone & SMS",
    settings: "Settings",
    reports: "Report Cards",
    notices: "Notice Board",
    timetable: "Timetable",
    warnings: "At Risk",
    "bulk-sms": "Send SMS",
    "expense-approvals": "Approve Expenses",
    "leave-approvals": "Approve Leave",
    "dropout-tracking": "Dropout Tracker",
    rollover: "Promote & Transitions",
  };

  const buildBreadcrumbs = () => {
    if (!path) return [{ label: "Dashboard", href: "/dashboard" }];
    const segments = path.split("/").filter(Boolean);
    const crumbs: { label: string; href: string }[] = [];
    let href = "";
    for (const segment of segments) {
      href += `/${segment}`;
      const label = routeLabels[segment] || segment.replace(/-/g, " ");
      crumbs.push({ label, href });
    }
    if (crumbs.length === 0)
      return [{ label: "Dashboard", href: "/dashboard" }];
    return crumbs;
  };

  const breadcrumbs = buildBreadcrumbs();
  const nextStep = getNextStep(path || "/dashboard");

  return (
    <header className="topbar border-b border-[var(--border)] h-[64px] flex items-center px-3 sm:px-5 lg:px-6 gap-2 sm:gap-3 sticky top-0 z-50 shadow-[var(--sh1)] flex-shrink-0">
      <button
        onClick={() => {
          if (isOpen) closeSidebar();
          else openSidebar();
        }}
        className="mobile-menu-btn bg-transparent border-none cursor-pointer p-2 mr-2 w-11 h-11 flex items-center justify-center rounded-lg"
        aria-label="Toggle sidebar"
      >
        <MaterialIcon
          icon="menu"
          style={{ fontSize: 24, color: "var(--t1)" }}
        />
      </button>

      <div className="flex-1 min-w-0">
        <div className="font-['Sora'] text-[16px] sm:text-[18px] font-bold text-[var(--t1)] tracking-[-.2px] truncate">
          {pageTitle}
        </div>
        <div className="text-[11px] sm:text-[12px] text-[var(--t3)] mt-0.5 flex items-center gap-2 truncate">
          <span className="truncate">
            {formattedDate}
          </span>
          <span aria-hidden>•</span>
          <span className="uppercase tracking-wide text-[10px] truncate hidden md:flex items-center gap-1.5">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-[var(--t4)]">/</span>}
                {i === breadcrumbs.length - 1 ? (
                  <span className="text-[var(--t1)] font-medium">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-[var(--primary)] hover:underline transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </span>
        </div>
      </div>

      <div className="search-bar flex items-center gap-[10px] bg-[var(--bg)] border border-[var(--border)] rounded-[12px] px-[14px] py-2 text-[13px] text-[var(--t3)] min-w-[260px] cursor-text">
        <GlobalSearch />
      </div>

      <button
        onClick={() => {
          const trigger = document.querySelector(
            "[data-globalsearch-trigger]",
          ) as HTMLButtonElement | null;
          trigger?.click();
        }}
        className="sm:hidden bg-transparent border-none cursor-pointer p-2 w-11 h-11 flex items-center justify-center rounded-lg text-[var(--t2)] hover:bg-[var(--bg)] transition-colors"
        aria-label="Search"
      >
        <MaterialIcon icon="search" style={{ fontSize: 22 }} />
      </button>

      <div className="flex items-center gap-2">
        <Link
          href={nextStep.href}
          className="flex items-center gap-1.5 h-10 px-2.5 sm:px-3 rounded-[12px] bg-[var(--primary)] text-[var(--on-primary)] text-[12px] font-semibold no-underline shadow-[var(--sh1)] hover:opacity-90 transition-opacity"
          aria-label={`Next step: ${nextStep.label}`}
        >
          <MaterialIcon
            icon={nextStep.icon}
            className="text-[var(--on-primary)]"
            style={{ fontSize: 15 }}
          />
          <span className="hidden lg:inline">Next: {nextStep.label}</span>
        </Link>

        <div className="notif-panel relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="w-10 h-10 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center cursor-pointer shadow-[var(--sh1)] relative hover:bg-[var(--bg)] transition-colors"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
          >
            <MaterialIcon
              icon="notifications"
              style={{ fontSize: 16, color: "var(--t2)" }}
            />
            {unreadCount > 0 && (
              <div className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full bg-[var(--red)] border-[1.5px] border-[var(--surface)]" />
            )}
          </button>
          <NotificationsPanel
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            notifications={notifications}
            onDismiss={(id) => markAsRead(id)}
          />
        </div>

        <button
          onClick={toggleTheme}
          className="w-10 h-10 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center cursor-pointer shadow-[var(--sh1)] hover:bg-[var(--bg)] transition-colors"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          <MaterialIcon
            icon={theme === "dark" ? "light_mode" : "dark_mode"}
            style={{ fontSize: 16, color: "var(--t2)" }}
          />
        </button>

        <div className="relative">
          <button
            className="user-menu flex items-center gap-[10px] py-1.5 pr-3 pl-1 bg-[var(--surface)] border border-[var(--border)] rounded-full cursor-pointer shadow-[var(--sh1)] transition-all hover:bg-[var(--bg)]"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            aria-label="User menu"
            aria-expanded={userMenuOpen}
          >
            <div className="w-[26px] h-[26px] rounded-full bg-[var(--primary)] flex items-center justify-center text-[10px] font-bold text-[var(--on-primary)] font-['Sora']">
              {user?.full_name?.charAt(0) || "U"}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-[13px] font-semibold text-[var(--t1)]">
                {user?.full_name?.split(" ")[0] || "User"}
              </div>
              <div className="text-[11px] text-[var(--t3)]">
                {schoolName.split(" ")[0]}
              </div>
            </div>
          </button>
          <UserMenu
            open={userMenuOpen}
            onClose={() => setUserMenuOpen(false)}
            onSignOut={onSignOut}
          />
        </div>
      </div>
    </header>
  );
}
