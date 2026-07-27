"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useOfflineCanteenItems, useOfflineCanteenOrders } from "@/lib/offline-hooks";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

interface CanteenItem {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  is_active: boolean;
}

interface Order {
  id: string;
  student_id: string;
  items: { item_id: string; quantity: number; price: number }[];
  total: number;
  status: "pending" | "preparing" | "ready" | "completed";
  created_at: string;
  student_name?: string;
}

export default function CanteenPage() {
  const { school, isDemo } = useAuth();
  const toast = useToast();

  // Offline-aware canteen items and orders
  const {
    data: items = [],
    loading: itemsLoading,
    error: itemsError,
    refetch: refetchItems,
  } = useOfflineCanteenItems(school?.id);

  const {
    data: orders = [],
    loading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useOfflineCanteenOrders(school?.id);

  const loading = itemsLoading || ordersLoading;
  const [activeTab, setActiveTab] = useState<"orders" | "inventory">("orders");
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "food",
    price: "",
    stock: "",
    unit: "pieces",
  });
  const parsedPrice = parseFloat(newItem.price);
  const canteenValidationError =
    !school?.id || !newItem.name.trim() || !newItem.price
      ? "Add item name and price to continue."
      : Number.isNaN(parsedPrice) || parsedPrice < 0
        ? "Price must be a valid positive number."
        : "";

  // Offline hooks handle data loading; no need for loadData or useEffect

  const handleAddItem = async () => {
    if (!school?.id) {
      toast.error("School not found");
      return;
    }
    if (canteenValidationError) {
      toast.error(canteenValidationError);
      return;
    }

    try {
      const { error } = await supabase.from("canteen_items").insert({
        school_id: school.id,
        name: newItem.name,
        category: newItem.category,
        price: parsedPrice,
        stock: parseInt(newItem.stock) || 0,
        unit: newItem.unit,
        is_active: true,
      });

      if (error) throw error;
      toast.success("Item added to canteen");
      setShowAddItem(false);
      setNewItem({
        name: "",
        category: "food",
        price: "",
        stock: "",
        unit: "pieces",
      });
      refetchItems();
    } catch (err) {
      toast.error("Failed to add item");
    }
  };

  const updateStock = async (itemId: string, newStock: number) => {
    try {
      const { error } = await supabase.from("canteen_items").update({ stock: newStock }).eq("id", itemId);
      if (error) throw error;
      refetchItems();
    } catch (err) {
      toast.error("Failed to update stock");
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const { error } = await supabase.from("canteen_orders").update({ status }).eq("id", orderId);
      if (error) throw error;
      refetchOrders();
    } catch (err) {
      toast.error("Failed to update order");
    }
  };

  const totalRevenue = orders.filter((o) => o.status === "completed").reduce((sum, o) => sum + o.total, 0);

  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const lowStockItems = items.filter((i) => i.stock < 10 && i.is_active).length;

  if (loading) {
    return (
      <div className="content">
        <PageHeader title="Canteen" subtitle="Manage orders and inventory" />
        <div className="flex items-center justify-center py-20">
          <MaterialIcon className="text-4xl text-primary animate-spin">sync</MaterialIcon>
        </div>
      </div>
    );
  }

  return (
    <PageErrorBoundary>
      <div className="content">
        <PageHeader title="Canteen Management" subtitle="Track student orders, manage inventory, and monitor revenue" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardBody className="text-center">
              <div className="text-2xl font-bold text-primary">{orders.length}</div>
              <div className="text-xs text-on-surface-variant">Total Orders</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <div className="text-2xl font-bold text-amber-600">{pendingOrders}</div>
              <div className="text-xs text-on-surface-variant">Pending</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <div className="text-2xl font-bold text-green-600">{totalRevenue.toLocaleString()} UGX</div>
              <div className="text-xs text-on-surface-variant">Revenue</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-center">
              <div className="text-2xl font-bold text-red-500">{lowStockItems}</div>
              <div className="text-xs text-on-surface-variant">Low Stock</div>
            </CardBody>
          </Card>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "orders"
                ? "bg-[var(--primary)] text-white"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-bright"
            }`}
          >
            <MaterialIcon icon="receipt_long" className="inline mr-2" />
            Orders
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "inventory"
                ? "bg-[var(--primary)] text-white"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-bright"
            }`}
          >
            <MaterialIcon icon="inventory_2" className="inline mr-2" />
            Inventory
          </button>
        </div>

        {activeTab === "orders" && (
          <Card>
            <CardHeader className="flex justify-between items-center">
              <h3 className="font-semibold text-on-surface">Recent Orders</h3>
            </CardHeader>
            <CardBody className="p-0">
              {orders.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant">
                  <MaterialIcon className="text-4xl mb-2">receipt_long</MaterialIcon>
                  <p>No orders yet</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant/10">
                  {orders.map((order) => (
                    <div key={order.id} className="p-4 flex items-center gap-4">
                      <div className="flex-1">
                        <div className="font-medium text-on-surface">Order #{order.id.slice(0, 8)}</div>
                        <div className="text-sm text-on-surface-variant">
                          {new Date(order.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="font-bold text-primary">{order.total.toLocaleString()} UGX</div>
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium ${
                          order.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : order.status === "ready"
                              ? "bg-blue-100 text-blue-800"
                              : order.status === "preparing"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="preparing">Preparing</option>
                        <option value="ready">Ready</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {activeTab === "inventory" && (
          <Card>
            <CardHeader className="flex justify-between items-center">
              <h3 className="font-semibold text-on-surface">Canteen Items</h3>
              <Button size="sm" onClick={() => setShowAddItem(true)}>
                <MaterialIcon icon="add" />
                Add Item
              </Button>
            </CardHeader>
            <CardBody className="p-0">
              {items.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant">
                  <MaterialIcon className="text-4xl mb-2">inventory_2</MaterialIcon>
                  <p>No items in canteen</p>
                  <Button className="mt-4" onClick={() => setShowAddItem(true)}>
                    Add First Item
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface-container">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant">Item</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant">Category</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant">Price</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant">Stock</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-on-surface-variant">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-surface-bright">
                          <td className="px-4 py-3 font-medium text-on-surface">{item.name}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-surface-container rounded text-xs capitalize">
                              {item.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-primary">
                            {item.price.toLocaleString()} UGX
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={item.stock < 10 ? "text-red-500 font-medium" : ""}>
                              {item.stock} {item.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => updateStock(item.id, item.stock - 1)}
                              className="p-1 hover:bg-surface-container rounded"
                            >
                              <MaterialIcon className="text-lg">remove</MaterialIcon>
                            </button>
                            <button
                              onClick={() => updateStock(item.id, item.stock + 1)}
                              className="p-1 hover:bg-surface-container rounded"
                            >
                              <MaterialIcon className="text-lg">add</MaterialIcon>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {showAddItem && (
          <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
            <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto">
              <h3 className="text-lg font-semibold text-on-surface mb-4">Add Canteen Item</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-1">Name</label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                    placeholder="e.g. Chapati"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Category</label>
                    <select
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                    >
                      <option value="food">Food</option>
                      <option value="drink">Drink</option>
                      <option value="snack">Snack</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Price (UGX)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                      placeholder="1000"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Initial Stock</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={newItem.stock}
                      onChange={(e) => setNewItem({ ...newItem, stock: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-on-surface-variant mb-1">Unit</label>
                    <select
                      value={newItem.unit}
                      onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                    >
                      <option value="pieces">Pieces</option>
                      <option value="packs">Packs</option>
                      <option value="liters">Liters</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="secondary" className="flex-1" onClick={() => setShowAddItem(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleAddItem} disabled={Boolean(canteenValidationError)}>
                  Add Item
                </Button>
              </div>
              {canteenValidationError && <p className="text-sm text-[var(--t3)]">{canteenValidationError}</p>}
            </div>
          </div>
        )}
      </div>
    </PageErrorBoundary>
  );
}
