// Web Push (PWA) client helpers using the web-push VAPID flow.
// Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY in env.

export function isWebPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function subscribeWebPush(userId: string): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      }));

    // Save to DB (reuse push_subscriptions table)
    await fetch("/api/push/subscribe/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, subscription: subscription.toJSON() }),
    });

    return subscription;
  } catch (error) {
    const { logger } = await import("./logger");
    logger.error("Web push subscription failed:", error);
    return null;
  }
}

export async function sendWebPush(
  subscription: any,
  payload: { title: string; body: string; url?: string; tag?: string },
) {
  return fetch("/api/push/send/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription,
      title: payload.title,
      message: payload.body,
      url: payload.url,
      tag: payload.tag,
    }),
  });
}
