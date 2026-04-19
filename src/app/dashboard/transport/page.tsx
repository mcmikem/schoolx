"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { getErrorMessage } from "@/lib/validation";

type TransportRoute = {
  id: string;
  school_id: string;
  route_name: string;
  vehicle_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  pickup_points: string | null;
  monthly_fee: number | null;
  created_at: string;
  _student_count?: number;
};

export default function TransportPage() {
  const { school } = useAuth();
  const toast = useToast();
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    route_name: "",
    vehicle_number: "",
    driver_name: "",
    driver_phone: "",
    monthly_fee: "",
  });

  const fetchRoutes = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("transport_routes")
      .select("*, transport_students(id)")
      .eq("school_id", school.id)
      .order("route_name");
    if (error) toast.error("Failed to load routes");
    else {
      setRoutes(
        (data || []).map((r: any) => ({
          ...r,
          _student_count: r.transport_students?.length || 0,
        })),
      );
    }
    setLoading(false);
  }, [school?.id, toast]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const saveRoute = async () => {
    if (!form.route_name.trim() || !school?.id) {
      toast.error("Route name is required");
      return;
    }

    setSaving(true);
    try {
      const monthlyFee = form.monthly_fee ? parseFloat(form.monthly_fee) : null;
      if (form.monthly_fee && (isNaN(monthlyFee!) || monthlyFee! < 0)) {
        throw new Error("Monthly fee must be a valid positive number");
      }

      const { error } = await supabase.from("transport_routes").insert({
        school_id: school.id,
        route_name: form.route_name.trim(),
        vehicle_number: form.vehicle_number.trim() || null,
        driver_name: form.driver_name.trim() || null,
        driver_phone: form.driver_phone.trim() || null,
        monthly_fee: monthlyFee,
      });
      if (error) throw error;

      toast.success("Route added successfully");
      setShowAdd(false);
      setForm({ route_name: "", vehicle_number: "", driver_name: "", driver_phone: "", monthly_fee: "" });
      fetchRoutes();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to save route"));
    } finally {
      setSaving(false);
    }
  };

  const totalStudents = routes.reduce((s, r) => s + (r._student_count || 0), 0);

  return (
    <PageErrorBoundary>
      <div className="content">
        <PageHeader
          title="Transport Management"
          subtitle="School routes, vehicles, and drivers"
          actions={
            <button onClick={() => setShowAdd(true)} className="btn btn-primary text-sm">
              <MaterialIcon icon="add" style={{ fontSize: 18 }} /> Add Route
            </button>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {[
            { label: "Routes", value: routes.length, icon: "route", color: "var(--navy)" },
            { label: "Students Enrolled", value: totalStudents, icon: "school", color: "var(--green)" },
            { label: "Vehicles", value: routes.filter((r) => r.vehicle_number).length, icon: "directions_bus", color: "var(--amber)" },
          ].map((s) => (
            <div key={s.label} className="card !p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${s.color} 12%, transparent)`, color: s.color }}>
                <MaterialIcon icon={s.icon} style={{ fontSize: 20 }} />
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--t1)]">{s.value}</p>
                <p className="text-[10px] font-medium text-[var(--t3)] uppercase tracking-wider">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Routes</div>
              <div className="card-sub">{routes.length} routes configured</div>
            </div>
          </div>
          {loading ? (
            <div className="p-8 text-center text-[var(--t3)]">Loading routes…</div>
          ) : routes.length === 0 ? (
            <div className="p-12 text-center">
              <MaterialIcon icon="directions_bus" className="text-4xl text-[var(--t3)] opacity-30 mb-2" />
              <p className="font-bold text-[var(--t2)] text-sm">No routes registered</p>
              <p className="text-xs text-[var(--t3)] mt-1">Add your first route to get started</p>
            </div>
          ) : (
            <div className="card-body overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {["Route", "Vehicle", "Driver", "Students", "Monthly Fee"].map((h) => (
                      <th key={h} className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--t3)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {routes.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--surface)]">
                      <td className="px-4 py-3 font-medium text-[var(--t1)]">{r.route_name}</td>
                      <td className="px-4 py-3 text-[var(--t2)]">{r.vehicle_number || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-[var(--t2)]">{r.driver_name || "—"}</span>
                        {r.driver_phone && <span className="text-[10px] text-[var(--t3)] ml-2">{r.driver_phone}</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--t1)]">{r._student_count || 0}</td>
                      <td className="px-4 py-3 text-[var(--t2)]">
                        {r.monthly_fee ? `UGX ${Number(r.monthly_fee).toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showAdd && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--surface)] rounded-2xl w-full max-w-lg shadow-xl">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold text-[var(--t1)]">Add Route</h2>
                  <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-[var(--bg)] rounded-lg">
                    <MaterialIcon icon="close" className="text-[var(--t3)]" />
                  </button>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--t2)] block mb-1">Route Name *</label>
                  <input value={form.route_name} onChange={(e) => setForm({ ...form, route_name: e.target.value })} placeholder="e.g. Kampala – Entebbe Road" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--t2)] block mb-1">Vehicle Number</label>
                    <input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} placeholder="e.g. UAB 123X" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm outline-none uppercase" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--t2)] block mb-1">Monthly Fee (UGX)</label>
                    <input type="number" min="0" value={form.monthly_fee} onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })} placeholder="e.g. 150000" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--t2)] block mb-1">Driver Name</label>
                    <input value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} placeholder="Full name" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--t2)] block mb-1">Driver Phone</label>
                    <input value={form.driver_phone} onChange={(e) => setForm({ ...form, driver_phone: e.target.value })} placeholder="07XXXXXXXX" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm outline-none" />
                  </div>
                </div>
                <button onClick={saveRoute} disabled={!form.route_name || saving} className="btn btn-primary w-full">
                  {saving ? "Saving…" : "Save Route"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageErrorBoundary>
  );
}
