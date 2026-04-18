"use client";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useSyncStatus } from "@/lib/useSyncStatus";
import CollapsibleSidebar from "@/components/CollapsibleSidebar";
import { getNavigationForRole } from "@/lib/navigation";
import MaterialIcon from "@/components/MaterialIcon";
import { useSidebar } from "@/contexts/SidebarContext";

function SyncStatus() {
  const { isOnline, pendingCount, isSyncing } = useSyncStatus();

  return (
    <div className="flex items-center gap-[7px] text-[11px] font-medium text-[var(--green)]">
      <div
        className="w-[7px] h-[7px] rounded-full"
        style={{
          background: isOnline ? "var(--green)" : "var(--red)",
          animation:
            isOnline && !isSyncing ? "blink 2.5s ease-in-out infinite" : "none",
        }}
      />
      {isOnline ? (isSyncing ? "Syncing..." : "System Active") : "Offline"}
      {pendingCount > 0 && (
        <span className="ml-auto text-[10px] text-[var(--amber)] font-[DM Mono]">
          {pendingCount} pending
        </span>
      )}
    </div>
  );
}

export default function SidebarShell({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { user, school } = useAuth();
  const { currentTerm } = useAcademic();
  const { isOpen, close } = useSidebar();
  const navigationGroups = user?.role ? getNavigationForRole(user.role) : [];

  const schoolName = school?.name || "My School";

  const sidebarClasses = `sidebar bg-[var(--surface)] border-r border-[var(--border)] w-[var(--sidebar-width)] min-w-[var(--sidebar-width)] flex flex-col fixed top-0 left-0 bottom-0 z-100 shadow-[var(--sh2)] ${isOpen ? "open" : ""}`;

  return (
    <aside className={sidebarClasses}>
      <div className="px-[18px] pt-5 pb-4 border-b border-[var(--border)] bg-[linear-gradient(180deg,rgba(240,247,255,0.5)_0%,rgba(255,255,255,0)_100%)]">
        <div className="flex items-center gap-[10px] mb-4">
          {school?.logo_url ? (
            <Image
              src={school.logo_url}
              alt={schoolName}
              width={36}
              height={36}
              className="w-[var(--logo-size)] h-[var(--logo-size)] rounded-[10px] object-cover"
            />
          ) : (
            <Image
              src="/SkoolMate logos/SchoolMate logo official.svg"
              alt="SkoolMate OS Logo"
              width={36}
              height={36}
              className="w-[var(--logo-size)] h-[var(--logo-size)] object-contain"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-['Sora'] text-base font-bold text-[var(--t1)] tracking-[-.2px] leading-[1.1] truncate">
              {schoolName}
            </div>
            <div className="text-[10px] text-[var(--t4)] tracking-[.3px] mt-0.5 uppercase">
              School Operations
            </div>
          </div>
          <button
            onClick={() => close()}
            className="sidebar-close-btn hidden w-8 h-8 rounded-lg border-none bg-[var(--bg)] cursor-pointer items-center justify-center"
            aria-label="Close sidebar"
          >
            <MaterialIcon
              icon="close"
              style={{ fontSize: 20, color: "var(--t2)" }}
            />
          </button>
        </div>

        <div className="bg-[var(--bg)] border border-[var(--border)] rounded-[var(--r)] px-3 py-2.5">
          <div className="text-[12px] font-semibold text-[var(--t1)] leading-[1.3] truncate">
            {schoolName}
          </div>
          <div className="text-[11px] text-[var(--t3)] mt-[3px] flex items-center gap-[5px]">
            <span className="inline-block w-[6px] h-[6px] rounded-full bg-[var(--green)] flex-shrink-0" />
            {user?.role?.replace("_", " ") || "User"} · Term{" "}
            {currentTerm || "..."}
          </div>
        </div>
      </div>

      <CollapsibleSidebar groups={navigationGroups} onNavigate={onNavigate} />

      <div className="px-4 py-3 border-t border-[var(--border)]">
        <SyncStatus />
      </div>
    </aside>
  );
}
