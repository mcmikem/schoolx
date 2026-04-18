"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";

type Vehicle = {
  id: string;
  plate: string;
  type: string;
  driver: string;
  driver_phone?: string;
  route: string;
  capacity: number;
  filled: number;
  status: "active" | "maintenance" | "inactive";
};

export default function TransportPage() {
  const { school } = useAuth();
  const toast = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    plate: "", type: "Bus", driver: "", driver_phone: "",
    route: "", capacity: "50", filled: "0", status: "active" as Vehicle["status"],
  });

  const fetchVehicles = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("school_id", school.id)
      .order("plate");
    if (error) toast.error("Failed to load vehicles");
    else setVehicles(data || []);
    setLoading(false);
  }, [school?.id, toast]);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const saveVehicle = async () => {
    if (!form.plate || !school?.id) return;
    setSaving(true);
    const { error } = await supabase.from("vehicles").insert({
      school_id: school.id,
      plate: form.plate.toUpperCase(),
      type: form.type,
      driver: form.driver,
      driver_phone: form.driver_phone || null,
      route: form.route,
      capacity: parseInt(form.capacity) || 50,
      filled: parseInt(form.filled) || 0,
      status: form.status,
    });
    if (error) toast.error("Failed to save vehicle: " + error.message);
    else {
      toast.success("Vehicle registered successfully");
      setShowAdd(false);
      setForm({ plate: "", type: "Bus", driver: "", driver_phone: "", route: "", capacity: "50", filled: "0", status: "active" });
      fetchVehicles();
    }
    setSaving(false);
  };

  const activeCount = vehicles.filter((v) => v.status === "active").length;
  const totalCapacity = vehicles.reduce((s, v) => s + v.capacity, 0);
  const totalFilled = vehicles.reduce((s, v) => s + v.filled, 0);

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Transport Management"
        subtitle="School vehicles, routes, and drivers"
        actions={
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-[var(--on-primary)] rounded-2xl font-bold shadow-lg hover:scale-105 transition-all">
            <MaterialIcon icon="add" /> Add Vehicle
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Vehicles", value: vehicles.length, icon: "directions_bus", color: "bg-blue-600" },
          { label: "Active Vehicles", value: activeCount, icon: "check_circle", color: "bg-emerald-500" },
          { label: "Total Capacity", value: totalCapacity, icon: "people", color: "bg-indigo-500" },
          { label: "Students Enrolled", value: totalFilled, icon: "school", color: "bg-amber-500" },
        ].map((s) => (
          <div key={s.label} className="p-5 bg-white rounded-3xl border border-slate-100 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${s.color} text-white flex items-center justify-center shrink-0`}><MaterialIcon icon={s.icon} /></div>
            <div>
              <p className="text-2xl font-black text-slate-800">{s.value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className={cardClassName + " overflow-hidden"}>
        <div className="p-5 border-b border-slate-50 bg-slate-50/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fleet Overview</p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 font-medium">Loading vehicles…</div>
        ) : vehicles.length === 0 ? (
          <div className="p-12 text-center">
            <MaterialIcon icon="directions_bus" className="text-5xl text-slate-200 mb-3" />
            <p className="font-bold text-slate-400">No vehicles registered</p>
            <p className="text-sm text-slate-300 mt-1">Add your first vehicle to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-50">
                  {["Plate / Type","Driver","Route","Occupancy","Status"].map((h) => (
                    <th key={h} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800">{v.plate}</p>
                      <p className="text-[10px] font-medium text-slate-400">{v.type}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-600">{v.driver}</p>
                      {v.driver_phone && <p className="text-[10px] text-slate-400">{v.driver_phone}</p>}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-600">{v.route}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0 w-24">
                          <div className={`h-full ${v.filled === v.capacity ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, (v.filled / v.capacity) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-slate-500">{v.filled}/{v.capacity}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${v.status === "active" ? "bg-emerald-50 text-emerald-700" : v.status === "maintenance" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-8 space-y-5">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-800">Add Vehicle</h2>
                <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-slate-100 rounded-xl"><MaterialIcon icon="close" className="text-slate-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Plate Number</label>
                  <input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} placeholder="e.g. UAB 123X" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none uppercase" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none">
                    <option>Bus</option><option>Mini-bus</option><option>Van</option><option>Car</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Driver Name</label>
                  <input value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })} placeholder="Full name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Driver Phone</label>
                  <input value={form.driver_phone} onChange={(e) => setForm({ ...form, driver_phone: e.target.value })} placeholder="07XXXXXXXX" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Route</label>
                <input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} placeholder="e.g. Kampala - Entebbe Road" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Capacity</label>
                  <input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Students Enrolled</label>
                  <input type="number" min="0" value={form.filled} onChange={(e) => setForm({ ...form, filled: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                </div>
              </div>
              <button onClick={saveVehicle} disabled={!form.plate || saving} className="w-full py-4 bg-[var(--primary)] text-[var(--on-primary)] rounded-[28px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><MaterialIcon icon="save" /> Save Vehicle</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
