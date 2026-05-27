"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { supabase } from "@/lib/supabase";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { format } from "date-fns";
import Image from "next/image";
import { logger } from "@/lib/logger";
import { Html5Qrcode } from "html5-qrcode";
import Link from "next/link";

interface POSItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url?: string;
  stock: number;
}

interface CartItem extends POSItem {
  quantity: number;
}

interface ScannedStudent {
  id: string;
  first_name: string;
  last_name: string;
  student_number: string;
  balance: number;
  photo_url?: string;
}

export default function CanteenPOSPage() {
  const { school, user } = useAuth();
  const { academicYear } = useAcademic();
  const toast = useToast();
  const [items, setItems] = useState<POSItem[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [student, setStudent] = useState<ScannedStudent | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "cash">(
    "wallet",
  );
  const [showScanner, setShowScanner] = useState(false);
  const [manualStudentNum, setManualStudentNum] = useState("");
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

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
        logger.error("Failed to load inventory:", err);
      }
    };
    fetchInventory();
  }, [school?.id, isOnline, toast]);

  const addToCart = (item: POSItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      const currentQty = existing?.quantity || 0;
      if (currentQty >= Math.max(0, Number(item.stock || 0))) {
        toast.warning(`${item.name} is out of stock`);
        return prev;
      }

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
      toast.warning("Please scan student ID for wallet payment");
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
        // Include wallet deduction flag so sync handler can process it later
        if (paymentMethod === "wallet" && student) {
          (saleRecord as any).pending_wallet_deduction = {
            student_id: student.id,
            amount: total,
          };
          // Optimistically update local balance so UI reflects it
          setStudent((prev: any) =>
            prev ? { ...prev, balance: Math.max(0, prev.balance - total) } : prev,
          );
        }
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
      toast.success(isOnline ? "Sale recorded successfully!" : "Sale stored offline — will sync when connected");
    } catch (err: any) {
      toast.error(err.message || "Failed to process sale");
    } finally {
      setLoading(false);
    }
  };

  // QR Scanner functions
  const startScanner = async () => {
    setScannerError(null);
    setShowScanner(true);
    try {
      const scanner = new Html5Qrcode("canteen-qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          // Stop scanner on successful scan
          await stopScanner();
          await lookupStudent(decodedText.trim());
        },
        () => {
          // Ignore scan errors (no QR in frame)
        },
      );
    } catch (err: any) {
      setScannerError(err.message || "Could not start camera");
      logger.error("QR scanner error:", err);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setShowScanner(false);
  };

  const lookupStudent = async (studentIdOrNumber: string) => {
    if (!school?.id) {
      toast.error("School not loaded");
      return;
    }
    setLoading(true);
    try {
      // Try lookup by ID first, then by student_number
      let query = supabase
        .from("students")
        .select("id, first_name, last_name, student_number, photo_url")
        .eq("school_id", school.id);

      // Check if it looks like a UUID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        studentIdOrNumber,
      );

      if (isUuid) {
        query = query.eq("id", studentIdOrNumber);
      } else {
        query = query.eq("student_number", studentIdOrNumber);
      }

      const { data: studentData, error: studentError } = await query.single();

      if (studentError || !studentData) {
        toast.error("Student not found. Please check the ID card.");
        return;
      }

      // Fetch wallet balance
      const { data: walletData } = await supabase
        .from("student_wallets")
        .select("balance")
        .eq("student_id", studentData.id)
        .maybeSingle();

      setStudent({
        id: studentData.id,
        first_name: studentData.first_name || "",
        last_name: studentData.last_name || "",
        student_number: studentData.student_number || "",
        balance: Number(walletData?.balance || 0),
        photo_url: studentData.photo_url,
      });
      toast.success(`Verified: ${studentData.first_name} ${studentData.last_name}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to look up student");
    } finally {
      setLoading(false);
    }
  };

  const handleManualLookup = async () => {
    if (!manualStudentNum.trim()) return;
    await lookupStudent(manualStudentNum.trim());
    setManualStudentNum("");
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
          <Link
            href="/dashboard/store/meal-scan"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100"
          >
            <MaterialIcon icon="restaurant" className="text-sm" />
            Meal Scan Terminal
          </Link>
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
                      {item.stock > 0 ? item.stock : "OUT"}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Right: Cart & Identity */}
        <div className="w-full max-w-[400px] bg-white border-l border-slate-100 flex flex-col shrink-0 flex-1 lg:flex-none">
          {/* Student Verification */}
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
              Customer Identity
            </h3>
            {!student ? (
              <div className="space-y-3">
                <button
                  onClick={startScanner}
                  className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-3 hover:bg-slate-50/50 transition-colors cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-primary-800 transition-colors">
                    <MaterialIcon
                      icon="qr_code_scanner"
                      style={{ fontSize: 32 }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      Scan Student ID Card
                    </p>
                    <p className="text-xs text-slate-400 font-medium">
                      Tap to open camera and scan QR code
                    </p>
                  </div>
                </button>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualStudentNum}
                    onChange={(e) => setManualStudentNum(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
                    placeholder="Or type student number..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={handleManualLookup}
                    className="px-4 py-2 bg-primary-800 text-white text-sm font-bold rounded-xl hover:bg-primary-900 transition-colors"
                  >
                    Look up
                  </button>
                </div>
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

    {/* QR Scanner Modal */}
    {showScanner && (
      <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-start sm:justify-center overflow-y-auto p-3 sm:p-4">
        <div className="bg-white rounded-2xl w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">Scan Student ID</h3>
            <button
              onClick={stopScanner}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <MaterialIcon icon="close" className="text-slate-500" />
            </button>
          </div>
          <div className="p-4">
            {scannerError ? (
              <div className="text-center py-8">
                <MaterialIcon icon="error" className="text-red-500 text-4xl mb-3" />
                <p className="text-red-600 font-medium">{scannerError}</p>
                <p className="text-sm text-slate-500 mt-2">
                  Make sure you have granted camera permission.
                </p>
              </div>
            ) : (
              <div
                id="canteen-qr-reader"
                className="w-full aspect-square bg-slate-900 rounded-xl overflow-hidden"
              />
            )}
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100">
            <p className="text-xs text-slate-500 text-center">
              Point the camera at the student&apos;s ID card QR code
            </p>
          </div>
        </div>
      </div>
    )}
    </PageErrorBoundary>
  );
}
