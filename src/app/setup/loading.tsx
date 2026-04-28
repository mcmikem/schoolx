"use client";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#edf4ff_0%,#f7f4ec_56%,#f2ede2_100%)] flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-[var(--surface-container)]" />
        <div className="h-4 w-32 bg-[var(--surface-container)] rounded" />
      </div>
    </div>
  );
}
