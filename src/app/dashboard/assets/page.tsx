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
  }, [school?.id, toast]);

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
        variant="premium"
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-full border border-transparent bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] shadow-[0_10px_22px_rgba(0,92,230,0.24)] transition hover:brightness-110"
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
            className="flex items-center gap-4 rounded-[24px] border border-[var(--border)] bg-white p-5 shadow-[var(--sh1)]"
          >
            <div
              className={`w-12 h-12 rounded-2xl ${s.color} text-white flex items-center justify-center shrink-0`}
            >
              <MaterialIcon icon={s.icon} />
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-[-0.03em] text-[var(--on-surface)]">{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
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
          className="input w-56"
        />
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCategory(c)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-all ${filterCategory === c ? "border-transparent bg-[var(--primary)] text-[var(--on-primary)] shadow-[0_10px_20px_rgba(0,92,230,0.18)]" : "border-[var(--border)] bg-white text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)]"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className={cardClassName + " overflow-hidden"}>
        <div className="border-b border-[var(--border)] bg-[var(--surface-container-low)] p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
            {filtered.length} items
          </p>
        </div>
        {loading ? (
          <div className="p-8 text-center font-medium text-[var(--on-surface-variant)]">
            Loading assets…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <MaterialIcon
              icon="inventory_2"
              className="mb-3 text-5xl text-[var(--outline)]"
            />
            <p className="font-semibold text-[var(--on-surface-variant)]">No assets found</p>
            <p className="mt-1 text-sm text-[var(--outline)]">
              Register your first asset to get started
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-container-low)]">
                  {[
                    "Asset Name",
                    "Category",
                    "Location",
                    "Qty",
                    "Condition",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/60">
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="transition-colors hover:bg-[var(--surface-container-low)]/70"
                  >
                    <td className="px-6 py-4 text-sm font-semibold text-[var(--on-surface)]">
                      {a.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--on-surface-variant)]">
                      {a.category}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--on-surface-variant)]">
                      {a.location}
                    </td>
                    <td className="px-6 py-4 font-semibold text-[var(--on-surface)]">
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
          <div className="w-full max-w-lg overflow-hidden rounded-[34px] border border-white/70 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
            <div className="p-8 space-y-5">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--on-surface)]">
                  Register Asset
                </h2>
                <button
                  onClick={() => setShowAdd(false)}
                  className="rounded-xl p-2 hover:bg-[var(--surface-container-low)]"
                >
                  <MaterialIcon icon="close" className="text-[var(--on-surface-variant)]" />
                </button>
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                  Asset Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Dell Optiplex Computers"
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    className="select w-full"
                  >
                    {CATEGORIES.slice(1).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm({ ...form, quantity: e.target.value })
                    }
                    className="input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                    Location
                  </label>
                  <input
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    placeholder="e.g. Computer Lab 1"
                    className="input"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                    Condition
                  </label>
                  <select
                    value={form.condition}
                    onChange={(e) =>
                      setForm({ ...form, condition: e.target.value as any })
                    }
                    className="select w-full"
                  >
                    <option>Good</option>
                    <option>Fair</option>
                    <option>Requires Maintenance</option>
                    <option>Condemned</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[var(--on-surface-variant)]">
                  Notes (optional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Any additional notes..."
                  className="input resize-none"
                />
              </div>
              <button
                onClick={saveAsset}
                disabled={!form.name || saving}
                className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-[var(--primary)] py-3.5 text-sm font-semibold text-[var(--on-primary)] transition hover:brightness-110 disabled:opacity-50"
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
