export function RouteSkeleton() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="h-5 w-40 rounded bg-[var(--surface-container)] animate-pulse" />
          <div className="h-3 w-56 rounded bg-[var(--surface-container)]/70 animate-pulse" />
        </div>
        <div className="h-10 w-28 rounded-xl bg-[var(--surface-container)] animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)] animate-pulse">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-[var(--surface-container)]" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-3/4 rounded bg-[var(--surface-container)]" />
                <div className="h-6 w-1/2 rounded bg-[var(--surface-container)]" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] animate-pulse">
        <div className="p-4 border-b border-[var(--border)] space-y-2">
          <div className="h-5 w-32 rounded bg-[var(--surface-container)]" />
          <div className="h-3 w-48 rounded bg-[var(--surface-container)]/70" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 border-b border-[var(--border)] flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-[var(--surface-container)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 max-w-[220px] rounded bg-[var(--surface-container)]" />
              <div className="h-3 w-1/2 max-w-[160px] rounded bg-[var(--surface-container)]/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RouteLoading() {
  return <RouteSkeleton />;
}
