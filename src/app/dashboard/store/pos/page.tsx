"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { supabase } from "@/lib/supabase";
import { offlineDB, useOnlineStatus } from "@/lib/offline";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import MaterialIcon from "@/components/MaterialIcon";
import { format } from "date-fns";
import { logger } from "@/lib/logger";
import type { Html5Qrcode } from "html5-qrcode";
import Link from "next/link";
import {
  getCartKey,
  formatQty,
  parseQtyInput,
  clampQty,
  calcChange,
  validateCashCheckout,
  validateWalletCheckout,
} from "@/lib/pos-utils";

interface POSItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url?: string;
  stock: number;
  unit?: string;
  variant?: string | null;
}

interface CartItem extends POSItem {
  quantity: number;
  cartKey: string;
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
  void academicYear;
  const toast = useToast();
  const [items, setItems] = useState<POSItem[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [student, setStudent] = useState<ScannedStudent | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "cash">("wallet");
  const [showScanner, setShowScanner] = useState(false);
  const [manualStudentNum, setManualStudentNum] = useState("");
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [cashTendered, setCashTendered] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ key: string; name: string } | null>(null);
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const checkoutButtonRef = useRef<HTMLButtonElement | null>(null);

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
            const cats = Array.from(new Set(cachedData.map((i: any) => i.category)));
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

  const cartQtyByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart) map.set(line.cartKey, line.quantity);
    return map;
  }, [cart]);

  const addToCart = useCallback(
    (item: POSItem, qty = 1) => {
      const key = getCartKey(item);
      setCart((prev) => {
        const existing = prev.find((i) => i.cartKey === key);
        const currentQty = existing?.quantity || 0;
        const nextQty = Math.round((currentQty + qty) * 100) / 100;
        const capped = clampQty(nextQty, Number(item.stock || 0));
        if (capped <= currentQty) {
          toast.warning(`${item.name} is out of stock`);
          return prev;
        }
        if (capped < nextQty) {
          toast.warning(`Only ${formatQty(capped)} × ${item.name} available`);
        }
        if (existing) {
          return prev.map((i) => (i.cartKey === key ? { ...i, quantity: capped } : i));
        }
        return [...prev, { ...item, quantity: capped, cartKey: key }];
      });
      setQtyDrafts((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [toast],
  );

  const updateQuantity = useCallback(
    (cartKey: string, nextQty: number) => {
      const line = cart.find((i) => i.cartKey === cartKey);
      if (!line) return;
      if (!Number.isFinite(nextQty) || nextQty <= 0) {
        setPendingDelete({ key: cartKey, name: line.name });
        return;
      }
      const capped = clampQty(nextQty, Number(line.stock || 0));
      if (capped <= 0) {
        toast.warning(`${line.name} is out of stock`);
        return;
      }
      if (capped < nextQty) {
        toast.warning(`Only ${formatQty(capped)} × ${line.name} available`);
      }
      setCart((prev) => prev.map((i) => (i.cartKey === cartKey ? { ...i, quantity: capped } : i)));
    },
    [cart, toast],
  );

  const commitQtyDraft = useCallback(
    (cartKey: string, raw: string) => {
      const parsed = parseQtyInput(raw);
      setQtyDrafts((prev) => {
        const next = { ...prev };
        delete next[cartKey];
        return next;
      });
      if (parsed === null) {
        toast.error("Enter a valid quantity greater than 0 (decimals allowed, e.g. 1.5)");
        return;
      }
      updateQuantity(cartKey, parsed);
    },
    [toast, updateQuantity],
  );

  const requestRemove = useCallback((cartKey: string, name: string) => {
    setPendingDelete({ key: cartKey, name });
  }, []);

  const confirmRemove = useCallback(() => {
    if (!pendingDelete) return;
    const key = pendingDelete.key;
    setCart((prev) => prev.filter((i) => i.cartKey !== key));
    setQtyDrafts((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPendingDelete(null);
  }, [pendingDelete]);

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

  const tenderedValue = useMemo(() => {
    const trimmed = cashTendered.trim();
    if (!trimmed) return null;
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : null;
  }, [cashTendered]);

  const changeDue = useMemo(() => {
    if (paymentMethod !== "cash" || tenderedValue === null) return null;
    return calcChange(tenderedValue, total);
  }, [paymentMethod, tenderedValue, total]);

  const walletCheck = useMemo(() => {
    if (paymentMethod !== "wallet") return { ok: true as const };
    if (!student) return { ok: false as const, error: "Please scan student ID for wallet payment" };
    return validateWalletCheckout({ total, balance: student.balance });
  }, [paymentMethod, student, total]);

  const openConfirm = useCallback(
    (presetExactCash = false) => {
      if (cart.length === 0) return;
      setConfirmError(null);
      if (paymentMethod === "cash" && presetExactCash) {
        setCashTendered(String(Math.round(total * 100) / 100));
      }
      setShowConfirm(true);
    },
    [cart.length, paymentMethod, total],
  );

  // QuickSale: F2 opens the confirm modal with exact cash prefilled.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        if (cart.length === 0 || loading || showConfirm || showScanner) return;
        openConfirm(true);
      }
      if (event.key === "Escape" && showConfirm) {
        setShowConfirm(false);
        setConfirmError(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cart.length, loading, showConfirm, showScanner, openConfirm]);

  // Return focus to the checkout button when the confirm modal closes.
  useEffect(() => {
    if (!showConfirm) {
      checkoutButtonRef.current?.focus?.();
    }
  }, [showConfirm]);

  const processSale = useCallback(async () => {
    if (cart.length === 0) return;
    if (paymentMethod === "wallet" && !student) {
      const message = "Please scan student ID for wallet payment";
      setConfirmError(message);
      toast.warning(message);
      return;
    }
    if (paymentMethod === "wallet" && student) {
      const check = validateWalletCheckout({ total, balance: student.balance });
      if (!check.ok) {
        setConfirmError(check.error || "Insufficient wallet balance");
        toast.error(check.error || "Insufficient wallet balance");
        return;
      }
    }
    if (paymentMethod === "cash") {
      const check = validateCashCheckout({ total, tendered: tenderedValue, paymentMethod });
      if (!check.ok) {
        setConfirmError(check.error || "Insufficient cash received");
        toast.error(check.error || "Insufficient cash received");
        return;
      }
    }

    setLoading(true);
    if (!school?.id) {
      toast.error("School not found");
      setLoading(false);
      return;
    }

    try {
      const saleRecord = {
        // Let Supabase gen the id online; offlineDB.save() generates one when
        // offline and queues it as a create for the sync handler.
        id: undefined,
        school_id: school.id,
        student_id: student?.id || null,
        total_amount: total,
        payment_method: paymentMethod,
        items: cart.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          variant: i.variant ?? null,
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
          setStudent((prev: any) => (prev ? { ...prev, balance: Math.max(0, prev.balance - total) } : prev));
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
          const { error: walletError } = await supabase.rpc("deduct_student_wallet", {
            p_student_id: student.id,
            p_amount: total,
            p_description: `Purchase at Canteen`,
            p_ref: sale.id,
          });
          if (walletError) throw walletError;
        }
      }

      setCart([]);
      setStudent(null);
      setCashTendered("");
      setQtyDrafts({});
      setShowConfirm(false);
      setConfirmError(null);
      toast.success(isOnline ? "Sale recorded successfully!" : "Sale stored offline — will sync when connected");
    } catch (err: any) {
      toast.error(err.message || "Failed to process sale");
    } finally {
      setLoading(false);
    }
  }, [cart, paymentMethod, student, tenderedValue, total, school?.id, user?.id, isOnline, toast]);

  const handleCompleteOrder = useCallback(() => {
    if (cart.length === 0 || loading) return;
    if (paymentMethod === "wallet" && !student) {
      toast.warning("Please scan student ID for wallet payment");
      return;
    }
    openConfirm(false);
  }, [cart.length, loading, paymentMethod, student, openConfirm, toast]);

  const handleQuickSale = useCallback(() => {
    if (cart.length === 0 || loading) return;
    if (paymentMethod === "wallet" && !student) {
      toast.warning("Please scan student ID for wallet payment");
      return;
    }
    openConfirm(true);
  }, [cart.length, loading, paymentMethod, student, openConfirm, toast]);

  // QR Scanner functions
  const startScanner = async () => {
    setScannerError(null);
    setShowScanner(true);
    try {
      const { Html5Qrcode: Html5QrcodeClass } = await import("html5-qrcode");
      const scanner = new Html5QrcodeClass("canteen-qr-reader");
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
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentIdOrNumber);

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

  const filteredItems = useMemo(
    () => items.filter((i) => activeCategory === "All" || i.category === activeCategory),
    [items, activeCategory],
  );

  const cashBlocked = paymentMethod === "cash" && tenderedValue !== null && tenderedValue < total && total > 0;
  const walletBlocked =
    paymentMethod === "wallet" && !!student && student.balance < total && total > 0 && cart.length > 0;

  return (
    <PageErrorBoundary>
      <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
        {/* POS Header */}
        <div className="bg-white px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-primary-800 text-white flex items-center justify-center font-black shrink-0">
              <MaterialIcon icon="store" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight truncate">Canteen POS</h1>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest truncate">
                {school?.name || "SkoolMate Canteen"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              type="button"
              onClick={handleQuickSale}
              disabled={cart.length === 0 || loading}
              title="QuickSale — open confirm with exact cash (F2)"
              aria-label="QuickSale — open confirm with exact cash"
              className="inline-flex items-center gap-2 rounded-xl bg-primary-800 px-3 py-2 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-primary-900 active:scale-95 transition-all disabled:opacity-50 min-h-[44px] touch-manipulation"
            >
              <MaterialIcon icon="bolt" style={{ fontSize: 16 }} />
              <span className="hidden sm:inline">QuickSale</span>
              <kbd className="hidden md:inline rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">F2</kbd>
            </button>
            <Link
              href="/dashboard/store/meal-scan"
              aria-label="Open meal scan terminal"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100 min-h-[44px] touch-manipulation"
            >
              <MaterialIcon icon="restaurant" className="text-sm" />
              <span className="hidden lg:inline">Meal Scan Terminal</span>
            </Link>
            <div className="text-right hidden md:flex items-center gap-4">
              {!isOnline && (
                <div className="flex items-center gap-2 text-amber-500 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100 animate-pulse">
                  <MaterialIcon icon="wifi_off" style={{ fontSize: 16 }} />
                  <span className="text-xs font-bold uppercase tracking-wider">Offline Mode</span>
                </div>
              )}

              <div className="hidden xl:block">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                  Terminal
                </p>
                <p className="text-sm font-bold text-slate-800">Counter 01</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-slate-100 rounded-2xl">
              <MaterialIcon icon="schedule" className="text-primary-700" />
              <p className="text-xs font-bold text-slate-800">{format(new Date(), "HH:mm")}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Left: Inventory Grid */}
          <div className="flex-1 p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 overflow-hidden min-h-0">
            {/* Categories */}
            <div
              className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 custom-scrollbar shrink-0"
              role="tablist"
              aria-label="Product categories"
            >
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 sm:px-6 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap min-h-[44px] touch-manipulation focus-visible:outline-2 focus-visible:outline-primary-800 ${
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
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {filteredItems.map((item) => {
                  const key = getCartKey(item);
                  const inCartQty = cartQtyByKey.get(key) || 0;
                  const outOfStock = Number(item.stock || 0) <= 0 || inCartQty >= Math.max(0, Number(item.stock || 0));
                  const variantLabel = item.variant ? String(item.variant) : null;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => addToCart(item)}
                      disabled={Number(item.stock || 0) <= 0}
                      aria-pressed={inCartQty > 0}
                      aria-label={`${item.name}${variantLabel ? `, variant ${variantLabel}` : ""}, UGX ${Number(item.price || 0).toLocaleString()}${inCartQty > 0 ? `, ${formatQty(inCartQty)} in cart` : ""}${Number(item.stock || 0) <= 0 ? ", out of stock" : ""}`}
                      className="bg-white p-4 rounded-3xl border border-slate-100 hover:border-primary-100 transition-all group flex flex-col items-start text-left relative overflow-hidden active:scale-95 min-h-[132px] touch-manipulation focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-800 disabled:opacity-60 disabled:active:scale-100"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-primary-800 mb-3 group-hover:bg-primary-50">
                        <MaterialIcon icon="restaurant" />
                      </div>
                      <p className="text-sm font-black text-slate-800 leading-tight mb-1 pr-14">{item.name}</p>
                      {variantLabel && (
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                          {variantLabel}
                        </p>
                      )}
                      {item.unit && <p className="text-[10px] font-bold text-slate-400 mb-1">per {item.unit}</p>}
                      <p className="text-xs font-bold text-primary-700">
                        UGX {Number(item.price || 0).toLocaleString()}
                      </p>

                      <div className="absolute top-4 right-4 text-[9px] font-black uppercase text-slate-400 tracking-tighter">
                        Stock: {Number(item.stock || 0) > 0 ? item.stock : "OUT"}
                      </div>
                      {inCartQty > 0 && (
                        <div
                          className="absolute bottom-3 right-3 rounded-full bg-primary-800 text-white text-[10px] font-black px-2.5 py-1 shadow-md"
                          aria-hidden="true"
                        >
                          {formatQty(inCartQty)} in cart
                        </div>
                      )}
                      {outOfStock && Number(item.stock || 0) > 0 && (
                        <div
                          className="absolute bottom-3 right-3 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1"
                          aria-hidden="true"
                        >
                          Max
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {filteredItems.length === 0 && (
                <div className="py-16 text-center text-sm font-semibold text-slate-400">
                  No items in this category yet.
                </div>
              )}
            </div>
          </div>

          {/* Right: Cart & Identity */}
          <div className="w-full lg:max-w-[400px] bg-white border-t lg:border-t-0 lg:border-l border-slate-100 flex flex-col shrink-0 max-h-[52vh] lg:max-h-none lg:flex-1 xl:flex-none overflow-y-auto lg:overflow-visible">
            {/* Student Verification */}
            <div className="p-4 sm:p-6 border-b border-slate-100">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
                Customer Identity
              </h3>
              {!student ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={startScanner}
                    className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-3 hover:bg-slate-50/50 transition-colors cursor-pointer group min-h-[44px] touch-manipulation focus-visible:outline-2 focus-visible:outline-primary-800"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-primary-800 transition-colors">
                      <MaterialIcon icon="qr_code_scanner" style={{ fontSize: 32 }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Scan Student ID Card</p>
                      <p className="text-xs text-slate-400 font-medium">Tap to open camera and scan QR code</p>
                    </div>
                  </button>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualStudentNum}
                      onChange={(e) => setManualStudentNum(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
                      placeholder="Or type student number..."
                      aria-label="Student number"
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                    />
                    <button
                      type="button"
                      onClick={handleManualLookup}
                      className="px-4 py-2 bg-primary-800 text-white text-sm font-bold rounded-xl hover:bg-primary-900 transition-colors min-h-[44px] touch-manipulation"
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
                      type="button"
                      onClick={() => setStudent(null)}
                      aria-label="Clear customer"
                      className="ml-auto p-2 hover:bg-white/20 rounded-lg shrink-0 min-h-[44px] min-w-[44px] touch-manipulation"
                    >
                      <MaterialIcon icon="close" style={{ fontSize: 16 }} />
                    </button>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-end relative z-10">
                    <div>
                      <p className="text-[9px] font-black uppercase opacity-60 tracking-tighter mb-1">Wallet Balance</p>
                      <p className="text-xl font-black">UGX {student.balance.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                        Verified
                      </p>
                    </div>
                  </div>
                  {walletBlocked && (
                    <p role="alert" className="mt-3 text-xs font-bold text-amber-200">
                      Insufficient wallet balance for this order.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Cart Items */}
            <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6 gap-4 min-h-0">
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Order</h3>
                <p className="text-[10px] font-bold text-slate-400 italic">{cart.length} lines</p>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 min-h-0">
                {cart.map((item) => {
                  const draft = qtyDrafts[item.cartKey];
                  return (
                    <div
                      key={item.cartKey}
                      className="flex items-center gap-2 animate-in slide-in-from-right duration-300"
                    >
                      <div
                        className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-primary-800 font-bold text-xs ring-1 ring-slate-100 shrink-0"
                        aria-label={`${formatQty(item.quantity)} times ${item.name}`}
                      >
                        {formatQty(item.quantity)}x
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {item.name}
                          {item.variant ? ` · ${item.variant}` : ""}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold tracking-tighter">
                          UGX {Number(item.price || 0).toLocaleString()}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.cartKey, Math.round((item.quantity - 1) * 100) / 100)}
                            aria-label={`Decrease quantity of ${item.name}`}
                            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-95 touch-manipulation"
                          >
                            <MaterialIcon icon="remove" style={{ fontSize: 16 }} />
                          </button>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            min="0.5"
                            max={item.stock}
                            value={draft ?? formatQty(item.quantity)}
                            aria-label={`Quantity of ${item.name}`}
                            onFocus={(e) => {
                              setQtyDrafts((prev) => ({ ...prev, [item.cartKey]: formatQty(item.quantity) }));
                              requestAnimationFrame(() => e.target.select());
                            }}
                            onChange={(e) => setQtyDrafts((prev) => ({ ...prev, [item.cartKey]: e.target.value }))}
                            onBlur={(e) => commitQtyDraft(item.cartKey, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitQtyDraft(item.cartKey, (e.target as HTMLInputElement).value);
                              }
                            }}
                            className="w-16 px-1 py-1 text-center text-xs font-bold border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[36px]"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.cartKey, Math.round((item.quantity + 1) * 100) / 100)}
                            aria-label={`Increase quantity of ${item.name}`}
                            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 active:scale-95 touch-manipulation"
                          >
                            <MaterialIcon icon="add" style={{ fontSize: 16 }} />
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => requestRemove(item.cartKey, item.name)}
                        aria-label={`Remove ${item.name} from cart`}
                        className="p-2.5 text-slate-300 hover:text-red-500 transition-colors min-h-[44px] min-w-[44px] touch-manipulation"
                      >
                        <MaterialIcon icon="delete_outline" style={{ fontSize: 18 }} />
                      </button>
                    </div>
                  );
                })}
                {cart.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-2 py-12 opacity-30">
                    <MaterialIcon icon="shopping_basket" style={{ fontSize: 48 }} />
                    <p className="text-xs font-bold tracking-tight">Cart is empty</p>
                  </div>
                )}
              </div>
            </div>

            {/* Checkout Footer */}
            <div className="p-4 sm:p-6 bg-slate-50/50 space-y-4 shrink-0 border-t border-slate-100">
              <div
                className="flex bg-white rounded-2xl p-1 shadow-sm border border-slate-100"
                role="group"
                aria-label="Payment method"
              >
                <button
                  type="button"
                  onClick={() => setPaymentMethod("wallet")}
                  aria-pressed={paymentMethod === "wallet"}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 min-h-[44px] touch-manipulation ${paymentMethod === "wallet" ? "bg-primary-800 text-white shadow-md" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <MaterialIcon icon="account_balance_wallet" style={{ fontSize: 16 }} />
                  Wallet
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  aria-pressed={paymentMethod === "cash"}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 min-h-[44px] touch-manipulation ${paymentMethod === "cash" ? "bg-primary-800 text-white shadow-md" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <MaterialIcon icon="payments" style={{ fontSize: 16 }} />
                  Cash
                </button>
              </div>

              {paymentMethod === "cash" && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="pos-cash-tendered"
                    className="text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    Cash received (UGX)
                  </label>
                  <input
                    id="pos-cash-tendered"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder={`Exact: ${total.toLocaleString()}`}
                    className="w-full px-3 py-2.5 text-sm font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                  />
                  {tenderedValue !== null && total > 0 && (
                    <p
                      role="status"
                      className={`text-xs font-bold ${changeDue !== null && changeDue < 0 ? "text-red-600" : "text-emerald-600"}`}
                    >
                      {changeDue !== null && changeDue < 0
                        ? `Short by UGX ${Math.abs(changeDue).toLocaleString()} — cannot complete`
                        : `Change: UGX ${(changeDue || 0).toLocaleString()}`}
                    </p>
                  )}
                </div>
              )}
              {walletBlocked && (
                <p role="alert" className="text-xs font-bold text-red-600">
                  Wallet balance UGX {student?.balance.toLocaleString()} is below the total UGX {total.toLocaleString()}
                  .
                </p>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Grand Total</p>
                  <p className="text-2xl font-black text-slate-800">UGX {total.toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleQuickSale}
                    disabled={cart.length === 0 || loading}
                    title="QuickSale (F2): confirm with exact cash"
                    className="flex-1 py-4 px-2 rounded-2xl font-black uppercase tracking-wider text-xs border-2 border-primary-800 text-primary-800 hover:bg-primary-50 active:scale-[0.98] transition-all disabled:opacity-50 min-h-[52px] touch-manipulation"
                  >
                    QuickSale · F2
                  </button>
                  <button
                    ref={checkoutButtonRef}
                    type="button"
                    onClick={handleCompleteOrder}
                    disabled={cart.length === 0 || loading || cashBlocked || walletBlocked}
                    className="flex-[2] py-4 bg-primary-800 text-white rounded-2xl font-black uppercase tracking-[2px] shadow-xl shadow-primary-800/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 min-h-[52px] touch-manipulation"
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
                {(cashBlocked || walletBlocked) && (
                  <p role="alert" className="text-[11px] font-bold text-red-600 text-center">
                    {cashBlocked ? "Add enough cash to complete this order." : "Top up the wallet or switch to Cash."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm sale modal — returns to cart on cancel */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setShowConfirm(false);
              setConfirmError(null);
            }}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pos-confirm-title"
            className="relative w-full max-w-md max-h-[calc(100vh-1.5rem)] overflow-y-auto my-auto bg-white rounded-3xl shadow-2xl border border-slate-100"
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="pos-confirm-title" className="text-lg font-black text-slate-800">
                    Confirm sale
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">Review the order before recording it.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirm(false);
                    setConfirmError(null);
                  }}
                  aria-label="Back to cart"
                  className="p-2.5 hover:bg-slate-100 rounded-xl min-h-[44px] min-w-[44px] touch-manipulation"
                >
                  <MaterialIcon icon="close" className="text-slate-500" />
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {cart.map((line) => (
                  <div key={line.cartKey} className="flex justify-between gap-3 text-sm">
                    <p className="font-bold text-slate-700 truncate">
                      {formatQty(line.quantity)}× {line.name}
                      {line.variant ? ` · ${line.variant}` : ""}
                    </p>
                    <p className="font-black text-slate-800 shrink-0">
                      UGX {(line.price * line.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Payment</span>
                  <span className="font-black uppercase text-slate-800">{paymentMethod}</span>
                </div>
                {student && (
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-500">Customer</span>
                    <span className="font-bold text-slate-800 truncate ml-4">
                      {student.first_name} {student.last_name}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base">
                  <span className="font-black text-slate-500 uppercase">Total</span>
                  <span className="font-black text-slate-900">UGX {total.toLocaleString()}</span>
                </div>
                {paymentMethod === "cash" ? (
                  <>
                    <label
                      htmlFor="pos-confirm-tendered"
                      className="block text-[10px] font-black uppercase tracking-widest text-slate-400 pt-1"
                    >
                      Cash received (UGX)
                    </label>
                    <input
                      id="pos-confirm-tendered"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={cashTendered}
                      onChange={(e) => {
                        setCashTendered(e.target.value);
                        setConfirmError(null);
                      }}
                      className="w-full px-3 py-2.5 text-sm font-bold border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                    />
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-500">Change due</span>
                      <span
                        role="status"
                        className={`font-black ${(changeDue ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}`}
                      >
                        UGX {(changeDue ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-500">Wallet balance</span>
                    <span className="font-black text-slate-800">UGX {(student?.balance || 0).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {confirmError && (
                <p
                  role="alert"
                  className="text-sm font-bold text-red-600 rounded-xl bg-red-50 border border-red-100 px-3 py-2"
                >
                  {confirmError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirm(false);
                    setConfirmError(null);
                  }}
                  className="flex-1 py-3 rounded-2xl border-2 border-slate-200 font-black uppercase text-xs tracking-wider text-slate-600 hover:bg-slate-50 active:scale-[0.98] min-h-[48px] touch-manipulation"
                >
                  Back to cart
                </button>
                <button
                  type="button"
                  onClick={processSale}
                  disabled={loading || cashBlocked || walletBlocked}
                  className="flex-[2] py-3 rounded-2xl bg-primary-800 text-white font-black uppercase text-xs tracking-wider shadow-lg hover:bg-primary-900 active:scale-[0.98] disabled:opacity-50 min-h-[48px] touch-manipulation flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Confirm & record"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmRemove}
        title="Remove from cart?"
        message={pendingDelete ? `Remove ${pendingDelete.name} from this order? This cannot be undone.` : ""}
        confirmLabel="Remove"
        cancelLabel="Keep"
        variant="danger"
      />

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-start sm:justify-center overflow-y-auto p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Scan Student ID</h3>
              <button
                type="button"
                onClick={stopScanner}
                aria-label="Close scanner"
                className="p-2.5 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] touch-manipulation"
              >
                <MaterialIcon icon="close" className="text-slate-500" />
              </button>
            </div>
            <div className="p-4">
              {scannerError ? (
                <div className="text-center py-8">
                  <MaterialIcon icon="error" className="text-red-500 text-4xl mb-3" />
                  <p className="text-red-600 font-medium">{scannerError}</p>
                  <p className="text-sm text-slate-500 mt-2">Make sure you have granted camera permission.</p>
                </div>
              ) : (
                <div id="canteen-qr-reader" className="w-full aspect-square bg-slate-900 rounded-xl overflow-hidden" />
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
