"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";

export default function TransportPage() {
  const { school } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Demo data for vehicles
  const demoVehicles = [
    { id: "1", plate: "UBA 123A", type: "Bus (67 Seater)", driver: "John Ouma", route: "Kampala - Entebbe", status: "active", capacity: 67, filled: 54 },
    { id: "2", plate: "UBB 456B", type: "Coaster (28 Seater)", driver: "Peter Kigozi", route: "Kampala - Mukono", status: "active", capacity: 28, filled: 28 },
    { id: "3", plate: "UBC 789C", type: "Van (14 Seater)", driver: "Sam Musoke", route: "Kampala - Wakiso", status: "maintenance", capacity: 14, filled: 0 },
  ];

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setVehicles(demoVehicles);
      setLoading(false);
    }, 500);
  }, [school?.id]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <MaterialIcon icon="directions_bus" />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Transport</h1>
          </div>
          <p className="text-slate-500 font-medium">Manage school fleet, routes, and student assignments</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-3 bg-amber-500 text-white rounded-2xl font-bold hover:scale-105 transition-all shadow-lg shadow-amber-500/20">
          <MaterialIcon icon="add" /> Add Vehicle
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Fleet", value: vehicles.length, icon: "airport_shuttle", color: "bg-slate-700" },
          { label: "Active Routes", value: vehicles.filter(v => v.status === "active").length, icon: "route", color: "bg-emerald-500" },
          { label: "Total Capacity", value: vehicles.reduce((acc, v) => acc + v.capacity, 0), icon: "groups", color: "bg-blue-500" },
          { label: "In Maintenance", value: vehicles.filter(v => v.status === "maintenance").length, icon: "build", color: "bg-amber-500" },
        ].map((s) => (
          <div key={s.label} className="p-5 bg-white rounded-3xl border border-slate-100 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${s.color} text-white flex items-center justify-center shrink-0`}>
              <MaterialIcon icon={s.icon} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">{s.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className={cardClassName + " overflow-hidden"}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Vehicle</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Driver</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Route</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Occupancy</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 bg-slate-100 rounded-full animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{v.plate}</p>
                        <p className="text-[10px] font-medium text-slate-400">{v.type}</p>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">{v.driver}</td>
                      <td className="px-6 py-4 font-medium text-slate-600">{v.route}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0 w-24">
                             <div className={`h-full ${v.filled === v.capacity ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${(v.filled / v.capacity) * 100}%` }} />
                           </div>
                           <span className="text-[10px] font-black text-slate-500">{v.filled}/{v.capacity}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${v.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                           {v.status}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-slate-300 hover:text-amber-500 transition-colors">
                          <MaterialIcon icon="edit" style={{ fontSize: 20 }} />
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
