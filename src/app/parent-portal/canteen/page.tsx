"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { useToast } from "@/components/Toast";
import ParentPortalShell from "@/components/parent-portal/ParentPortalShell";
import {
  mapParentStudentLinks,
  ParentPortalChild,
  resolveSelectedChild,
} from "@/lib/parent-portal";
import { getDemoChildren } from "@/lib/parent-portal-demo";
import { withTimeout } from "@/lib/hooks/utils";

interface CanteenItem {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  is_active: boolean;
  image_url?: string | null;
}

interface CartItem {
  item: CanteenItem;
  quantity: number;
}

const DEMO_CANTEEN_ITEMS: CanteenItem[] = [
  { id: "demo-item-1", name: "Chapati", category: "food", price: 1500, stock: 50, unit: "pieces", is_active: true },
  { id: "demo-item-2", name: "Samosa", category: "snack", price: 1000, stock: 40, unit: "pieces", is_active: true },
  { id: "demo-item-3", name: "Rolex", category: "food", price: 3000, stock: 30, unit: "pieces", is_active: true },
  { id: "demo-item-4", name: "Juice", category: "drink", price: 2000, stock: 60, unit: "packs", is_active: true },
  { id: "demo-item-5", name: "Water", category: "drink", price: 1000, stock: 100, unit: "bottles", is_active: true },
  { id: "demo-item-6", name: "Cake", category: "snack", price: 2500, stock: 20, unit: "pieces", is_active: true },
];

export default function ParentCanteenPage() {
  const { user, isDemo } = useAuth();
  const toast = useToast();
  const [children, setChildren] = useState<ParentPortalChild[]>([]);
  const [selectedChild, setSelectedChild] = useState<ParentPortalChild | null>(null);
  const [items, setItems] = useState<CanteenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  const fetchChildren = useCallback(async () => {
    if (isDemo) {
      setChildren(getDemoChildren());
      return;
    }
    const parentId = user?.id;
    if (!parentId) return;
    const { data } = await supabase
      .from("parent_students")
      .select("student:students(id, first_name, last_name, school_id, class_id, class:classes(name))")
      .eq("parent_id", parentId);
    setChildren(mapParentStudentLinks(data || []));
  }, [user?.id, isDemo]);

  useEffect(() => {
    setSelectedChild((current) => resolveSelectedChild(children, current?.id));
  }, [children]);

  const fetchItems = useCallback(
    async (child: ParentPortalChild | null) => {
      const scopedChild = resolveSelectedChild(children, child?.id);
      if (!scopedChild || !scopedChild.school_id) return;
      setLoading(true);

      if (isDemo) {
        setItems(DEMO_CANTEEN_ITEMS);
        setLoading(false);
        return;
      }

      const { data } = await withTimeout(
        supabase
          .from("canteen_items")
          .select("*")
          .eq("school_id", scopedChild.school_id)
          .eq("is_active", true)
          .order("name", { ascending: true }),
        10000,
        { data: null, error: null } as any,
      );
      setItems((data as CanteenItem[]) || []);
      setLoading(false);
    },
    [isDemo, children],
  );

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  useEffect(() => {
    if (selectedChild) {
      fetchItems(selectedChild);
      setCart([]);
    }
  }, [selectedChild, fetchItems]);

  const addToCart = (item: CanteenItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === itemId);
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        return prev.filter((c) => c.item.id !== itemId);
      }
      return prev.map((c) =>
        c.item.id === itemId ? { ...c, quantity: c.quantity - 1 } : c,
      );
    });
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0);

  const placeOrder = async () => {
    if (!selectedChild || cart.length === 0) return;
    setPlacing(true);

    const orderItems = cart.map((c) => ({
      item_id: c.item.id,
      name: c.item.name,
      quantity: c.quantity,
      price: c.item.price,
    }));

    if (isDemo) {
      await new Promise((r) => setTimeout(r, 800));
      toast.success(`Demo order placed for ${selectedChild.first_name}! Total: UGX ${cartTotal.toLocaleString()}`);
      setCart([]);
      setPlacing(false);
      return;
    }

    try {
      const { error } = await withTimeout(
        supabase.from("canteen_orders").insert({
          school_id: selectedChild.school_id,
          student_id: selectedChild.id,
          items: orderItems,
          total: cartTotal,
          status: "pending",
        }),
        10000,
        { error: new Error("Request timed out") } as any,
      );
      if (error) throw error;
      toast.success("Order placed successfully!");
      setCart([]);
    } catch (err) {
      toast.error("Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <ParentPortalShell pageTitle="Canteen">
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
        <PageHeader
          title="Canteen Pre-Order"
          subtitle="Browse available items and pre-order meals for your child"
          variant="premium"
        />

        {children.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child)}
                className={`rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all border ${
                  selectedChild?.id === child.id
                    ? "bg-[var(--primary)] text-[var(--on-primary)] border-transparent shadow-[0_12px_24px_rgba(0,92,230,0.18)]"
                    : "bg-white text-[var(--on-surface-variant)] border-[var(--border)] hover:bg-[var(--surface-container-low)]"
                }`}
              >
                {child.first_name} {child.last_name}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-40 bg-[var(--surface-container)] rounded-2xl animate-pulse" />
            ))
          ) : items.length === 0 ? (
            <div className="col-span-full">
              <Card>
                <CardBody>
                  <div className="text-center py-8">
                    <MaterialIcon icon="restaurant" className="text-4xl text-[var(--on-surface-variant)] mb-2" />
                    <p className="text-[var(--on-surface-variant)] font-medium">No canteen items available</p>
                  </div>
                </CardBody>
              </Card>
            </div>
          ) : (
            items.map((item) => {
              const inCart = cart.find((c) => c.item.id === item.id);
              return (
                <Card key={item.id}>
                  <CardBody>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-[var(--on-surface)]">{item.name}</h3>
                        <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full bg-[var(--surface-container-low)] border border-[var(--border)] text-[10px] font-bold uppercase tracking-wider text-[var(--on-surface-variant)]">
                          {item.category}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-black text-[var(--primary)]">
                          UGX {item.price.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-[var(--on-surface-variant)] mt-0.5">
                          Stock: {item.stock} {item.unit}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)]">
                      {inCart ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="w-8 h-8 rounded-full bg-[var(--surface-container-low)] border border-[var(--border)] flex items-center justify-center hover:bg-[var(--surface-container)] transition-colors"
                          >
                            <MaterialIcon icon="remove" className="text-sm" />
                          </button>
                          <span className="text-sm font-bold text-[var(--on-surface)] min-w-[20px] text-center">
                            {inCart.quantity}
                          </span>
                          <button
                            onClick={() => addToCart(item)}
                            className="w-8 h-8 rounded-full bg-[var(--surface-container-low)] border border-[var(--border)] flex items-center justify-center hover:bg-[var(--surface-container)] transition-colors"
                          >
                            <MaterialIcon icon="add" className="text-sm" />
                          </button>
                        </div>
                      ) : (
                        <Button size="sm" onClick={() => addToCart(item)}>
                          <MaterialIcon icon="add_shopping_cart" className="mr-1" />
                          Add to Order
                        </Button>
                      )}
                    </div>
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>

        {cart.length > 0 && (
          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[var(--on-surface)] flex items-center gap-2">
                  <MaterialIcon icon="shopping_cart" />
                  Order Basket
                </h3>
                <span className="text-sm text-[var(--on-surface-variant)]">
                  {cart.reduce((sum, c) => sum + c.quantity, 0)} items
                </span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {cart.map((c) => (
                  <div key={c.item.id} className="flex items-center justify-between py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--on-surface)]">{c.item.name}</p>
                      <p className="text-[11px] text-[var(--on-surface-variant)]">
                        UGX {c.item.price.toLocaleString()} x {c.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-sm font-bold text-[var(--on-surface)]">
                        UGX {(c.item.price * c.quantity).toLocaleString()}
                      </p>
                      <button
                        onClick={() => removeFromCart(c.item.id)}
                        className="text-[var(--on-surface-variant)] hover:text-red-500 transition-colors"
                      >
                        <MaterialIcon icon="delete" className="text-lg" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-4 mt-2 border-t border-[var(--border)]">
                <span className="text-base font-bold text-[var(--on-surface)]">Total</span>
                <span className="text-xl font-black text-[var(--primary)]">
                  UGX {cartTotal.toLocaleString()}
                </span>
              </div>
              <Button
                className="w-full mt-4"
                size="lg"
                onClick={placeOrder}
                disabled={placing}
              >
                {placing ? (
                  <span className="flex items-center gap-2">
                    <MaterialIcon icon="sync" className="animate-spin" />
                    Placing Order...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <MaterialIcon icon="check_circle" />
                    Place Order
                  </span>
                )}
              </Button>
            </CardBody>
          </Card>
        )}
      </div>
    </ParentPortalShell>
  );
}
