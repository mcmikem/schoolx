"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { supabase } from "@/lib/supabase";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { format } from "date-fns";
import Image from "next/image";

interface POSItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url?: string;
  stock_quantity: number;
}

interface CartItem extends POSItem {
  quantity: number;
}

export default function CanteenPOSPage() {
  const { school, user } = useAuth();
  const { academicYear } = useAcademic();
  const toast = useToast();
  const [items, setItems] = useState<POSItem[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "cash">(
    "wallet",
  );
  const [demoCounter, setDemoCounter] = useState(42);

  const isOnline = useOnlineStatus();

  // Load Inventory
  useEffect(() => {
    const fetchInventory = async () => {
      if (!school?.id) return;
      try {
        if (isOnline) {
          const { data } = await supabase
            .from("canteen_items")
            .select("*")
            .eq("school_id", school.id)
            .eq("is_active", true);

          if (data) {
            setItems(data);
            const cats = Array.from(new Set(data.map((i: any) => i.category)));
            setCategories(["All", ...cats]);
            await offlineDB.cacheFromServer("canteen_items", data);
          }
        } else {
          // Offline mode fallback
          const cachedData = await offlineDB.getAllFromCache("canteen_items", {
            school_id: school.id,
            is_active: true,
          });
          if (cachedData && cachedData.length > 0) {
            setItems(cachedData as any);
            const cats = Array.from(
              new Set(cachedData.map((i: any) => i.category)),
            );
            setCategories(["All", ...cats]);
          } else {
            toast.error("Offline and no cached items found");
          }
        }
      } catch (err) {
        console.error("Failed to load inventory:", err);
      }
    };
    fetchInventory();
  }, [school?.id, isOnline, toast]);

  const addToCart = (item: POSItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === "wallet" && !student) {
      alert("Please scan student ID for wallet payment");
      return;
    }

    setLoading(true);
    if (!school?.id) {
      toast.error("School not found");
      setLoading(false);
      return;
    }

    try {
      const saleRecord = {
        id: isOnline ? undefined : crypto.randomUUID(), // Let Supabase gen ID if online, IDB if offline
        school_id: school.id,
        student_id: student?.id || null,
        total_amount: total,
        payment_method: paymentMethod,
        items: cart.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
        recorded_by: user?.id,
        created_at: new Date().toISOString(),
      };

      if (!isOnline) {
        // Offline: save to IDB and Sync Queue
        await offlineDB.save("canteen_sales", saleRecord);
        toast.info("Offline: Order saved to sync queue");
      } else {
        // Online: Direct Supabase insert
        const { data: sale, error: saleError } = await supabase
          .from("canteen_sales")
          .insert(saleRecord)
          .select()
          .single();

        if (saleError) throw saleError;

        // If Wallet, Deduct Balance (Only works online right now)
        if (paymentMethod === "wallet" && student) {
          const { error: walletError } = await supabase.rpc(
            "deduct_student_wallet",
            {
              p_student_id: student.id,
              p_amount: total,
              p_description: `Purchase at Canteen`,
              p_ref: sale.id,
            },
          );
          if (walletError) throw walletError;
        }
      }

      setCart([]);
      setStudent(null);
      alert(isOnline ? "Sale successful!" : "Sale stored offline!");
    } catch (err: any) {
      alert(err.message || "Failed to process sale");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageErrorBoundary>
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* POS Header */}
      <div className="bg-white px-6 py-4 flex justify-between items-center border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-primary-800 text-white flex items-center justify-center font-black">
            <MaterialIcon icon="store" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">
              Canteen POS
            </h1>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              {school?.name || "SkoolMate Canteen"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right flex items-center gap-4">
            {!isOnline && (
              <div className="flex items-center gap-2 text-amber-500 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100 animate-pulse">
                <MaterialIcon icon="wifi_off" style={{ fontSize: 16 }} />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Offline Mode
                </span>
              </div>
            )}

            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                Terminal
              </p>
              <p className="text-sm font-bold text-slate-800">Counter 01</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-100 rounded-2xl">
            <MaterialIcon icon="schedule" className="text-primary-700" />
            <p className="text-xs font-bold text-slate-800">
              {format(new Date(), "HH:mm")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Inventory Grid */}
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
          {/* Categories */}
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar shrink-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeCategory === cat
                    ? "bg-primary-800 text-white shadow-lg shadow-primary-800/20"
                    : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {items
                .filter(
                  (i) =>
                    activeCategory === "All" || i.category === activeCategory,
                )
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="bg-white p-4 rounded-3xl border border-slate-100 hover:border-primary-100 transition-all group flex flex-col items-start text-left relative overflow-hidden active:scale-95"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-primary-800 mb-4 group-hover:bg-primary-50">
                      <MaterialIcon icon="restaurant" />
                    </div>
                    <p className="text-sm font-black text-slate-800 leading-tight mb-1">
                      {item.name}
                    </p>
                    <p className="text-xs font-bold text-primary-700">
                      UGX {item.price.toLocaleString()}
                    </p>

                    <div className="absolute top-4 right-4 text-[9px] font-black uppercase text-slate-400 tracking-tighter">
                      Stock:{" "}
                      {item.stock_quantity > 0 ? item.stock_quantity : "OUT"}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Right: Cart & Identity */}
        <div className="w-[400px] bg-white border-l border-slate-100 flex flex-col shrink-0 flex-1 lg:flex-none">
          {/* Student Verification */}
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
              Customer Identity
            </h3>
            {!student ? (
              <div className="p-4 rounded-[28px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-3 hover:bg-slate-50/50 transition-colors cursor-pointer group">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-primary-800 transition-colors">
                  <MaterialIcon
                    icon="qr_code_scanner"
                    style={{ fontSize: 32 }}
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Scan Student ID
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Verify wallet balance instantly
                  </p>
                </div>
                <button
                  onClick={() => {
                    const counterStr = String(demoCounter).padStart(3, "0");
                    setStudent({
                      id: "demo123",
                      first_name: "Isaac",
                      last_name: "Mugisha",
                      balance: 15000,
                      student_number: `SM/${academicYear}/${counterStr}`,
                    });
                    setDemoCounter((c) => c + 1);
                  }}
                  className="text-[9px] font-black uppercase text-primary-700 hover:underline"
                >
                  Simulate Scan
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-[28px] bg-primary-800 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8" />
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center font-black">
                    {student.first_name[0]}
                    {student.last_name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black truncate">
                      {student.first_name} {student.last_name}
                    </p>
                    <p className="text-[10px] font-black opacity-60 uppercase tracking-widest">
                      {student.student_number}
                    </p>
                  </div>
                  <button
                    onClick={() => setStudent(null)}
                    className="ml-auto p-1.5 hover:bg-white/20 rounded-lg shrink-0"
                  >
                    <MaterialIcon icon="close" style={{ fontSize: 16 }} />
                  </button>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-end relative z-10">
                  <div>
                    <p className="text-[9px] font-black uppercase opacity-60 tracking-tighter mb-1">
                      Wallet Balance
                    </p>
                    <p className="text-xl font-black">
                      UGX {student.balance.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                      Verified
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Current Order
              </h3>
              <p className="text-[10px] font-bold text-slate-400 italic">
                {cart.length} items
              </p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 animate-in slide-in-from-right duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-primary-800 font-bold text-xs ring-1 ring-slate-100">
                    {item.quantity}x
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold tracking-tighter">
                      UGX {item.price.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <MaterialIcon
                      icon="delete_outline"
                      style={{ fontSize: 18 }}
                    />
                  </button>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-20 opacity-30">
                  <MaterialIcon
                    icon="shopping_basket"
                    style={{ fontSize: 48 }}
                  />
                  <p className="text-xs font-bold tracking-tight">
                    Cart is empty
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Checkout Footer */}
          <div className="p-6 bg-slate-50/50 space-y-6 shrink-0 border-t border-slate-100">
            <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-slate-100">
              <button
                onClick={() => setPaymentMethod("wallet")}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${paymentMethod === "wallet" ? "bg-primary-800 text-white shadow-md" : "text-slate-500 hover:text-slate-800"}`}
              >
                <MaterialIcon
                  icon="account_balance_wallet"
                  style={{ fontSize: 16 }}
                />
                Wallet
              </button>
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${paymentMethod === "cash" ? "bg-primary-800 text-white shadow-md" : "text-slate-500 hover:text-slate-800"}`}
              >
                <MaterialIcon icon="payments" style={{ fontSize: 16 }} />
                Cash
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">
                  Grand Total
                </p>
                <p className="text-2xl font-black text-slate-800">
                  UGX {total.toLocaleString()}
                </p>
              </div>
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || loading}
                className="w-full py-4 bg-primary-800 text-white rounded-2xl font-black uppercase tracking-[2px] shadow-xl shadow-primary-800/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <MaterialIcon icon="bolt" />
                    Complete Order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </PageErrorBoundary>
  );
}
