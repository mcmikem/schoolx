"use client";
import { memo, useState, useEffect } from "react";
import Link from "next/link";
import MaterialIcon from "@/components/MaterialIcon";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";

interface MemberActivity {
  user_name: string;
  action: string;
  module: string;
  description: string;
  created_at: string;
}

const AVATAR_TONES: Array<[string, string]> = [
  ["var(--primary-100)", "var(--primary-700)"],
  ["var(--green-soft)", "var(--green)"],
  ["var(--amber-soft)", "var(--amber)"],
  ["#f3e8ff", "#7c3aed"],
];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function toneFor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-UG", { month: "short", day: "numeric" });
}

/** Donezo "Team Collaboration" pattern: latest active staff + what they did. */
const TeamPreview = memo(function TeamPreview({ schoolId }: { schoolId?: string }) {
  const [members, setMembers] = useState<MemberActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await withTimeout(
        supabase
          .from("audit_log")
          .select("user_name, action, module, description, created_at")
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false })
          .limit(24),
        8000,
        timeoutFallback<MemberActivity[]>(),
      );
      if (cancelled) return;
      const rows = (res.data ?? []) as MemberActivity[];
      const seen = new Set<string>();
      const latest: MemberActivity[] = [];
      for (const row of rows) {
        const name = (row.user_name || "").trim();
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        latest.push(row);
        if (latest.length >= 4) break;
      }
      setMembers(latest);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  return (
    <div className="card">
      <div className="panel-head !mb-1">
        <h2 className="panel-title">Team activity</h2>
        <Link href="/dashboard/staff-activity" className="card-action-pill" aria-label="Open staff activity">
          View all
          <MaterialIcon icon="arrow_outward" style={{ fontSize: 13 }} />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2 pt-2" aria-label="Loading team activity">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="w-9 h-9 rounded-full bg-[var(--surface-container)] shimmer flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 rounded bg-[var(--surface-container)] shimmer" />
                <div className="h-2.5 w-2/3 rounded bg-[var(--surface-container)] shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <p className="py-3 text-[13px] text-[var(--t3)]">
          No staff activity yet. Actions like attendance and fee payments will show up here.
        </p>
      ) : (
        <div role="list" className="divide-y divide-[var(--bg)]">
          {members.map((m) => {
            const [bg, fg] = toneFor(m.user_name);
            return (
              <div key={`${m.user_name}-${m.created_at}`} role="listitem" className="flex items-center gap-3 py-3">
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                  style={{ background: bg, color: fg }}
                  aria-hidden="true"
                >
                  {initialsOf(m.user_name)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-bold text-[var(--t1)] truncate">{m.user_name}</span>
                  <span className="block text-[11px] text-[var(--t3)] truncate mt-0.5">
                    {m.description || `${m.action} in ${m.module}`}
                  </span>
                </span>
                <span className="flex-shrink-0 text-[11px] font-semibold text-[var(--t4)] whitespace-nowrap">
                  {timeAgo(m.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default TeamPreview;
