"use client";

import React from "react";

/* ────────────────────────────────────────────────────────────────
   SkoolMate OS — Skeleton Screens with Wave Shimmer
   ──────────────────────────────────────────────────────────────── */

interface SkeletonProps {
  className?: string;
  children?: React.ReactNode;
}

export function Skeleton({ className = "", children }: SkeletonProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-[var(--surface-container)] ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer-wave bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      {children}
    </div>
  );
}

/* ── Pre-built skeleton layouts ── */

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 rounded-lg" />
              <Skeleton className="h-3 w-1/2 rounded-lg" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full rounded-lg" />
            <Skeleton className="h-3 w-5/6 rounded-lg" />
          </div>
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      {/* Header */}
      <div className="flex gap-4 border-b border-[var(--border)] bg-[var(--surface-container-low)] px-5 py-3">
        <Skeleton className="h-4 flex-1 rounded-lg" />
        <Skeleton className="h-4 flex-1 rounded-lg" />
        <Skeleton className="h-4 w-24 rounded-lg hidden sm:block" />
        <Skeleton className="h-4 w-24 rounded-lg hidden md:block" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-[var(--border)] px-5 py-3 last:border-0"
        >
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-4 w-3/4 rounded-lg" />
          </div>
          <Skeleton className="h-4 flex-1 rounded-lg" />
          <Skeleton className="h-4 w-24 rounded-lg hidden sm:block" />
          <Skeleton className="h-4 w-24 rounded-lg hidden md:block" />
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <Skeleton className="h-3 w-24 rounded-lg" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Skeleton className="h-3 w-12 rounded-lg" />
            <Skeleton className="h-3 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <Skeleton className="h-6 w-1/3 rounded-lg" />
      <div className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24 rounded-lg" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-11 w-28 rounded-xl" />
        <Skeleton className="h-11 w-28 rounded-xl" />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <StatsSkeleton count={4} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <TableSkeleton rows={5} />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <CardSkeleton count={2} />
        </div>
      </div>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="w-[264px] space-y-4 border-r border-[var(--border)] bg-[var(--surface)] p-4">
      <Skeleton className="h-10 w-3/4 rounded-xl" />
      <div className="space-y-2 pt-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-md" />
            <Skeleton className="h-4 flex-1 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
