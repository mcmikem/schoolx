"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";

type Asset = {
  id: string;
  name: string;
  category: string;
  location: string;
  quantity: number;
  condition: "Good" | "Fair" | "Requires Maintenance" | "Condemned";
  purchase_date?: string;
  notes?: string;
};

const CONDITION_BADGE: Record<string, string> = {
  Good: "bg-emerald-50 text-emerald-700",
  Fair: "bg-amber-50 text-amber-700",
  "Requires Maintenance": "bg-red-50 text-red-700",
  Condemned: "bg-slate-100 text-slate-500",
};

const CATEGORIES = [
  "All",
  "Electronics",
  "Furniture",
  "Equipment",
  "Vehicles",
  "Books",
  "Sports",
  "Other",
];

export default function AssetsPage() {
  const { school } = useAuth();
  const toast = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [filterCategory, setFilterCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "Electronics",
    location: "",
    quantity: "1",
    condition: "Good" as Asset["condition"],
    purchase_date: "",
    notes: "",
  });

  const fetchAssets = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .eq("school_id", school.id)
      .order("name");
    if (error) toast.error("Failed to load assets");
    else setAssets(data || []);
    setLoading(false);
  }, [school?.id]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const saveAsset = async () => {
    if (!form.name || !school?.id) return;
    setSaving(true);
    const { error } = await supabase.from("assets").insert({
      school_id: school.id,
      name: form.name,
      category: form.category,
      location: form.location,
      quantity: parseInt(form.quantity) || 1,
      condition: form.condition,
      purchase_date: form.purchase_date || null,
      notes: form.notes || null,
    });
    if (error) toast.error("Failed to save asset: " + error.message);
    else {
      toast.success("Asset registered successfully");
      setShowAdd(false);
      setForm({
        name: "",
        category: "Electronics",
        location: "",
        quantity: "1",
        condition: "Good",
        purchase_date: "",
        notes: "",
      });
      fetchAssets();
    }
    setSaving(false);
  };

  const filtered = assets.filter((a) => {
    const matchCat = filterCategory === "All" || a.category === filterCategory;
    const matchSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.location.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Assets & Inventory"
        subtitle="Track school property and equipment"
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-[var(--on-primary)] rounded-2xl font-bold shadow-lg hover:scale-105 transition-all"
          >
            <MaterialIcon icon="add" /> Register Asset
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Total Items",
            value: assets.length,
            icon: "inventory_2",
            color: "bg-blue-600",
          },
          {
            label: "Total Units",
            value: assets.reduce((s, a) => s + a.quantity, 0).toLocaleString(),
            icon: "widgets",
            color: "bg-indigo-500",
          },
          {
            label: "Need Maintenance",
            value: assets.filter((a) => a.condition === "Requires Maintenance")
              .length,
            icon: "build",
            color: "bg-amber-500",
          },
          {
            label: "Categories",
            value: Array.from(new Set(assets.map((a) => a.category))).length,
            icon: "category",
            color: "bg-emerald-500",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="p-5 bg-white rounded-3xl border border-slate-100 flex items-center gap-4"
          >
            <div
              className={`w-12 h-12 rounded-2xl ${s.color} text-white flex items-center justify-center shrink-0`}
            >
              <MaterialIcon icon={s.icon} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">{s.value}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets..."
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none w-56"
        />
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCategory(c)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${filterCategory === c ? "bg-[var(--primary)] text-[var(--on-primary)]" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className={cardClassName + " overflow-hidden"}>
        <div className="p-5 border-b border-slate-50 bg-slate-50/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {filtered.length} items
          </p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 font-medium">
            Loading assets…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <MaterialIcon
              icon="inventory_2"
              className="text-5xl text-slate-200 mb-3"
            />
            <p className="font-bold text-slate-400">No assets found</p>
            <p className="text-sm text-slate-300 mt-1">
              Register your first asset to get started
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-50">
                  {[
                    "Asset Name",
                    "Category",
                    "Location",
                    "Qty",
                    "Condition",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-bold text-slate-800 text-sm">
                      {a.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {a.category}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {a.location}
                    </td>
                    <td className="px-6 py-4 font-black text-slate-800">
                      {a.quantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${CONDITION_BADGE[a.condition] || "bg-slate-100 text-slate-500"}`}
                      >
                        {a.condition}
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
                <h2 className="text-2xl font-black text-slate-800">
                  Register Asset
                </h2>
                <button
                  onClick={() => setShowAdd(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl"
                >
                  <MaterialIcon icon="close" className="text-slate-400" />
                </button>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  Asset Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Dell Optiplex Computers"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                  >
                    {CATEGORIES.slice(1).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm({ ...form, quantity: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Location
                  </label>
                  <input
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    placeholder="e.g. Computer Lab 1"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                    Condition
                  </label>
                  <select
                    value={form.condition}
                    onChange={(e) =>
                      setForm({ ...form, condition: e.target.value as any })
                    }
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none"
                  >
                    <option>Good</option>
                    <option>Fair</option>
                    <option>Requires Maintenance</option>
                    <option>Condemned</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Any additional notes..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none resize-none"
                />
              </div>
              <button
                onClick={saveAsset}
                disabled={!form.name || saving}
                className="w-full py-4 bg-[var(--primary)] text-[var(--on-primary)] rounded-[28px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <MaterialIcon icon="save" /> Save Asset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
