"use client";

import { cn } from "@/lib/utils";
import OwlMascot from "@/components/brand/OwlMascot";

interface SkeletonProps {
  className?: string;
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
  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
      <Skeleton className="h-3 w-16 mb-3" />
      <Skeleton className="h-7 w-24 mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function PageLoader({ message = "Loading..." }: { message?: string }) {
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
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <OwlMascot
        size={68}
        premium
        ring
        glow
        animated
        label="SkoolMate is preparing your workspace"
        subtitle="Loading your school records, navigation, and recent activity."
        className="mb-4 flex-col"
      />
      <p className="text-sm text-[var(--t3)]">{message}</p>
    </div>
  );
}

export function DashboardSkeleton() {
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
    </div>
  );
}
