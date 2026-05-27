"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useToast } from "@/components/Toast";
import { Html5Qrcode } from "html5-qrcode";
import MaterialIcon from "@/components/MaterialIcon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui";

interface MealRule {
  id: string;
  meal_type: "breakfast" | "lunch" | "supper";
  is_enabled: boolean;
  eligibility: "all" | "boarding_only";
  start_time: string | null;
  end_time: string | null;
  max_servings_per_day: number;
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  supper: "Supper",
};

export default function MealScanPage() {
  const toast = useToast();
  const [rules, setRules] = useState<MealRule[]>([]);
  const [savingRules, setSavingRules] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<"breakfast" | "lunch" | "supper">("lunch");
  const [scanValue, setScanValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [serving, setServing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [recentServes, setRecentServes] = useState<Array<{ name: string; meal: string; time: string }>>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const selectedRule = rules.find((rule) => rule.meal_type === selectedMeal);

  const updateRule = (mealType: MealRule["meal_type"], patch: Partial<MealRule>) => {
    setRules((prev) => prev.map((rule) => (
      rule.meal_type === mealType
        ? { ...rule, ...patch }
        : rule
    )));
  };

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/meals/settings/");
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load meal settings");
      }
      setRules(result.data?.rules || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

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

  const serveMeal = async (value: string) => {
    if (!value.trim()) return;
    try {
      setServing(true);
      const response = await fetch("/api/meals/scan/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanValue: value.trim(),
          mealType: selectedMeal,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to serve meal");
      }

      const student = result.data?.student;
      const fullName = `${student?.first_name || ""} ${student?.last_name || ""}`.trim();
      setRecentServes((prev) => [
        {
          name: fullName || "Student",
          meal: MEAL_LABELS[selectedMeal],
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 10));

      toast.success(result.message || `${fullName} served`);
      setScanValue("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to serve meal");
    } finally {
      setServing(false);
    }
  };

  const startScanner = async () => {
    setShowScanner(true);
    setScannerError(null);
    try {
      const scanner = new Html5Qrcode("meal-scan-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decodedText: string) => {
          await stopScanner();
          await serveMeal(decodedText);
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
        // Ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setShowScanner(false);
  };

  const saveRules = async () => {
    try {
      setSavingRules(true);
      const response = await fetch("/api/meals/settings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: rules.map((rule) => ({
            meal_type: rule.meal_type,
            is_enabled: rule.is_enabled,
            eligibility: rule.eligibility,
            start_time: rule.start_time,
            end_time: rule.end_time,
            max_servings_per_day: rule.max_servings_per_day,
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save meal rules");
      }

      setRules(result.data?.rules || rules);
      toast.success(result.message || "Meal rules updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save rules");
    } finally {
      setSavingRules(false);
    }
  };

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-800">Meal Scan Terminal</h1>
            <p className="text-sm text-slate-500">One-scan-per-meal-per-day control for canteen feeding.</p>
          </div>
          <Button variant="secondary" onClick={loadRules} disabled={loading}>
            <MaterialIcon icon="refresh" className="text-sm" />
            Reload Rules
          </Button>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["breakfast", "lunch", "supper"] as const).map((meal) => {
              const rule = rules.find((r) => r.meal_type === meal);
              const active = selectedMeal === meal;
              return (
                <button
                  key={meal}
                  onClick={() => setSelectedMeal(meal)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${active ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)] bg-white"}`}
                >
                  <p className="text-sm font-bold text-slate-800">{MEAL_LABELS[meal]}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {rule?.is_enabled ? `Enabled (${rule.eligibility === "boarding_only" ? "Boarding only" : "All students"})` : "Disabled"}
                  </p>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Meal Rules</h2>
            <Button onClick={saveRules} disabled={savingRules || rules.length === 0}>
              <MaterialIcon icon="save" className="text-sm" />
              {savingRules ? "Saving..." : "Save Rules"}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-slate-800">{MEAL_LABELS[rule.meal_type]}</p>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={rule.is_enabled}
                      onChange={(e) => updateRule(rule.meal_type, { is_enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                </div>

                <label className="block text-xs font-semibold text-slate-500">Eligibility</label>
                <select
                  value={rule.eligibility}
                  onChange={(e) => updateRule(rule.meal_type, { eligibility: e.target.value as "all" | "boarding_only" })}
                  className="input"
                >
                  <option value="all">All students</option>
                  <option value="boarding_only">Boarding only</option>
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Start</label>
                    <input
                      type="time"
                      value={rule.start_time || ""}
                      onChange={(e) => updateRule(rule.meal_type, { start_time: e.target.value || null })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">End</label>
                    <input
                      type="time"
                      value={rule.end_time || ""}
                      onChange={(e) => updateRule(rule.meal_type, { end_time: e.target.value || null })}
                      className="input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Max servings/day</label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={rule.max_servings_per_day}
                    onChange={(e) => {
                      const value = Number(e.target.value || 1);
                      updateRule(rule.meal_type, { max_servings_per_day: Math.max(1, Math.min(3, value)) });
                    }}
                    className="input"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Serve by Scan</h2>
            <button
              onClick={startScanner}
              disabled={!selectedRule?.is_enabled || serving}
              className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:bg-slate-50 disabled:opacity-50"
            >
              <MaterialIcon icon="qr_code_scanner" className="text-4xl text-slate-400 mb-2" />
              <p className="font-bold text-slate-800">Scan student card for {MEAL_LABELS[selectedMeal]}</p>
              <p className="text-xs text-slate-500 mt-1">Duplicate scans for today are auto-blocked</p>
            </button>

            <div className="flex gap-2">
              <input
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && serveMeal(scanValue)}
                placeholder="Or enter student number / scanned text"
                className="input flex-1"
              />
              <Button onClick={() => serveMeal(scanValue)} disabled={!selectedRule?.is_enabled || serving}>
                Serve
              </Button>
            </div>

            {!selectedRule?.is_enabled && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                {MEAL_LABELS[selectedMeal]} is disabled in settings.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-4">Recent Serves</h2>
            {recentServes.length === 0 ? (
              <p className="text-sm text-slate-500">No scans yet for this session.</p>
            ) : (
              <div className="space-y-3">
                {recentServes.map((entry, index) => (
                  <div key={`${entry.name}-${entry.time}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{entry.name}</p>
                      <p className="text-xs text-slate-500">{entry.meal}</p>
                    </div>
                    <span className="text-xs font-medium text-slate-500">{entry.time}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {showScanner && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Scan Student Card</h3>
              <button onClick={stopScanner} className="p-2 rounded hover:bg-slate-100">
                <MaterialIcon icon="close" />
              </button>
            </div>
            <div className="p-4">
              {scannerError ? (
                <p className="text-sm text-red-600">{scannerError}</p>
              ) : (
                <div id="meal-scan-reader" className="w-full aspect-square rounded-xl overflow-hidden bg-slate-900" />
              )}
            </div>
          </div>
        </div>
      )}
    </PageErrorBoundary>
  );
}
