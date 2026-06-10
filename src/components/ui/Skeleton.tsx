"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import OwlMascot from "@/components/brand/OwlMascot";
import MaterialIcon from "@/components/MaterialIcon";
import { APP_NAME } from "@/lib/app-name";

interface SkeletonProps {
  className?: string;
}

function useDelayedVisible(delayMs: number) {
  const [visible, setVisible] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) {
      setVisible(true);
      return;
    }

    setVisible(false);
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return visible;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-[var(--surface-container)] rounded-lg",
        className,
      )}
    />
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  const visible = useDelayedVisible(250);
  if (!visible) return null;

  return (
    <div className="space-y-3">
      <div className="flex gap-4 px-4 py-3">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 px-4 py-4 border-b border-[var(--border)]"
        >
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className = "" }: SkeletonProps) {
  const visible = useDelayedVisible(250);
  if (!visible) return null;

  return (
    <div
      className={cn(
        "bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function StatSkeleton() {
  const visible = useDelayedVisible(250);
  if (!visible) return null;

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
      <Skeleton className="h-3 w-16 mb-3" />
      <Skeleton className="h-7 w-24 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function PageLoader({ message = "Loading..." }: { message?: string }) {
  const visible = useDelayedVisible(300);
  if (!visible) return null;

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <OwlMascot size={52} premium ring glow animated className="mb-4" />
      <p className="text-sm text-[var(--t3)]">{message}</p>
    </div>
  );
}

export function FullPageLoader({
  message = "Loading...",
}: {
  message?: string;
}) {
  const visible = useDelayedVisible(300);
  if (!visible) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <OwlMascot
        size={68}
        premium
        ring
        glow
        animated
        label={`${APP_NAME} is preparing your workspace`}
        subtitle="Loading your school records, navigation, and recent activity."
        className="mb-4 flex-col"
      />
      <p className="text-sm text-[var(--t3)]">{message}</p>
    </div>
  );
}

export function TopLoadingBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 overflow-hidden">
      <div className="h-full w-full bg-[var(--primary)]/20">
        <div className="h-full w-1/3 bg-[var(--primary)] rounded-full animate-loading-bar" />
      </div>
      <style jsx>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(300%); }
          100% { transform: translateX(500%); }
        }
        .animate-loading-bar {
          animation: loading-bar 1.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export function MinimalLoadingScreen({
  message = "Verifying your session...",
}: {
  message?: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <TopLoadingBar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <OwlMascot size={52} premium ring glow animated />
          <p className="mt-4 text-sm text-[var(--t3)]">{message}</p>
        </div>
      </div>
      <StuckLoadingOverlay />
    </div>
  );
}

export function StuckLoadingOverlay({
  delay = 10000,
  onRefresh,
}: {
  delay?: number;
  onRefresh?: () => void;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300"
      role="alert"
    >
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <MaterialIcon
            icon="hourglass_empty"
            className="text-2xl text-[var(--warning)] shrink-0 mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--t1)]">
              Taking longer than usual?
            </p>
            <p className="text-xs text-[var(--t3)] mt-1 leading-relaxed">
              The app might still be loading. Try refreshing if this persists.
            </p>
            <button
              onClick={() => {
                if (onRefresh) onRefresh();
                else router.refresh();
              }}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
            >
              <MaterialIcon icon="refresh" className="text-base" />
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  const visible = useDelayedVisible(300);
  if (!visible) return null;

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <div className="w-[var(--sidebar-width)] bg-[var(--surface)] border-r border-[var(--border)] p-4 space-y-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <OwlMascot size={44} premium ring glow />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-24 rounded-lg" />
            <Skeleton className="h-3 w-32 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-16 w-full rounded-lg" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
      <div className="flex-1 p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
            <Skeleton className="h-5 w-40 mb-4" />
            <TableSkeleton rows={5} />
          </div>
        </div>
      </div>
      <StuckLoadingOverlay />
    </div>
  );
}
