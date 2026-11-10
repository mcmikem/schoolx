"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useOnlineStatus } from "@/lib/offline";
import { safeLocalStorage } from "@/lib/safe-storage";
import {
  preparationKey,
  readPreparation,
  PREPARATION_EVENT,
  PREPARE_EVENT,
  type Preparation,
} from "@/lib/offline-preparation";

export function OfflinePreparation() {
  const { user, school, isDemo } = useAuth();
  const online = useOnlineStatus();
  const [progress, setProgress] = useState<Preparation | null>(null);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [classScope, setClassScope] = useState<"all" | "selected">("all");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const key = user && school ? preparationKey(user.id, school.id) : "";
  const selectionKey = user && school ? `skoolmate_offline_classes_v1:${user.id}:${school.id}` : "";
  useEffect(() => {
    setProgress(key ? readPreparation(key) : null);
    if (!selectionKey) return;
    try {
      const saved = JSON.parse(safeLocalStorage.getItem(selectionKey) || "null") as string[] | null;
      if (Array.isArray(saved) && saved.length > 0) {
        setSelectedClassIds(saved);
        setClassScope("selected");
      } else {
        setSelectedClassIds([]);
        setClassScope("all");
      }
    } catch {
      setSelectedClassIds([]);
      setClassScope("all");
    }
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; preparation: Preparation }>).detail;
      if (detail?.key === key) setProgress(detail.preparation);
    };
    window.addEventListener(PREPARATION_EVENT, update);
    return () => window.removeEventListener(PREPARATION_EVENT, update);
  }, [key, selectionKey]);
  useEffect(() => {
    let cancelled = false;
    if (!online || !school?.id) return;
    setClassesLoading(true);
    void import("@/lib/supabase")
      .then(async ({ supabase }) => {
        const { data, error } = await supabase
          .from("classes")
          .select("id,name")
          .eq("school_id", school.id)
          .order("name");
        if (cancelled) return;
        if (!error) setClasses((data || []).map((row) => ({ id: String(row.id), name: String(row.name || "Class") })));
        setClassesLoading(false);
      })
      .catch(() => {
        if (!cancelled) setClassesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [online, school?.id]);
  const saveClassSelection = (scope: "all" | "selected", ids = selectedClassIds) => {
    setClassScope(scope);
    setSelectedClassIds(ids);
    if (!selectionKey) return;
    safeLocalStorage.setItem(selectionKey, JSON.stringify(scope === "all" ? [] : ids));
  };
  return (
    <section
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3"
      aria-label="Offline preparation"
    >
      <h2 className="font-bold text-base">Prepare for offline work</h2>
      <p className="text-sm text-[var(--t2)]">
        Download student records and working data while connected. History may be limited; check the coverage below
        before relying on it offline.
      </p>
      <details className="rounded-lg border border-[var(--border)] bg-[var(--surface-container-low)] p-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-[var(--t1)]">
          What can I do offline?
        </summary>
        <div className="mt-2 space-y-3 text-sm text-[var(--t2)]">
          <p>
            These tasks need a successful download on this device first. A saved change stays pending until it appears
            as synced in Sync Center.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--t1)]">
                  <th scope="col" className="px-2 py-2">
                    Task
                  </th>
                  <th scope="col" className="px-2 py-2">
                    After download
                  </th>
                  <th scope="col" className="px-2 py-2">
                    Needs internet / caution
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                <tr>
                  <th scope="row" className="px-2 py-2 font-medium text-[var(--t1)]">
                    Attendance
                  </th>
                  <td className="px-2 py-2">Open the cached roster and queue attendance marks.</td>
                  <td className="px-2 py-2">QR scanning is online-only; marks are not on the server until synced.</td>
                </tr>
                <tr>
                  <th scope="row" className="px-2 py-2 font-medium text-[var(--t1)]">
                    Grades
                  </th>
                  <td className="px-2 py-2">Open cached classes and marks; queue grade changes.</td>
                  <td className="px-2 py-2">Sync before treating totals or reports as final.</td>
                </tr>
                <tr>
                  <th scope="row" className="px-2 py-2 font-medium text-[var(--t1)]">
                    Fees
                  </th>
                  <td className="px-2 py-2">View cached learners, fee setup, and recent payment records.</td>
                  <td className="px-2 py-2">
                    An offline payment is pending until sync succeeds; do not treat it as confirmed.
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="px-2 py-2 font-medium text-[var(--t1)]">
                    Reports
                  </th>
                  <td className="px-2 py-2">Preview reports from cached student and grade records.</td>
                  <td className="px-2 py-2">
                    Check freshness and sync queued report changes before publishing or printing official copies.
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="px-2 py-2 font-medium text-[var(--t1)]">
                    Timetable
                  </th>
                  <td className="px-2 py-2">View the timetable saved on this device.</td>
                  <td className="px-2 py-2">Changes remain pending until synced.</td>
                </tr>
                <tr>
                  <th scope="row" className="px-2 py-2 font-medium text-[var(--t1)]">
                    Calendar
                  </th>
                  <td className="px-2 py-2">View cached events and queue supported event changes.</td>
                  <td className="px-2 py-2">Other users will not see a change until it syncs.</td>
                </tr>
                <tr>
                  <th scope="row" className="px-2 py-2 font-medium text-[var(--t1)]">
                    Homework
                  </th>
                  <td className="px-2 py-2">View cached homework and queue supported homework changes.</td>
                  <td className="px-2 py-2">Confirm queued work in Sync Center after reconnecting.</td>
                </tr>
                <tr>
                  <th scope="row" className="px-2 py-2 font-medium text-[var(--t1)]">
                    Student profiles
                  </th>
                  <td className="px-2 py-2">Only profile fields with an offline save action can be queued.</td>
                  <td className="px-2 py-2">Other student edits and actions need internet.</td>
                </tr>
                <tr>
                  <th scope="row" className="px-2 py-2 font-medium text-[var(--t1)]">
                    Messages
                  </th>
                  <td className="px-2 py-2">Previously downloaded messages may be available to read.</td>
                  <td className="px-2 py-2">Sending messages requires internet.</td>
                </tr>
                <tr>
                  <th scope="row" className="px-2 py-2 font-medium text-[var(--t1)]">
                    Parent portal
                  </th>
                  <td className="px-2 py-2">Offline parent workflows have not been verified.</td>
                  <td className="px-2 py-2">Use the portal while connected.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="font-medium text-[var(--t1)]">
            A first visit without internet is not a supported setup. Connect, sign in, download offline data and pages,
            and check each row’s coverage before leaving the office. Offline access is not a substitute for a current
            backup.
          </p>
          <p>Any task not listed here should be treated as online-only until your school verifies it.</p>
        </div>
      </details>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-[var(--t1)]">Classes to include in the next download</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--t2)]">
          <input
            type="radio"
            name="offline-class-scope"
            checked={classScope === "all"}
            onChange={() => saveClassSelection("all")}
          />
          All classes available to my account
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--t2)]">
          <input
            type="radio"
            name="offline-class-scope"
            checked={classScope === "selected"}
            onChange={() => saveClassSelection("selected")}
          />
          Only selected classes
        </label>
        {classScope === "selected" && (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
            {classesLoading ? (
              <p className="p-2 text-sm text-[var(--t2)]">Loading classes…</p>
            ) : classes.length === 0 ? (
              <p className="p-2 text-sm text-[var(--t2)]">No classes are available to select while connected.</p>
            ) : (
              classes.map((item) => (
                <label key={item.id} className="flex min-h-11 items-center gap-2 px-2 text-sm text-[var(--t2)]">
                  <input
                    type="checkbox"
                    checked={selectedClassIds.includes(item.id)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...selectedClassIds, item.id]
                        : selectedClassIds.filter((id) => id !== item.id);
                      saveClassSelection("selected", next);
                    }}
                  />
                  {item.name}
                </label>
              ))
            )}
          </div>
        )}
        {classScope === "selected" && (
          <p className="text-xs text-[var(--t2)]">
            This selection filters the next download. After it succeeds, old same-school records outside the selected
            classes are removed; pending changes are kept.
          </p>
        )}
      </fieldset>
      <button
        type="button"
        disabled={
          !online ||
          progress?.running ||
          isDemo ||
          (classScope === "selected" && (classesLoading || selectedClassIds.length === 0))
        }
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent(PREPARE_EVENT, { detail: { classIds: classScope === "selected" ? selectedClassIds : [] } }),
          )
        }
        className="min-h-11 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {progress?.running ? "Preparing…" : "Download offline data and pages"}
      </button>
      <a
        href="/offline.html"
        className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--primary)] underline"
      >
        Check saved pages
      </a>
      <p className="text-xs text-[var(--t2)]">
        Uses mobile data and device storage. Larger schools take longer.{" "}
        {isDemo ? "Downloads are unavailable in demo mode." : ""}
      </p>
      <div role="status" aria-live="polite" className="text-sm text-[var(--t2)]">
        {progress
          ? `${progress.running ? "Preparing" : "Last prepared"}: ${new Date(progress.at).toLocaleString()}`
          : "Offline coverage has not been verified yet."}
      </div>
      {progress && (
        <ul className="space-y-2 text-sm">
          {Object.entries(progress.tables).map(([table, coverage]) => (
            <li key={table}>
              <span className="capitalize">{table.replace(/_/g, " ")}</span>: {coverage.rows}
              {coverage.total !== null ? ` of ${coverage.total}` : ""} records —{" "}
              {coverage.complete ? "complete at download time" : "partial download"}
            </li>
          ))}
        </ul>
      )}
      {progress && progress.errors.length > 0 && (
        <p role="alert" className="text-sm text-[var(--red)]">
          Some downloads failed. Coverage is incomplete. Reconnect and try again.
        </p>
      )}
    </section>
  );
}
