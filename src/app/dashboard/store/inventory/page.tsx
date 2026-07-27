"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { useAssets, useInventory } from "@/lib/hooks";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import type { Asset } from "@/types";
import Link from "next/link";

type AssetCategory = Asset["category"];

type AssetFormState = {
  name: string;
  category: AssetCategory;
  location: string;
  condition: Asset["condition"];
  current_stock: string;
  min_stock_level: string;
  unit_price: string;
  supplier: string;
  serial_number: string;
  purchased_date: string;
  description: string;
  is_consumable: boolean;
};

const DEFAULT_ASSET_FORM: AssetFormState = {
  name: "",
  category: "equipment",
  location: "",
  condition: "good",
  current_stock: "1",
  min_stock_level: "2",
  unit_price: "",
  supplier: "",
  serial_number: "",
  purchased_date: "",
  description: "",
  is_consumable: false,
};

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  furniture: "Furniture",
  electronics: "Electronics",
  textbooks: "Textbooks",
  equipment: "Equipment",
  vehicle: "Vehicle",
  building: "Building",
  other: "Other",
};

const CONDITION_BADGES: Record<Asset["condition"], string> = {
  new: "bg-emerald-100 text-emerald-700",
  good: "bg-sky-100 text-sky-700",
  fair: "bg-amber-100 text-amber-700",
  poor: "bg-orange-100 text-orange-700",
  damaged: "bg-rose-100 text-rose-700",
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as AssetCategory[];

function asAssetCategory(value: unknown): AssetCategory {
  return ALL_CATEGORIES.includes(value as AssetCategory) ? (value as AssetCategory) : "other";
}

function asAssetCondition(value: unknown): Asset["condition"] {
  const condition = value as Asset["condition"];
  return ["new", "good", "fair", "poor", "damaged"].includes(condition) ? condition : "good";
}

export default function InventoryPage() {
  const { school, user } = useAuth();
  const toast = useToast();
  const { assets, loading: loadingAssets, createAsset } = useAssets(school?.id);
  const {
    transactions,
    loading: loadingTransactions,
    recordTransaction,
    refetch: refetchTransactions,
  } = useInventory(school?.id);

  const [activeTab, setActiveTab] = useState("assets");
  const [assetSearch, setAssetSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | AssetCategory>("all");
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<"in" | "out">("out");
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetForm, setAssetForm] = useState<AssetFormState>(DEFAULT_ASSET_FORM);
  const [savingAsset, setSavingAsset] = useState(false);
  const [savingTransaction, setSavingTransaction] = useState(false);

  const allAssets = useMemo(() => assets || [], [assets]);

  const fixedAssets = useMemo(() => allAssets.filter((asset) => !asset.is_consumable), [allAssets]);

  const consumables = useMemo(() => allAssets.filter((asset) => asset.is_consumable), [allAssets]);

  const filteredAssets = useMemo(() => {
    const search = assetSearch.trim().toLowerCase();
    return allAssets.filter((asset) => {
      if (categoryFilter !== "all" && asset.category !== categoryFilter) return false;
      if (!search) return true;
      return (
        asset.name.toLowerCase().includes(search) ||
        String(asset.location || "")
          .toLowerCase()
          .includes(search) ||
        String(asset.supplier || "")
          .toLowerCase()
          .includes(search)
      );
    });
  }, [allAssets, assetSearch, categoryFilter]);

  const lowStockConsumables = useMemo(
    () => consumables.filter((asset) => Number(asset.current_stock || 0) <= Number(asset.min_stock_level || 0)),
    [consumables],
  );

  const needsMaintenance = useMemo(
    () => fixedAssets.filter((asset) => asset.condition === "poor" || asset.condition === "damaged"),
    [fixedAssets],
  );

  const estimatedAssetValue = useMemo(
    () =>
      allAssets.reduce((sum, asset) => {
        const unitPrice = Number(asset.unit_price || 0);
        const quantity = Number(asset.current_stock || 0);
        return sum + unitPrice * quantity;
      }, 0),
    [allAssets],
  );

  const tabs = [
    { id: "assets", label: "Asset Register", count: fixedAssets.length },
    { id: "consumables", label: "Consumables", count: consumables.length },
    { id: "activity", label: "Movement Log", count: transactions.length },
  ];

  const loading = loadingAssets || loadingTransactions;

  const openTransactionModal = (asset: Asset, type: "in" | "out") => {
    setSelectedAsset(asset);
    setTransactionType(type);
    setShowTransactionModal(true);
  };

  const handleCreateAsset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!school?.id || !user?.id) {
      toast.error("School or user session missing");
      return;
    }

    if (!assetForm.name.trim()) {
      toast.error("Asset name is required");
      return;
    }

    const openingStock = Number(assetForm.current_stock || 0);
    const minStock = Number(assetForm.min_stock_level || 0);

    if (openingStock < 0 || minStock < 0) {
      toast.error("Stock values cannot be negative");
      return;
    }

    setSavingAsset(true);
    try {
      await createAsset({
        name: assetForm.name.trim(),
        category: assetForm.category,
        location: assetForm.location.trim() || null,
        condition: assetForm.condition,
        current_stock: openingStock,
        min_stock_level: assetForm.is_consumable ? minStock : 0,
        unit_price: Number(assetForm.unit_price || 0) || null,
        supplier: assetForm.supplier.trim() || null,
        serial_number: assetForm.serial_number.trim() || null,
        purchased_date: assetForm.purchased_date || null,
        description: assetForm.description.trim() || null,
        is_consumable: assetForm.is_consumable,
      });

      toast.success("Asset registered successfully");
      setAssetForm(DEFAULT_ASSET_FORM);
      setShowAssetModal(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to register asset");
    } finally {
      setSavingAsset(false);
    }
  };

  const handleTransactionSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAsset || !school?.id || !user?.id) return;

    const formData = new FormData(event.currentTarget);
    const quantity = Number(formData.get("quantity") || 0);

    if (quantity < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }

    setSavingTransaction(true);
    try {
      const result = await recordTransaction({
        school_id: school.id,
        asset_id: selectedAsset.id,
        transaction_type: transactionType,
        quantity,
        notes: String(formData.get("notes") || ""),
        transaction_date: new Date().toISOString().split("T")[0],
        recorded_by: user.id,
      });

      if (!result.success) {
        toast.error(result.error || "Transaction failed");
        return;
      }

      toast.success(
        transactionType === "in"
          ? `Stock received for ${selectedAsset.name}`
          : `${selectedAsset.name} issued from stock`,
      );
      setShowTransactionModal(false);
      if (typeof refetchTransactions === "function") {
        await refetchTransactions();
      }
    } finally {
      setSavingTransaction(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <PageHeader
          title="School Asset Inventory"
          subtitle="Register fixed assets, manage consumables, and track stock movements"
        />
        <TableSkeleton rows={6} />
      </div>
    );
  }

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="School Asset Inventory"
          subtitle="Asset register for classrooms, labs, offices, and infrastructure. Canteen snacks should be managed in POS/Canteen modules."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/dashboard/canteen"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--t2)] hover:bg-[var(--surface-container)]"
              >
                <MaterialIcon icon="storefront" className="text-base" />
                Open Canteen
              </Link>
              <Button icon={<MaterialIcon icon="add" />} onClick={() => setShowAssetModal(true)}>
                Register Asset
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card>
            <CardBody>
              <p className="text-xs uppercase tracking-widest text-[var(--t3)]">Registered Assets</p>
              <p className="text-2xl font-bold text-[var(--t1)] mt-1">{allAssets.length}</p>
              <p className="text-xs text-[var(--t3)] mt-1">
                {fixedAssets.length} fixed, {consumables.length} consumables
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs uppercase tracking-widest text-[var(--t3)]">Estimated Value</p>
              <p className="text-2xl font-bold text-[var(--t1)] mt-1">UGX {estimatedAssetValue.toLocaleString()}</p>
              <p className="text-xs text-[var(--t3)] mt-1">Based on unit price and stock</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs uppercase tracking-widest text-[var(--t3)]">Low Stock Consumables</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{lowStockConsumables.length}</p>
              <p className="text-xs text-[var(--t3)] mt-1">Need restock now</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs uppercase tracking-widest text-[var(--t3)]">Needs Maintenance</p>
              <p className="text-2xl font-bold text-rose-700 mt-1">{needsMaintenance.length}</p>
              <p className="text-xs text-[var(--t3)] mt-1">Poor or damaged condition</p>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardBody>
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <input
                value={assetSearch}
                onChange={(event) => setAssetSearch(event.target.value)}
                placeholder="Search by asset name, location, or supplier"
                className="w-full lg:max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCategoryFilter("all")}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                    categoryFilter === "all"
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--surface-container)] text-[var(--t2)]"
                  }`}
                >
                  All Categories
                </button>
                {ALL_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() => setCategoryFilter(category)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                      categoryFilter === category
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--surface-container)] text-[var(--t2)]"
                    }`}
                  >
                    {CATEGORY_LABELS[category]}
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <TabPanel activeTab={activeTab} tabId="assets">
          <Card>
            {filteredAssets.filter((asset) => !asset.is_consumable).length === 0 ? (
              <EmptyState
                icon="inventory_2"
                title="No fixed assets yet"
                description="Register school property such as desks, laptops, projectors, generators, and lab equipment."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--t3)] text-xs uppercase tracking-wider">
                      <th className="py-3 px-4">Asset</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Condition</th>
                      <th className="py-3 px-4">Units</th>
                      <th className="py-3 px-4">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredAssets
                      .filter((asset) => !asset.is_consumable)
                      .map((asset) => {
                        const units = Number(asset.current_stock || 0);
                        const value = Number(asset.unit_price || 0) * units;
                        const category = asAssetCategory(asset.category);
                        const condition = asAssetCondition(asset.condition);
                        return (
                          <tr key={asset.id} className="hover:bg-[var(--surface-container)]">
                            <td className="py-3 px-4">
                              <p className="font-semibold text-[var(--t1)]">{asset.name}</p>
                              <p className="text-xs text-[var(--t3)]">{asset.serial_number || "No serial"}</p>
                            </td>
                            <td className="py-3 px-4 text-sm text-[var(--t2)]">{CATEGORY_LABELS[category]}</td>
                            <td className="py-3 px-4 text-sm text-[var(--t2)]">{asset.location || "Not set"}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`text-xs px-2 py-1 rounded-full font-semibold ${CONDITION_BADGES[condition]}`}
                              >
                                {condition}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-[var(--t1)]">{units}</td>
                            <td className="py-3 px-4 font-semibold text-[var(--t1)]">UGX {value.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabPanel>

        <TabPanel activeTab={activeTab} tabId="consumables">
          <Card>
            {filteredAssets.filter((asset) => asset.is_consumable).length === 0 ? (
              <EmptyState
                icon="inventory"
                title="No consumables found"
                description="Consumables include printer toner, lab chemicals, cleaning supplies, and stationery."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--t3)] text-xs uppercase tracking-wider">
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Stock</th>
                      <th className="py-3 px-4">Min Level</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredAssets
                      .filter((asset) => asset.is_consumable)
                      .map((asset) => {
                        const stock = Number(asset.current_stock || 0);
                        const lowStock = stock <= Number(asset.min_stock_level || 0);
                        const category = asAssetCategory(asset.category);
                        return (
                          <tr key={asset.id} className="hover:bg-[var(--surface-container)]">
                            <td className="py-3 px-4">
                              <p className="font-semibold text-[var(--t1)]">{asset.name}</p>
                              <p className="text-xs text-[var(--t3)]">{CATEGORY_LABELS[category]}</p>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-1 rounded-lg text-xs font-semibold ${lowStock ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}
                              >
                                {stock}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-[var(--t2)]">{asset.min_stock_level || 0}</td>
                            <td className="py-3 px-4 text-sm text-[var(--t2)]">{asset.location || "Store"}</td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex gap-2">
                                <button
                                  onClick={() => openTransactionModal(asset, "in")}
                                  className="p-2 rounded-lg bg-emerald-100 text-emerald-700 hover:opacity-80"
                                  title="Receive stock"
                                >
                                  <MaterialIcon icon="add" className="text-base" />
                                </button>
                                <button
                                  onClick={() => openTransactionModal(asset, "out")}
                                  className="p-2 rounded-lg bg-rose-100 text-rose-700 hover:opacity-80"
                                  title="Issue stock"
                                >
                                  <MaterialIcon icon="remove" className="text-base" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabPanel>

        <TabPanel activeTab={activeTab} tabId="activity">
          <Card>
            {transactions.length === 0 ? (
              <EmptyState icon="history" title="No movement history" description="Stock movements will appear here." />
            ) : (
              <div className="space-y-3 p-4">
                {transactions.slice(0, 30).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-container)] p-3"
                  >
                    <div
                      className={`p-2 rounded-lg ${tx.transaction_type === "in" || tx.transaction_type === "return" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                    >
                      <MaterialIcon
                        icon={tx.transaction_type === "in" || tx.transaction_type === "return" ? "south" : "north"}
                        className="text-base"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[var(--t1)]">{tx.asset?.name || "Asset"}</p>
                      <p className="text-xs text-[var(--t3)] uppercase tracking-wider">
                        {tx.transaction_type} · {tx.quantity} units
                      </p>
                    </div>
                    <p className="text-xs text-[var(--t3)]">{new Date(tx.transaction_date).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabPanel>

        {showAssetModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
            <Card className="w-full max-w-2xl max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--t1)]">Register School Asset</h2>
                    <p className="text-xs text-[var(--t3)] uppercase tracking-wider">
                      For property and resource management
                    </p>
                  </div>
                  <button onClick={() => setShowAssetModal(false)} className="text-[var(--t3)] hover:text-[var(--t1)]">
                    <MaterialIcon icon="close" />
                  </button>
                </div>
              </CardHeader>
              <CardBody>
                <form onSubmit={handleCreateAsset} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-[var(--t1)]">Asset Name</label>
                      <input
                        value={assetForm.name}
                        onChange={(event) => setAssetForm((prev) => ({ ...prev, name: event.target.value }))}
                        required
                        className="mt-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 bg-[var(--surface)]"
                        placeholder="e.g. Dell Desktop Computers"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-[var(--t1)]">Category</label>
                      <select
                        value={assetForm.category}
                        onChange={(event) =>
                          setAssetForm((prev) => ({ ...prev, category: event.target.value as AssetCategory }))
                        }
                        className="mt-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 bg-[var(--surface)]"
                      >
                        {ALL_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {CATEGORY_LABELS[category]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-[var(--t1)]">Condition</label>
                      <select
                        value={assetForm.condition}
                        onChange={(event) =>
                          setAssetForm((prev) => ({ ...prev, condition: event.target.value as Asset["condition"] }))
                        }
                        className="mt-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 bg-[var(--surface)]"
                      >
                        <option value="new">New</option>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="poor">Poor</option>
                        <option value="damaged">Damaged</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-[var(--t1)]">Location</label>
                      <input
                        value={assetForm.location}
                        onChange={(event) => setAssetForm((prev) => ({ ...prev, location: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 bg-[var(--surface)]"
                        placeholder="Lab 1, Library, Admin block"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-[var(--t1)]">Serial Number (optional)</label>
                      <input
                        value={assetForm.serial_number}
                        onChange={(event) => setAssetForm((prev) => ({ ...prev, serial_number: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 bg-[var(--surface)]"
                        placeholder="SN-2026-..."
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-[var(--t1)]">Opening Units</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={assetForm.current_stock}
                        onChange={(event) => setAssetForm((prev) => ({ ...prev, current_stock: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 bg-[var(--surface)]"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-[var(--t1)]">Unit Price (UGX)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={assetForm.unit_price}
                        onChange={(event) => setAssetForm((prev) => ({ ...prev, unit_price: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 bg-[var(--surface)]"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-[var(--t1)]">Supplier (optional)</label>
                      <input
                        value={assetForm.supplier}
                        onChange={(event) => setAssetForm((prev) => ({ ...prev, supplier: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 bg-[var(--surface)]"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-[var(--t1)]">Purchase Date</label>
                      <input
                        type="date"
                        value={assetForm.purchased_date}
                        onChange={(event) => setAssetForm((prev) => ({ ...prev, purchased_date: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 bg-[var(--surface)]"
                      />
                    </div>

                    <div className="md:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--surface-container)] p-3">
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--t1)]">
                        <input
                          type="checkbox"
                          checked={assetForm.is_consumable}
                          onChange={(event) =>
                            setAssetForm((prev) => ({ ...prev, is_consumable: event.target.checked }))
                          }
                        />
                        This item is a consumable stock item
                      </label>
                      {assetForm.is_consumable && (
                        <div className="mt-3">
                          <label className="text-sm font-medium text-[var(--t1)]">Minimum Stock Level</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={assetForm.min_stock_level}
                            onChange={(event) =>
                              setAssetForm((prev) => ({ ...prev, min_stock_level: event.target.value }))
                            }
                            className="mt-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 bg-[var(--surface)]"
                          />
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-[var(--t1)]">Description</label>
                      <textarea
                        rows={3}
                        value={assetForm.description}
                        onChange={(event) => setAssetForm((prev) => ({ ...prev, description: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 bg-[var(--surface)]"
                        placeholder="Usage notes, warranty, maintenance info..."
                      />
                    </div>
                  </div>

                  <Button type="submit" loading={savingAsset} disabled={savingAsset} className="w-full">
                    Save Asset
                  </Button>
                </form>
              </CardBody>
            </Card>
          </div>
        )}

        {showTransactionModal && selectedAsset && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
            <Card className="w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--t1)]">
                      {transactionType === "in" ? "Receive Stock" : "Issue Stock"}
                    </h2>
                    <p className="text-xs text-[var(--t3)] uppercase tracking-wider">{selectedAsset.name}</p>
                  </div>
                  <button
                    onClick={() => setShowTransactionModal(false)}
                    className="text-[var(--t3)] hover:text-[var(--t1)]"
                  >
                    <MaterialIcon icon="close" />
                  </button>
                </div>
              </CardHeader>
              <CardBody>
                <form onSubmit={handleTransactionSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--t1)]">Quantity</label>
                    <input
                      name="quantity"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      required
                      className="mt-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 bg-[var(--surface)]"
                      placeholder="Units"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--t1)]">Notes</label>
                    <textarea
                      name="notes"
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 bg-[var(--surface)]"
                      placeholder="Reason for this movement"
                    />
                  </div>
                  <Button
                    type="submit"
                    loading={savingTransaction}
                    disabled={savingTransaction}
                    variant={transactionType === "in" ? "primary" : "danger"}
                    className="w-full"
                  >
                    Confirm
                  </Button>
                </form>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </PageErrorBoundary>
  );
}
