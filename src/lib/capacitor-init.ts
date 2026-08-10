// Mobile App Initialization
// Runs when the app is launched on Android or iOS

import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { PushNotifications } from "@capacitor/push-notifications";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { logger } from "./logger";

const HAPTIC_SELECTOR = [
  ".mobile-nav-fab",
  ".mobile-nav-item",
  ".mobile-bottom-nav",
  "[data-haptic]",
  'button[type="submit"]',
].join(", ");

export async function initCapacitor() {
  if (typeof window === "undefined") return;

  try {
    // Set status bar style
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#001F3F" });

    // Hide splash screen as soon as the app is interactive, not after a fixed 3s
    SplashScreen.hide();

    // Push notification setup
    await setupPushNotifications();

    // App lifecycle events
    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        logger.debug("App resumed");
      }
    });

    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    // Haptic feedback ONLY on meaningful actions — not every tap.
    // Every-button haptics feel noisy and cheap; reserve them for primary
    // navigation and destructive/confirming CTAs.
    document.addEventListener("click", (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isHaptic = target.matches?.(HAPTIC_SELECTOR) || target.closest?.(HAPTIC_SELECTOR);
      if (isHaptic) {
        Haptics.impact({ style: ImpactStyle.Light });
      }
    });
  } catch (error) {
    logger.warn("Capacitor init error:", error);
  }
}

async function setupPushNotifications() {
  try {
    // Request permission
    const permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive !== "granted") {
      logger.debug("Push notification permission not granted");
      return;
    }

    // Register with APNS/FCM
    await PushNotifications.register();

    // Listen for token
    PushNotifications.addListener("registration", (token) => {
      logger.debug("Push registration success");
      savePushToken(token.value);
    });

    // Listen for push received
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      logger.debug("Push received:", notification);
    });

    // Listen for push action performed
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      logger.debug("Push action:", action);
      // Navigate based on notification data
      const data = action.notification.data;
      if (data.route) {
        window.location.href = data.route;
      }
    });
  } catch (error) {
    logger.warn("Push notification setup failed:", error);
  }
}

async function savePushToken(token: string) {
  try {
    const { supabase } = await import("@/lib/supabase");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint: token,
      keys: {},
    });
  } catch (error) {
    logger.error("Failed to save push token:", error);
  }
}
