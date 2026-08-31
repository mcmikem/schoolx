"use client";
// Compatibility shim — canonical skeletons are in @/components/ui/Skeleton
// Re-export unified implementations so both import paths work.
export {
  DashboardSkeleton,
  TableSkeleton,
  CardSkeleton,
  Skeleton,
  PageLoader,
  FullPageLoader,
  StuckLoadingOverlay,
  TopLoadingBar,
} from "@/components/ui/Skeleton";
import { Skeleton } from "@/components/ui/Skeleton";

export function PageSkeleton() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4 rounded-lg" />
                <Skeleton className="h-6 w-1/2 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)]">
        <Skeleton className="h-5 w-32 m-4 rounded" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 border-b border-[var(--border)] flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3 max-w-[220px] rounded" />
              <Skeleton className="h-3 w-1/2 max-w-[160px] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-10 rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-xl" />
    </div>
  );
}

export function StatsGridSkeleton({ cols = 4 }: { cols?: number }) {
  const colClass =
    cols === 2
      ? "grid-cols-1 md:grid-cols-2"
      : cols === 3
        ? "grid-cols-1 md:grid-cols-3"
        : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";
  return (
    <div className={`grid ${colClass} gap-4`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-6 w-16 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuickActionsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)] space-y-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-2 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}
