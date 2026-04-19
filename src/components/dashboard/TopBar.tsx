"use client";
import { useState, useEffect, useRef } from "react";
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
  const { isOpen, open: openSidebar, close: closeSidebar } = useSidebar();
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const notifPanelRef = useRef<HTMLDivElement | null>(null);

  const { notifications, unreadCount, markAsRead } = useNotifications();

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
      if (notifOpen && notifPanelRef.current && !notifPanelRef.current.contains(target)) {
        setNotifOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
        setNotifOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
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
    <header
      data-testid="dashboard-header"
      className="topbar h-[56px] flex items-center px-3 sm:px-5 lg:px-6 gap-2 sm:gap-3 sticky top-0 z-50 flex-shrink-0 border-b border-[var(--border)]"
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={() => {
          if (isOpen) closeSidebar();
          else openSidebar();
        }}
        className="mobile-menu-btn bg-transparent border-none cursor-pointer p-1.5 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--bg)] transition-colors"
        aria-label="Toggle sidebar"
        aria-expanded={isOpen}
        aria-controls="dashboard-sidebar"
      >
        <MaterialIcon
          icon="menu"
          style={{ fontSize: 22, color: "var(--t1)" }}
        />
      </button>

      {/* Page title + date */}
      <div className="flex-1 min-w-0">
        <div className="font-['Sora'] text-[15px] sm:text-[17px] font-bold text-[var(--t1)] tracking-[-.2px] truncate leading-tight">
          {pageTitle}
        </div>
        <div className="text-[11px] text-[var(--t3)] truncate leading-tight mt-0.5 hidden sm:block">
          {formattedDate}
          {currentTerm ? ` · Term ${currentTerm}` : ""}
        </div>
      </div>

      {/* Search — desktop inline, mobile icon */}
      <div className="search-bar hidden sm:flex items-center gap-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-[13px] text-[var(--t3)] min-w-[200px] lg:min-w-[260px] cursor-text">
        <GlobalSearch />
      </div>
      <button
        onClick={() => {
          const trigger = document.querySelector(
            "[data-globalsearch-trigger]",
          ) as HTMLButtonElement | null;
          trigger?.click();
        }}
        className="sm:hidden bg-transparent border-none cursor-pointer p-1.5 w-9 h-9 flex items-center justify-center rounded-lg text-[var(--t2)] hover:bg-[var(--bg)] transition-colors"
        aria-label="Search"
      >
        <MaterialIcon icon="search" style={{ fontSize: 20 }} />
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        <div ref={notifPanelRef} className="notif-panel relative">
          <button
            onClick={() => {
              setNotifOpen((current) => !current);
              setUserMenuOpen(false);
            }}
            className="w-9 h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center cursor-pointer relative hover:bg-[var(--bg)] transition-colors"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
          >
            <MaterialIcon
              icon="notifications"
              style={{ fontSize: 18, color: "var(--t2)" }}
            />
            {unreadCount > 0 && (
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--red)] border border-[var(--surface)]" />
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
          className="hidden sm:flex w-9 h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] items-center justify-center cursor-pointer hover:bg-[var(--bg)] transition-colors"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          <MaterialIcon
            icon={theme === "dark" ? "light_mode" : "dark_mode"}
            style={{ fontSize: 18, color: "var(--t2)" }}
          />
        </button>

        <div ref={userMenuRef} className="relative">
          <button
            className="user-menu flex items-center gap-2 py-1 pr-2.5 pl-1 bg-[var(--surface)] border border-[var(--border)] rounded-full cursor-pointer transition-colors hover:bg-[var(--bg)]"
            onClick={() => {
              setUserMenuOpen((current) => !current);
              setNotifOpen(false);
            }}
            aria-label="User menu"
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
          >
            <div className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center text-[11px] font-bold text-[var(--on-primary)] font-['Sora']">
              {user?.full_name?.charAt(0) || "U"}
            </div>
            <span className="hidden sm:block text-[13px] font-medium text-[var(--t1)] max-w-[100px] truncate">
              {user?.full_name?.split(" ")[0] || "User"}
            </span>
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
