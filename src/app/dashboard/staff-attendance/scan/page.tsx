"use client";

import { useEffect, useRef, useState } from "react";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { Html5Qrcode } from "html5-qrcode";

type AttendanceAction = "check_in" | "check_out";

async function parseApiResponse(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as Record<string, unknown>;
  }

  const text = await response.text();
  const fallbackMessage = response.ok
    ? "Unexpected response from server"
    : "Server returned an unexpected error page";

  return {
    success: false,
    error: text.slice(0, 180).trim() || fallbackMessage,
  };
}

export default function StaffAttendanceScanPage() {
  const toast = useToast();
  const scannerIdRef = useRef(
    typeof crypto !== "undefined" ? crypto.randomUUID() : `staff-${Date.now()}`,
  );
  const [action, setAction] = useState<AttendanceAction>("check_in");
  const [scanValue, setScanValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Array<{ name: string; action: string; time: string }>>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        try {
          scannerRef.current.clear();
        } catch {
          // Ignore scanner cleanup errors
        }
      }
    };
  }, []);

  const submitScan = async (value: string) => {
    if (!value.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch("/api/staff/scan-attendance/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanValue: value.trim(),
          action,
          scannerId: scannerIdRef.current,
        }),
      });

      const result = await parseApiResponse(response);
      if (!response.ok || !result.success) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Failed to record attendance",
        );
      }

      const data = (result.data as Record<string, unknown> | undefined) || {};
      const staff = (data.staff as Record<string, unknown> | undefined) || {};
      const name = typeof staff.full_name === "string" ? staff.full_name : "Staff";
      const label = action === "check_in" ? "Check In" : "Check Out";

      setRecent((prev) => [
        {
          name,
          action: label,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 10));

      setScanValue("");
      toast.success(
        typeof result.message === "string"
          ? result.message
          : `${name} ${label.toLowerCase()} complete`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record attendance");
    } finally {
      setSubmitting(false);
    }
  };

  const startScanner = async () => {
    setShowScanner(true);
    setScannerError(null);

    try {
      const scanner = new Html5Qrcode("staff-scan-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decodedText: string) => {
          await stopScanner();
          await submitScan(decodedText);
        },
        () => {},
      );
    } catch (error) {
      setScannerError(error instanceof Error ? error.message : "Could not start scanner");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // Ignore scanner shutdown errors
      }
      scannerRef.current = null;
    }
    setShowScanner(false);
  };

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Staff Attendance Scan Terminal</h1>
          <p className="text-sm text-slate-500">Scan staff cards for clock in / clock out workflows.</p>
        </div>

        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant={action === "check_in" ? "primary" : "secondary"} onClick={() => setAction("check_in")}>Check In</Button>
            <Button variant={action === "check_out" ? "primary" : "secondary"} onClick={() => setAction("check_out")}>Check Out</Button>
          </div>

          <button
            onClick={startScanner}
            disabled={submitting}
            className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:bg-slate-50 disabled:opacity-50"
          >
            <MaterialIcon icon="qr_code_scanner" className="text-4xl text-slate-400 mb-2" />
            <p className="font-bold text-slate-800">Scan staff ID card to {action === "check_in" ? "check in" : "check out"}</p>
          </button>

          <div className="flex gap-2">
            <input
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitScan(scanValue)}
              placeholder="Or paste scanned payload"
              className="input flex-1"
            />
            <Button onClick={() => submitScan(scanValue)} disabled={submitting}>Submit</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-4">Recent Activity</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">No attendance scans yet.</p>
          ) : (
            <div className="space-y-3">
              {recent.map((entry, index) => (
                <div key={`${entry.name}-${entry.time}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{entry.name}</p>
                    <p className="text-xs text-slate-500">{entry.action}</p>
                  </div>
                  <span className="text-xs font-medium text-slate-500">{entry.time}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {showScanner && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Scan Staff Card</h3>
              <button onClick={stopScanner} className="p-2 rounded hover:bg-slate-100">
                <MaterialIcon icon="close" />
              </button>
            </div>
            <div className="p-4">
              {scannerError ? (
                <p className="text-sm text-red-600">{scannerError}</p>
              ) : (
                <div id="staff-scan-reader" className="w-full aspect-square rounded-xl overflow-hidden bg-slate-900" />
              )}
            </div>
          </div>
        </div>
      )}
    </PageErrorBoundary>
  );
}
