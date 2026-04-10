"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";

export default function AssetsPage() {
  const { school } = useAuth();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Demo Data
  const demoAssets = [
    { id: "A001", name: "Dell Optiplex 3020 Computers", category: "Electronics", location: "Computer Lab 1", quantity: 30, condition: "Good" },
    { id: "A002", name: "Student Desks (Wooden)", category: "Furniture", location: "Main Block", quantity: 450, condition: "Fair" },
    { id: "A003", name: "Epson Projector", category: "Electronics", location: "Main Hall", quantity: 2, condition: "Requires Maintenance" },
    { id: "A004", name: "Science Lab Kits", category: "Equipment", location: "Science Lab", quantity: 15, condition: "Good" },
  ];

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setAssets(demoAssets);
      setLoading(false);
    }, 500);
  }, [school?.id]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <MaterialIcon icon="inventory_2" />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Assets</h1>
          </div>
          <p className="text-slate-500 font-medium">Fixed assets, equipment, and inventory tracking</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-3 bg-orange-500 text-white rounded-2xl font-bold hover:scale-105 transition-all shadow-lg shadow-orange-500/20">
          <MaterialIcon icon="add" /> Register Asset
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Asset Types", value: assets.length, icon: "category", color: "bg-slate-700" },
          { label: "Electronics", value: assets.filter(a => a.category === "Electronics").reduce((s,a) => s+a.quantity, 0), icon: "computer", color: "bg-blue-500" },
          { label: "Furniture Count", value: assets.filter(a => a.category === "Furniture").reduce((s,a) => s+a.quantity, 0), icon: "chair", color: "bg-orange-500" },
          { label: "Needs Maintenance", value: assets.filter(a => a.condition !== "Good").length, icon: "build", color: "bg-red-500" },
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
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Asset Name</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Category</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Location</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Quantity</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Condition</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 bg-slate-100 rounded-full animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : assets.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{a.name}</p>
                        <p className="text-[10px] font-medium text-slate-400 font-mono">{a.id}</p>
                      </td>
                      <td className="px-6 py-4">
                         <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">
                           {a.category}
                         </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">{a.location}</td>
                      <td className="px-6 py-4 font-black text-slate-800 text-lg">{a.quantity}</td>
                      <td className="px-6 py-4">
                         <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${a.condition === 'Good' ? 'bg-emerald-50 text-emerald-700' : a.condition === 'Fair' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                           {a.condition}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-slate-300 hover:text-orange-500 transition-colors">
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