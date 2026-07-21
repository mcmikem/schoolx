export default function StudentPortalLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg)]">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--border)] border-t-[var(--primary)] animate-spin mx-auto mb-3" />
        <p className="text-[var(--t3)]">Loading your portal...</p>
      </div>
    </div>
  );
}
