"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useAuth } from "@/lib/auth-context";
import { useClasses } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui/Card";
import { parseApiResponse } from "@/lib/api-response";
import { getLocalDateString } from "@/lib/hooks/utils";
import { supabase } from "@/lib/supabase";

export default function AttendanceScanPage() {
  const { school, user } = useAuth();
  const { classes } = useClasses(school?.id);
  const toast = useToast();
  const scannerIdRef = useRef(crypto.randomUUID());
  const [selectedClass, setSelectedClass] = useState("");
  const [date, setDate] = useState(getLocalDateString());
  const [scanValue, setScanValue] = useState("");
  const [serving, setServing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Array<{ name: string; status: string; time: string }>>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const scannerRef = useRef<any>(null);

  const totalStudents = classes.find((c) => c.id === selectedClass) ? 0 : 0;

  const serveAttendance = async (value: string) => {
    if (!value.trim() || !selectedClass) {
      toast.error("Select a class and scan a student card");
      return;
    }
    try {
      setServing(true);
      // Extract UUID from scanned value (URL or raw UUID)
      const uuidMatch = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      const studentId = uuidMatch ? uuidMatch[0] : value.trim();

      const { data: student } = await supabase
        .from("students")
        .select("id, first_name, last_name, student_number")
        .eq("id", studentId)
        .eq("school_id", school?.id)
        .maybeSingle();

      if (!student) {
        toast.error("Student not found");
        return;
      }

      if (marked.has(student.id)) {
        toast.info(`${student.first_name} ${student.last_name} already marked`);
        setScanValue("");
        return;
      }

      const { error } = await supabase.from("attendance").upsert(
        {
          student_id: student.id,
          class_id: selectedClass,
          date,
          status: "present",
          period_number: 1,
          recorded_by: user?.id,
        },
        { onConflict: "student_id,date,period_number" },
      );

      if (error) throw error;

      setMarked((prev) => new Set(prev).add(student.id));
      setRecent((prev) =>
        [
          {
            name: `${student.first_name} ${student.last_name}`,
            status: "Present",
            time: new Date().toLocaleTimeString(),
          },
          ...prev,
        ].slice(0, 15),
      );
      toast.success(`${student.first_name} ${student.last_name} marked present`);
      setScanValue("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark attendance");
    } finally {
      setServing(false);
    }
  };

  const startScanner = async () => {
    setShowScanner(true);
    setScannerError(null);
    try {
      const { Html5Qrcode: Html5QrcodeClass } = await import("html5-qrcode");
      const scanner = new Html5QrcodeClass("attendance-scan-region");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decodedText: string) => {
          await serveAttendance(decodedText);
        },
        () => {},
      );
    } catch (error) {
      setScannerError(error instanceof Error ? error.message : "Camera unavailable");
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current) await scannerRef.current.stop();
    } catch {}
    scannerRef.current = null;
    setShowScanner(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) scannerRef.current.stop().catch(() => {});
    };
  }, []);

  return (
    <PageErrorBoundary>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--t1)]">Attendance Scan</h1>
          <p className="text-sm text-[var(--t3)]">Scan student ID cards to mark attendance</p>
        </div>

        <Card>
          <div className="space-y-4 p-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-2">Class</label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setMarked(new Set());
                  setRecent([]);
                }}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--t1)]"
              >
                <option value="">Select a class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--t3)] mb-2">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--t1)]"
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <input
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && serveAttendance(scanValue)}
                placeholder="Scan or type student number…"
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--t1)]"
              />
              <Button onClick={() => serveAttendance(scanValue)} disabled={!selectedClass || serving}>
                {serving ? "Marking…" : "Mark Present"}
              </Button>
            </div>
            <Button variant="secondary" onClick={showScanner ? stopScanner : startScanner} className="w-full">
              <MaterialIcon icon={showScanner ? "videocam_off" : "qr_code_scanner"} className="mr-2" />
              {showScanner ? "Stop Scanner" : "Open Camera Scanner"}
            </Button>
            {showScanner && (
              <div id="attendance-scan-region" className="overflow-hidden rounded-xl border border-[var(--border)]" />
            )}
            {scannerError && <p className="text-sm text-red-600">{scannerError}</p>}
            {marked.size > 0 && (
              <p className="text-sm font-semibold text-[var(--green)]">{marked.size} marked present</p>
            )}
          </div>
        </Card>

        {recent.length > 0 && (
          <Card>
            <div className="p-4">
              <h3 className="mb-2 text-sm font-semibold text-[var(--t1)]">Recent</h3>
              <ul className="divide-y divide-[var(--border)]">
                {recent.map((r, i) => (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-[var(--t1)]">{r.name}</span>
                    <span className="text-xs text-[var(--t3)]">{r.time}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}
      </div>
    </PageErrorBoundary>
  );
}
