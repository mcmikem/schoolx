"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
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
  active: boolean;
  image_url?: string;
}

interface CartItem extends CanteenItem {
  quantity: number;
}

interface Order {
  id: string;
  student_id?: string;
  items: { item_id: string; quantity: number; price: number; name: string }[];
  total: number;
  status: "pending" | "preparing" | "ready" | "completed";
  payment_method: "cash" | "wallet";
  created_at: string;
  student_name?: string;
}

export default function CanteenPage() {
  const { school, isDemo } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState<CanteenItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pos" | "orders" | "inventory">("pos");
  
  // POS States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "wallet">("cash");

  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "food",
    price: "",
    stock: "",
    unit: "pieces",
  });

  const loadData = useCallback(async () => {
    if (!school?.id) {
      return;
    }
    if (isDemo) {
      setItems([
        {
          id: "1",
          name: "Chapati",
          category: "food",
          price: 1000,
          stock: 45,
          unit: "pieces",
          active: true,
        },
        {
          id: "2",
          name: "Mandazi",
          category: "snack",
          price: 500,
          stock: 12,
          unit: "pieces",
          active: true,
        },
        {
          id: "3",
          name: "Soda (300ml)",
          category: "drink",
          price: 1500,
          stock: 8,
          unit: "liters",
          active: true,
        },
        {
          id: "4",
          name: "Rice & Beans",
          category: "food",
          price: 3500,
          stock: 20,
          unit: "pieces",
          active: true,
        },
      ]);
      setOrders([
        {
          id: "ORD-1",
          student_id: "s1",
          total: 4500,
          status: "completed",
          created_at: new Date().toISOString(),
          student_name: "Isaac Mugisha",
          items: [],
        },
        {
          id: "ORD-2",
          student_id: "s2",
          total: 1000,
          status: "pending",
          created_at: new Date().toISOString(),
          student_name: "Sarah Jane",
          items: [],
        },
        {
          id: "ORD-3",
          student_id: "s3",
          total: 2000,
          status: "preparing",
          created_at: new Date().toISOString(),
          student_name: "John Doe",
          items: [],
        },
      ]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from("canteen_items")
        .select("*")
        .eq("school_id", school.id)
        .order("category", { ascending: true });

      const { data: ordersData, error: ordersError } = await supabase
        .from("canteen_orders")
        .select("*")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false })
        .limit(50);

      setItems(itemsData || []);
      setOrders(ordersData || []);
    } catch (err) {
      console.error("Error loading canteen data:", err);
    } finally {
      setLoading(false);
    }
  }, [school, isDemo]);

  useEffect(() => {
    if (school?.id) loadData();
  }, [school?.id, loadData]);

  const handleAddItem = async () => {
    if (!school?.id || !newItem.name || !newItem.price) {
      toast.error("Please fill required fields");
      return;
    }

    try {
      const { error } = await supabase.from("canteen_items").insert({
        school_id: school.id,
        name: newItem.name,
        category: newItem.category,
        price: parseFloat(newItem.price),
        stock: parseInt(newItem.stock) || 0,
        unit: newItem.unit,
        active: true,
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
      loadData();
    } catch (err) {
      toast.error("Failed to add item");
    }
  };

  const searchStudents = useCallback(async (term: string) => {
    if (!school?.id || term.length < 2) {
      setStudents([]);
      return;
    }
    const { data, error } = await supabase
      .from("students")
      .select("id, first_name, last_name, student_number, wallet_balance, classes(name)")
      .eq("school_id", school.id)
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,student_number.ilike.%${term}%`)
      .limit(5);
    if (!error) setStudents(data || []);
  }, [school]);

  const addToCart = (item: CanteenItem) => {
    if (item.stock <= 0) {
      toast.error("Item out of stock");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        if (existing.quantity >= item.stock) {
          toast.error("Not enough stock");
          return prev;
        }
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === "wallet" && !selectedStudent) {
      toast.error("Please select a student for wallet payment");
      return;
    }

    if (paymentMethod === "wallet" && selectedStudent) {
      const balance = selectedStudent.wallet_balance || 0;
      if (balance < cartTotal) {
        toast.error(`Insufficient wallet balance. Available: ${balance.toLocaleString()} UGX`);
        return;
      }
    }

    setProcessingOrder(true);
    try {
      if (isDemo) {
        toast.success("Order placed successfully (Demo)");
        setCart([]);
        setSelectedStudent(null);
        setStudentSearchTerm("");
        setProcessingOrder(false);
        return;
      }

      // 1. Create Order
      const { data: orderData, error: orderError } = await supabase
        .from("canteen_orders")
        .insert({
          school_id: school?.id,
          student_id: selectedStudent?.id,
          total: cartTotal,
          payment_method: paymentMethod,
          status: "completed",
          items: cart.map(i => ({ item_id: i.id, quantity: i.quantity, price: i.price, name: i.name }))
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Update Inventory (Deduct stock)
      for (const item of cart) {
        await supabase
          .from("canteen_items")
          .update({ stock: item.stock - item.quantity })
          .eq("id", item.id);
      }

      // 3. If Wallet, Deduct from Student
      if (paymentMethod === "wallet" && selectedStudent) {
        const { error: walletError } = await supabase
          .from("students")
          .update({ wallet_balance: (selectedStudent.wallet_balance || 0) - cartTotal })
          .eq("id", selectedStudent.id);
        if (walletError) throw walletError;
      }

      toast.success("Order processed successfully");
      setCart([]);
      setSelectedStudent(null);
      setStudentSearchTerm("");
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to process order");
    } finally {
      setProcessingOrder(false);
    }
  };

  const updateStock = async (itemId: string, newStock: number) => {
    try {
      await supabase
        .from("canteen_items")
        .update({ stock: newStock })
        .eq("id", itemId);
      setItems(
        items.map((i) => (i.id === itemId ? { ...i, stock: newStock } : i)),
      );
    } catch (err) {
      toast.error("Failed to update stock");
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await supabase
        .from("canteen_orders")
        .update({ status })
        .eq("id", orderId);
      setOrders(
        orders.map((o) =>
          o.id === orderId ? { ...o, status: status as Order["status"] } : o,
        ),
      );
    } catch (err) {
      toast.error("Failed to update order");
    }
  };

  const totalRevenue = orders
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + o.total, 0);

  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const lowStockItems = items.filter((i) => i.stock < 10 && i.active).length;

  if (loading) {
    return (
      <div className="content">
        <PageHeader title="Canteen" subtitle="Manage orders and inventory" />
        <div className="flex items-center justify-center py-20">
          <MaterialIcon className="text-4xl text-primary animate-spin">
            sync
          </MaterialIcon>
        </div>
      </div>
    );
  }

  return (
    <PageErrorBoundary>
    <div className="content">
      <PageHeader
        title="Canteen Management"
        subtitle="Track student orders, manage inventory, and monitor revenue"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-primary">
              {orders.length}
            </div>
            <div className="text-xs text-on-surface-variant">Total Orders</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-amber-600">
              {pendingOrders}
            </div>
            <div className="text-xs text-on-surface-variant">Pending</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {totalRevenue.toLocaleString()} UGX
            </div>
            <div className="text-xs text-on-surface-variant">Revenue</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-red-500">
              {lowStockItems}
            </div>
            <div className="text-xs text-on-surface-variant">Low Stock</div>
          </CardBody>
        </Card>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("pos")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "pos"
              ? "bg-[var(--primary)] text-white shadow-md shadow-primary/20"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-bright"
          }`}
        >
          <MaterialIcon icon="shopping_cart" className="inline mr-2" />
          POS
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "orders"
              ? "bg-[var(--primary)] text-white shadow-md shadow-primary/20"
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
              ? "bg-[var(--primary)] text-white shadow-md shadow-primary/20"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-bright"
          }`}
        >
          <MaterialIcon icon="inventory_2" className="inline mr-2" />
          Inventory
        </button>
      </div>

      {activeTab === "pos" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Items Grid */}
          <div className="lg:col-span-2 space-y-6">
            <div className="dashboard-toolbar">
              <div className="flex flex-wrap gap-2">
                {['all', 'food', 'drink', 'snack'].map(cat => (
                  <button 
                    key={cat}
                    className="dashboard-pill bg-surface-container text-on-surface-variant hover:bg-surface-bright capitalize"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.filter(i => i.active).map(item => (
                <div 
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={`group relative bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/10 hover:border-primary/50 transition-all cursor-pointer select-none active:scale-95 ${item.stock <= 0 ? 'opacity-50 grayscale pointer-events-none' : ''}`}
                >
                  <div className="aspect-square rounded-xl bg-surface-container flex items-center justify-center mb-3 overflow-hidden">
                    <MaterialIcon icon={item.category === 'drink' ? 'local_drink' : item.category === 'food' ? 'lunch_dining' : 'cookie'} className="text-3xl text-on-surface-variant/40" />
                  </div>
                  <div className="font-bold text-on-surface text-sm truncate">{item.name}</div>
                  <div className="flex justify-between items-center mt-1">
                    <div className="text-primary font-black">{item.price.toLocaleString()}</div>
                    <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.stock < 10 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {item.stock} {item.unit[0]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Cart & Checkout */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader className="flex justify-between items-center pb-2">
                <h3 className="font-bold">Current Order</h3>
                <button onClick={() => setCart([])} className="text-xs text-error font-bold hover:underline">Clear</button>
              </CardHeader>
              <CardBody>
                {/* Cart Items */}
                <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                  {cart.length === 0 ? (
                    <div className="py-8 text-center text-on-surface-variant opacity-40 italic text-sm">
                      Cart is empty
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.id} className="flex items-center gap-3 bg-surface-bright p-2 rounded-xl border border-outline-variant/5">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate">{item.name}</div>
                          <div className="text-[10px] text-on-surface-variant">
                            {item.quantity} x {item.price.toLocaleString()}
                          </div>
                        </div>
                        <div className="text-xs font-black text-primary">
                          {(item.quantity * item.price).toLocaleString()}
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="w-6 h-6 rounded-full hover:bg-red-50 text-error flex items-center justify-center"
                        >
                          <MaterialIcon icon="close" className="text-xs" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Total */}
                <div className="pt-4 border-t border-outline-variant/10 mb-6">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-on-surface-variant">Subtotal</span>
                    <span className="text-sm font-medium">{cartTotal.toLocaleString()} UGX</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold">Total</span>
                    <span className="text-xl font-black text-primary">{cartTotal.toLocaleString()} UGX</span>
                  </div>
                </div>

                {/* Student Selection */}
                <div className="space-y-4 mb-6">
                  <div className="text-[11px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Payment Detail</div>
                  
                  <div className="flex gap-2 p-1 bg-surface-container rounded-xl">
                    <button 
                      onClick={() => setPaymentMethod("cash")}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${paymentMethod === 'cash' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'}`}
                    >
                      <MaterialIcon icon="payments" className="text-sm align-middle mr-1" />
                      Cash
                    </button>
                    <button 
                      onClick={() => setPaymentMethod("wallet")}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${paymentMethod === 'wallet' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'}`}
                    >
                      <MaterialIcon icon="account_balance_wallet" className="text-sm align-middle mr-1" />
                      Wallet
                    </button>
                  </div>

                  {paymentMethod === 'wallet' && (
                    <div className="relative">
                      {selectedStudent ? (
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-primary truncate">{selectedStudent.first_name} {selectedStudent.last_name}</div>
                            <div className="text-[10px] text-on-surface-variant">Bal: {selectedStudent.wallet_balance?.toLocaleString() || 0} UGX</div>
                          </div>
                          <button onClick={() => setSelectedStudent(null)} className="p-1 hover:bg-primary/10 rounded-full text-primary">
                            <MaterialIcon icon="edit" className="text-xs" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <input 
                            type="text"
                            placeholder="Search Student..."
                            value={studentSearchTerm}
                            onChange={(e) => {
                              setStudentSearchTerm(e.target.value);
                              searchStudents(e.target.value);
                            }}
                            className="w-full bg-surface-container border-none rounded-xl py-2 px-3 text-xs"
                          />
                          {students.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-surface rounded-xl shadow-xl border border-outline-variant/10 z-10 overflow-hidden">
                              {students.map(s => (
                                <div 
                                  key={s.id}
                                  onClick={() => {
                                    setSelectedStudent(s);
                                    setStudents([]);
                                    setStudentSearchTerm("");
                                  }}
                                  className="p-2 hover:bg-surface-bright cursor-pointer flex justify-between items-center border-b border-outline-variant/5 last:border-0"
                                >
                                  <div>
                                    <div className="text-[11px] font-bold">{s.first_name} {s.last_name}</div>
                                    <div className="text-[9px] text-on-surface-variant">{s.student_number} • {s.classes?.name}</div>
                                  </div>
                                  <div className="text-[10px] font-black text-primary">{s.wallet_balance?.toLocaleString() || 0}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <Button 
                  className="w-full py-4 rounded-2xl shadow-lg shadow-primary/20"
                  disabled={cart.length === 0 || processingOrder}
                  onClick={handleCheckout}
                >
                  {processingOrder ? (
                    <MaterialIcon icon="sync" className="animate-spin" />
                  ) : (
                    <>Process Order • {cartTotal.toLocaleString()}</>
                  )}
                </Button>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

        <Card>
          <CardHeader className="flex justify-between items-center">
            <h3 className="font-semibold text-on-surface">Recent Orders</h3>
          </CardHeader>
          <CardBody className="p-0">
            {orders.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant">
                <MaterialIcon className="text-4xl mb-2">
                  receipt_long
                </MaterialIcon>
                <p>No orders yet</p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/10">
                {orders.map((order) => (
                  <div key={order.id} className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="font-medium text-on-surface">
                        Order #{order.id.slice(0, 8)}
                      </div>
                      <div className="text-sm text-on-surface-variant">
                        {new Date(order.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="font-bold text-primary">
                      {order.total.toLocaleString()} UGX
                    </div>
                    <select
                      value={order.status}
                      onChange={(e) =>
                        updateOrderStatus(order.id, e.target.value)
                      }
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
                <MaterialIcon className="text-4xl mb-2">
                  inventory_2
                </MaterialIcon>
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant">
                        Item
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant">
                        Category
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant">
                        Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant">
                        Stock
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-on-surface-variant">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-bright">
                        <td className="px-4 py-3 font-medium text-on-surface">
                          {item.name}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-surface-container rounded text-xs capitalize">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-primary">
                          {item.price.toLocaleString()} UGX
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={
                              item.stock < 10 ? "text-red-500 font-medium" : ""
                            }
                          >
                            {item.stock} {item.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => updateStock(item.id, item.stock - 1)}
                            className="p-1 hover:bg-surface-container rounded"
                          >
                            <MaterialIcon className="text-lg">
                              remove
                            </MaterialIcon>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-on-surface mb-4">
              Add Canteen Item
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) =>
                    setNewItem({ ...newItem, name: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                  placeholder="e.g. Chapati"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-1">
                    Category
                  </label>
                  <select
                    value={newItem.category}
                    onChange={(e) =>
                      setNewItem({ ...newItem, category: e.target.value })
                    }
                    className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                  >
                    <option value="food">Food</option>
                    <option value="drink">Drink</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-1">
                    Price (UGX)
                  </label>
                  <input
                    type="number"
                    value={newItem.price}
                    onChange={(e) =>
                      setNewItem({ ...newItem, price: e.target.value })
                    }
                    className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                    placeholder="1000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    value={newItem.stock}
                    onChange={(e) =>
                      setNewItem({ ...newItem, stock: e.target.value })
                    }
                    className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                    placeholder="50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant mb-1">
                    Unit
                  </label>
                  <select
                    value={newItem.unit}
                    onChange={(e) =>
                      setNewItem({ ...newItem, unit: e.target.value })
                    }
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
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowAddItem(false)}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleAddItem}>
                Add Item
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
