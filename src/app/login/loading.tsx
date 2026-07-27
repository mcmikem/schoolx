export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)]">
      <div className="w-full max-w-md space-y-6 animate-pulse">
        <div className="text-center space-y-3">
          <div className="h-10 w-48 rounded-lg bg-[var(--surface-container)] mx-auto" />
          <div className="h-4 w-64 rounded bg-[var(--surface-container)] mx-auto" />
        </div>
        <div className="bg-[var(--surface)] rounded-2xl p-6 border border-[var(--border)] space-y-5">
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-[var(--surface-container)]" />
            <div className="h-12 w-full rounded-xl bg-[var(--surface-container)]" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-[var(--surface-container)]" />
            <div className="h-12 w-full rounded-xl bg-[var(--surface-container)]" />
          </div>
          <div className="h-12 w-full rounded-xl bg-[var(--surface-container)]" />
          <div className="h-4 w-48 rounded bg-[var(--surface-container)] mx-auto" />
        </div>
      </div>
    </div>
  );
}
