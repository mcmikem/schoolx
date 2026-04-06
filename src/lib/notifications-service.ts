// Push Notification Service
// Handles push notifications for Parent Portal (smartphone users)

import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

// Check if notifications are supported
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "Notification" in window && "serviceWorker" in navigator;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    console.warn("Push notifications not supported");
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return "denied";
  }
}

// Get current permission status
export function getNotificationPermission(): NotificationPermission | null {
  if (typeof window === "undefined") return null;
  return Notification.permission;
}

// Subscribe to push notifications
export async function subscribeToPush(
  userId: string,
): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;

    // For development/testing without VAPID key
    if (!VAPID_PUBLIC_KEY) {
      console.warn("VAPID key not configured - push disabled");
      return null;
    }

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // Save subscription to database
    await savePushSubscription(userId, subscription);

    console.log("Push subscription successful");
    return subscription;
  } catch (error) {
    console.error("Push subscription failed:", error);
    return null;
  }
}

// Unsubscribe from push
export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await removePushSubscription(userId);
    }

    return true;
  } catch (error) {
    console.error("Unsubscribe failed:", error);
    return false;
  }
}

// Save subscription to database
async function savePushSubscription(
  userId: string,
  subscription: PushSubscription,
) {
  const subscriptionData = {
    user_id: userId,
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.toJSON().keys?.p256dh,
      auth: subscription.toJSON().keys?.auth,
    },
  };

  await supabase
    .from("push_subscriptions")
    .upsert(subscriptionData, { onConflict: "user_id" });
}

// Remove subscription from database
async function removePushSubscription(userId: string) {
  await supabase.from("push_subscriptions").delete().eq("user_id", userId);
}

// Utility: Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): ArrayBuffer | null {
  if (!base64String) return null;

  try {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray.buffer as ArrayBuffer;
  } catch {
    return null;
  }
}

// Show local notification (for testing)
export function showLocalNotification(
  title: string,
  options?: NotificationOptions,
) {
  if (Notification.permission === "granted") {
    new Notification(title, {
      icon: "/SkoolMate logos/SchoolMate icon.svg",
      badge: "/SkoolMate logos/SchoolMate icon.svg",
      ...options,
    });
  }
}

// Notification types for the app
export type NotificationType =
  | "fee_reminder"
  | "attendance_alert"
  | "grade_posted"
  | "message_received"
  | "report_available"
  | "event_notification";

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Create notification payload based on type
export function createNotificationPayload(
  type: NotificationType,
  data: Record<string, unknown>,
): NotificationPayload {
  const payloads: Record<
    NotificationType,
    { title: string; body: (data: Record<string, unknown>) => string }
  > = {
    fee_reminder: {
      title: "Fee Payment Reminder",
      body: (d) =>
        `Balance: UGX ${d.balance?.toLocaleString()}. Due: ${d.due_date}`,
    },
    attendance_alert: {
      title: "Attendance Alert",
      body: (d) => `${d.child_name} was marked ${d.status} on ${d.date}`,
    },
    grade_posted: {
      title: "New Grade Posted",
      body: (d) => `${d.child_name} scored ${d.score}% in ${d.subject}`,
    },
    message_received: {
      title: "New Message from School",
      body: (d) => `${String(d.message || "").substring(0, 50)}...`,
    },
    report_available: {
      title: "Report Card Available",
      body: (d) => `${d.child_name}'s ${d.term} report is now available`,
    },
    event_notification: {
      title: "School Event",
      body: (d) => d.event_name as string,
    },
  };

  const { title, body } = payloads[type];
  return {
    type,
    title,
    body: body(data),
    data,
  };
}

// Test notification
export function sendTestNotification() {
  showLocalNotification("SkoolMate OS Notifications", {
    body: "Push notifications are working!",
    icon: "/SkoolMate logos/SchoolMate icon.svg",
  });
}
