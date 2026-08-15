"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";
import { logger } from "./logger";
import { withTimeout, timeoutFallback } from "./hooks/utils";

interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error" | "student" | "payment" | "attendance" | "grade";
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
  data?: Record<string, any>;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Omit<Notification, "id" | "read" | "created_at">) => void;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({
  children,
  schoolId: propSchoolId,
}: {
  children: ReactNode;
  schoolId?: string;
}) {
  const { school, user } = useAuth();
  const schoolId = propSchoolId || school?.id;
  const userRole = user?.role;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const NOTIFICATIONS_READ_KEY = `skoolmate-notifications-read-${schoolId || "none"}`;

  const loadReadIds = useCallback((): string[] => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_READ_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, [NOTIFICATIONS_READ_KEY]);

  const saveReadIds = useCallback(
    (ids: string[]) => {
      if (typeof window === "undefined") return;
      try {
        localStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify(ids));
      } catch {
        // localStorage may be full or unavailable
      }
    },
    [NOTIFICATIONS_READ_KEY],
  );

  const fetchNotifications = useCallback(async () => {
    if (!schoolId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const readIds = loadReadIds();
      const generated: Notification[] = [];
      const today = new Date().toISOString().slice(0, 10);

      const canSeeFees = userRole !== "teacher" && userRole !== "parent";

      // Parents get their own lightweight feed — never pull the entire school's
      // students/attendance tables onto a phone on 3G.
      if (userRole === "parent" && user?.id) {
        try {
          const { data: parentNotifs, error: parentErr } = await withTimeout(
            supabase
              .from("parent_notifications")
              .select("id, type, title, message, is_read, action_url, created_at")
              .eq("parent_id", user.id)
              .order("created_at", { ascending: false })
              .limit(20),
            12000,
            timeoutFallback(),
          );
          if (parentErr) throw parentErr;
          const typeMap: Record<string, Notification["type"]> = {
            grade_posted: "grade",
            payment_received: "payment",
            attendance_alert: "attendance",
            fee_due: "warning",
            report_card: "grade",
            message: "info",
            general: "info",
          };
          setNotifications(
            ((parentNotifs as any[]) || []).map((n) => ({
              id: n.id,
              type: typeMap[n.type] || "info",
              title: n.title || "Notification",
              message: n.message || "",
              read: !!n.is_read,
              link: n.action_url || undefined,
              created_at: n.created_at,
            })),
          );
        } catch (err) {
          logger.warn("[notifications] parent feed failed", err);
          setNotifications([]);
        }
        setLoading(false);
        return;
      }

      const { data: schoolStudents, error: schoolStudentsError } = await supabase
        .from("students")
        .select("id, status")
        .eq("school_id", schoolId);

      if (schoolStudentsError) throw schoolStudentsError;

      const schoolStudentIds = (schoolStudents || []).map((student) => student.id);
      const activeStudentIds = (schoolStudents || [])
        .filter((student) => student.status === "active")
        .map((student) => student.id);

      try {
        let absentStudents: Array<{ student_id: string }> = [];
        if (schoolStudentIds.length > 0) {
          const { data, error } = await supabase
            .from("attendance")
            .select("student_id")
            .in("student_id", schoolStudentIds)
            .eq("date", today)
            .eq("status", "absent");
          if (error) throw error;
          absentStudents = data || [];
        }

        if (absentStudents?.length) {
          generated.push({
            id: "absent-today",
            type: "attendance",
            title: `${absentStudents.length} students absent today`,
            message: "Tap to review attendance details",
            link: "/dashboard/attendance",
            read: readIds.includes("absent-today"),
            created_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        logger.error("Attendance notification check failed:", err);
      }

      if (canSeeFees) {
        try {
          const [{ data: feeStructure, error: feeError }, { data: payments, error: paymentsError }] = await Promise.all(
            [
              supabase.from("fee_structure").select("amount").eq("school_id", schoolId),
              activeStudentIds.length > 0
                ? supabase.from("fee_payments").select("amount_paid").in("student_id", activeStudentIds)
                : Promise.resolve({ data: [], error: null }),
            ],
          );

          if (feeError) throw feeError;
          if (paymentsError) throw paymentsError;

          const totalExpected =
            (feeStructure || []).reduce((sum, fee) => sum + Number(fee.amount || 0), 0) * activeStudentIds.length;
          const totalCollected = (payments || []).reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);
          const balance = totalExpected - totalCollected;

          if (balance > 0) {
            generated.push({
              id: "outstanding-fees",
              type: "warning",
              title: `UGX ${balance.toLocaleString()} outstanding fees`,
              message: "Tap to review fee collection",
              link: "/dashboard/fees",
              read: readIds.includes("outstanding-fees"),
              created_at: new Date().toISOString(),
            });
          }
        } catch (err) {
          logger.error("Fee notification check failed:", err);
        }
      }

      if (generated.length === 0) {
        generated.push({
          id: "welcome",
          type: "info",
          title: "Welcome to SkoolMate OS!",
          message: "Start by adding students and taking attendance",
          link: "/dashboard/students",
          read: readIds.includes("welcome"),
          created_at: new Date().toISOString(),
        });
      }

      setNotifications(generated);
    } catch (error) {
      logger.error("Error fetching notifications:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId, userRole, loadReadIds]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
      const readIds = loadReadIds();
      if (!readIds.includes(id)) {
        readIds.push(id);
        saveReadIds(readIds);
      }
    },
    [loadReadIds, saveReadIds],
  );

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => {
      const allIds = prev.map((item) => item.id);
      saveReadIds(allIds);
      return prev.map((item) => ({ ...item, read: true }));
    });
  }, [saveReadIds]);

  const addNotification = useCallback((notification: Omit<Notification, "id" | "read" | "created_at">) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}`,
      read: false,
      created_at: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotification, ...prev]);
  }, []);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        addNotification,
        refresh: fetchNotifications,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error("useNotifications must be used within NotificationsProvider");
  return context;
}
