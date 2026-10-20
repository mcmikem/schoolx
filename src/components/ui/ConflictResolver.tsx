"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui/index";

export interface ConflictResolverProps {
  /** e.g. "students · Asha Nakato" */
  title: string;
  subtitle?: string;
  reason?: string;
  local: Record<string, unknown>;
  server: Record<string, unknown>;
  fieldLabels?: Record<string, string>;
  onKeepLocal: () => void | Promise<void>;
  onKeepServer: () => void | Promise<void>;
  busy?: boolean;
  className?: string;
}

function format(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function same(a: unknown, b: unknown): boolean {
  return format(a) === format(b);
}

export function ConflictResolver({
  title,
  subtitle,
  reason,
  local,
  server,
  fieldLabels,
  onKeepLocal,
  onKeepServer,
  busy = false,
  className = "",
}: ConflictResolverProps) {
  const [working, setWorking] = useState<"local" | "server" | null>(null);

  const fields = useMemo(() => {
    const keys = new Set([...Object.keys(local), ...Object.keys(server)]);
    keys.delete("updated_at");
    return Array.from(keys);
  }, [local, server]);

  const differences = fields.filter((key) => !same(local[key], server[key]));
  const shown = differences.length > 0 ? differences : fields.slice(0, 6);

  const run = async (which: "local" | "server") => {
    setWorking(which);
    try {
      if (which === "local") await onKeepLocal();
      else await onKeepServer();
    } finally {
      setWorking(null);
    }
  };

  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--amber)]/40 bg-[var(--surface)] p-4 shadow-[var(--sh1)]",
        className,
      )}
      aria-label={`Resolve conflict for ${title}`}
    >
      <header className="flex items-start gap-3">
        <MaterialIcon icon="sync_problem" className="mt-0.5 text-xl text-[var(--amber)]" />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--t1)]">{title}</h3>
          {subtitle && <p className="truncate text-xs text-[var(--t3)]">{subtitle}</p>}
          <p className="mt-1 text-xs text-[var(--t2)]">
            Another device changed this record after your offline edit. Pick the version to keep.
          </p>
          {reason && <p className="mt-1 break-words text-xs text-[var(--t3)]">{reason}</p>}
        </div>
      </header>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/[0.04] p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">On this device</p>
          <dl className="space-y-1.5">
            {shown.map((key) => (
              <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2 text-xs">
                <dt className="truncate text-[var(--t3)]">{fieldLabels?.[key] ?? key}</dt>
                <dd className="break-words text-[var(--t1)]">{format(local[key])}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--t3)]">On the server</p>
          <dl className="space-y-1.5">
            {shown.map((key) => (
              <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2 text-xs">
                <dt className="truncate text-[var(--t3)]">{fieldLabels?.[key] ?? key}</dt>
                <dd className="break-words text-[var(--t1)]">{format(server[key])}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {differences.length === 0 && (
        <p className="mt-2 text-xs text-[var(--t3)]">No visible fields differ — the server copy is simply newer.</p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          onClick={() => run("server")}
          disabled={busy || working !== null}
          loading={working === "server"}
        >
          Keep server version
        </Button>
        <Button
          variant="primary"
          onClick={() => run("local")}
          disabled={busy || working !== null}
          loading={working === "local"}
        >
          Keep my changes
        </Button>
      </div>
    </section>
  );
}
