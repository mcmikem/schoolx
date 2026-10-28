"use client";
import dynamic from "next/dynamic";
import { ReactNode, useEffect, useState } from "react";
import BrandProvider from "@/components/BrandProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { setupErrorLogging } from "@/lib/error-logger";
import { logger } from "@/lib/logger";
import { offlineDB } from "@/lib/offline";
import { clearOfflineQueryCache, installOfflineApiFetch, setOfflineCacheUser } from "@/lib/offline-query-cache";
import { OfflineDataWarmer } from "@/lib/offline-data-warmer";
import { OfflineRouteWarmer } from "@/lib/offline-route-warmer";
import { supabase } from "@/lib/supabase";
import { ThemeProvider } from "@/lib/theme-context";
import CommCenter from "@/components/owly/CommCenter";

const ForcePasswordChangeGate = dynamic(() => import("@/components/ForcePasswordChangeGate"), { ssr: false });
const StuckLoadingOverlay = dynamic(
  () => import("@/components/ui/Skeleton").then((module) => module.StuckLoadingOverlay),
  { ssr: false, loading: () => null },
);

function FaviconUpdater() {
  const { school } = useAuth();

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!school?.logo_url) return;

    const iconUrl = school.logo_url;

    const setOrUpdate = (selector: string, attr: string, value: string) => {
      let el = document.querySelector<HTMLLinkElement | HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement(attr === "href" ? "link" : "meta");
        if (attr === "href") (el as HTMLLinkElement).rel = selector.includes("apple") ? "apple-touch-icon" : "icon";
        if (attr === "content") (el as HTMLMetaElement).name = selector.match(/name="([^"]+)"/)?.[1] || "";
        document.head.appendChild(el);
      }
      if (attr in el) (el as any)[attr] = value;
    };

    setOrUpdate('link[rel="icon"]', "href", iconUrl);
    setOrUpdate('link[rel="apple-touch-icon"]', "href", iconUrl);

    if (school.primary_color) {
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (meta) meta.content = school.primary_color;
    }

    const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
    if (ogImage) ogImage.content = iconUrl;
    const twitterImage = document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]');
    if (twitterImage) twitterImage.content = iconUrl;
  }, [school?.logo_url, school?.primary_color]);

  return null;
}

function ServiceWorkerRegistration({ children }: { children: ReactNode }) {
  // The shell routes behind the offline app are warmed by the service worker
  // at install — but an install that ran while nobody was signed in caches
  // nothing (every dashboard document redirects to /login, and the guard
  // correctly skips redirects). Her PAGE cache then held only the login page,
  // and offline the app fell over to the fallback screen. Warming on sign-in
  // (and whenever the device finds data again) re-fills those routes with the
  // current session. Idempotent: every attempt is a guarded fetch.
  const postWarmShell = () => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const controller = navigator.serviceWorker.controller;
    if (controller) controller.postMessage({ type: "WARM_SHELL" });
  };

  useEffect(() => {
    // The offline read cache is scoped by user id, but the rows themselves
    // stay on disk until someone removes them. A shared staff phone changes
    // hands between sessions, so sign-out has to wipe it.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setOfflineCacheUser(null);
        void clearOfflineQueryCache();
        // Cached rows are not scoped by user, and a shared staff phone changes
        // hands. Pending writes stay queued for the account that made them.
        void offlineDB.clearCachedData().catch((error) => logger.warn("[offline] could not clear cached rows", error));
      }
      if (event === "SIGNED_IN") {
        postWarmShell();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setupErrorLogging();
    // Keep the PWA worker out of local development. Next.js HMR owns reloads
    // there, while a stale worker can serve old chunks and trigger update loops.
    if (process.env.NODE_ENV !== "production") {
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        });
      }
      return;
    }
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const authRoutePattern = /^\/(login|register|forgot-password)(\/|$)/;
      const shouldForceAuthRouteUpdate = authRoutePattern.test(window.location.pathname);
      // On the very first install there is no prior controller, so the
      // controllerchange fired by clients.claim() only reflects the initial
      // claim — force-reloading then would wipe any input the user has started
      // (e.g. the login form) and makes e2e tests flaky on slow runners. Only
      // reload when an actual update (a newer SW replacing an existing one)
      // takes over.
      const hadControllerAtStart = !!navigator.serviceWorker.controller;
      let hasReloadedForUpdate = false;

      // Applying an update reloads the document. That is fine on a sign-in
      // page nobody has touched, but destructive once the user has started
      // typing: the reload wipes the form and they are left on "Checking your
      // session…" instead of signed in. Only force it before any interaction.
      // After that the update banner lets them choose, and the network-first
      // navigation guarantees the next load is the current build.
      let userInteracted = false;
      const markInteraction = () => {
        userInteracted = true;
      };
      window.addEventListener("pointerdown", markInteraction, { capture: true, once: true });
      window.addEventListener("keydown", markInteraction, { capture: true, once: true });

      const reloadForActivatedUpdate = () => {
        if (!shouldForceAuthRouteUpdate || hasReloadedForUpdate || userInteracted) return;
        if (!hadControllerAtStart) return;
        hasReloadedForUpdate = true;
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener("controllerchange", reloadForActivatedUpdate);

      let registration: ServiceWorkerRegistration | null = null;
      // Set inside the SW registration promise, referenced by the cleanup.
      const onlineHandlerRef: { current: (() => void) | null } = { current: null };

      // Announce a pending update to the UI. Fired both when a worker finishes
      // installing and when one is already waiting at load, so a prompt is never
      // missed because the app mounted after the update landed.
      const announceUpdate = (reg: ServiceWorkerRegistration) => {
        if (!reg.waiting) return;
        window.dispatchEvent(new CustomEvent("sw-update-available", { detail: { registration: reg } }));
      };

      navigator.serviceWorker
        .register("/sw.js")
        .then(async (reg) => {
          registration = reg;
          logger.log("Service Worker registered:", reg.scope);
          await reg.update().catch((err) => logger.warn("[SW] Update failed", err));

          // The worker may still have been warming during a logged-out
          // install: once it is active, try again from the signed-in side.
          // And on a connection returning, refill anything that failed before.
          const warmShellNow = () => {
            (reg.active || navigator.serviceWorker.controller)?.postMessage({ type: "WARM_SHELL" });
          };
          warmShellNow();
          const handleOnline = () => warmShellNow();
          onlineHandlerRef.current = handleOnline;
          window.addEventListener("online", handleOnline);

          if (reg.waiting) {
            if (shouldForceAuthRouteUpdate && !userInteracted) {
              reg.waiting.postMessage({ type: "APPLY_UPDATE" });
            } else {
              announceUpdate(reg);
            }
          }

          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                if (shouldForceAuthRouteUpdate && !userInteracted) {
                  newWorker.postMessage({ type: "APPLY_UPDATE" });
                  return;
                }
                // Let the user decide when to reload rather than forcing it
                // mid-session, which can steal Supabase auth Web Locks.
                announceUpdate(reg);
              }
            });
          });
        })
        .catch((error) => {
          logger.error("Service Worker registration failed:", error);
        });

      // A long-lived install can stay open for days. Re-check on a timer and
      // whenever the app is brought back to the foreground, otherwise a newly
      // deployed build is not noticed until the tab is fully closed and reopened.
      const checkForUpdate = () => {
        if (!registration) return;
        void registration
          .update()
          .then(() => announceUpdate(registration as ServiceWorkerRegistration))
          .catch((err) => logger.warn("[SW] Update check failed", err));
      };

      const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
      const interval = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

      const handleVisibility = () => {
        if (document.visibilityState === "visible") checkForUpdate();
      };
      document.addEventListener("visibilitychange", handleVisibility);

      // Check once shortly after load so a build deployed while the app was
      // opening is still picked up.
      const initialCheck = setTimeout(checkForUpdate, 5000);

      return () => {
        navigator.serviceWorker.removeEventListener("controllerchange", reloadForActivatedUpdate);
        window.removeEventListener("pointerdown", markInteraction, { capture: true });
        window.removeEventListener("keydown", markInteraction, { capture: true });
        document.removeEventListener("visibilitychange", handleVisibility);
        if (onlineHandlerRef.current) window.removeEventListener("online", onlineHandlerRef.current);
        clearInterval(interval);
        clearTimeout(initialCheck);
      };
    }
  }, []);
  return <>{children}</>;
}

function MobileKeyboardHandler() {
  useEffect(() => {
    const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isMobile) return;

    let activeEl: Element | null = null;
    let rafId: number | null = null;

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        activeEl = target;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          target.scrollIntoView({ block: "center", behavior: "smooth" });
          rafId = null;
        });
      }
    };

    const onFocusOut = () => {
      activeEl = null;
    };

    const onVisualViewportChange = () => {
      if (activeEl && window.visualViewport) {
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        if (keyboardHeight > 100) {
          activeEl.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onVisualViewportChange);
    }

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", onVisualViewportChange);
      }
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
  return null;
}

function OfflineCacheScope() {
  const { user } = useAuth();

  useEffect(() => {
    setOfflineCacheUser(user?.id);
  }, [user?.id]);

  useEffect(() => installOfflineApiFetch(), []);

  useEffect(() => {
    // Best-effort: browsers may evict IndexedDB and Cache Storage under
    // pressure, which is exactly the offline copy a rural school depends on.
    // Ask once at load and again on the first real interaction (some browsers
    // only grant it after engagement).
    let asked = false;
    const ask = () => {
      if (asked) return;
      asked = true;
      if (typeof navigator === "undefined" || typeof navigator.storage?.persist !== "function") return;
      void navigator.storage.persist().catch(() => {});
    };
    ask();
    window.addEventListener("pointerdown", ask, { once: true, capture: true });
    window.addEventListener("keydown", ask, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", ask, { capture: true });
      window.removeEventListener("keydown", ask, { capture: true });
    };
  }, []);

  return null;
}

function LoadingChecker({ children }: { children: ReactNode }) {
  const { authInitialized, user } = useAuth();
  const [showStuckLoading, setShowStuckLoading] = useState(false);

  useEffect(() => {
    if (authInitialized) {
      setShowStuckLoading(false);
      return;
    }
    const timer = window.setTimeout(() => setShowStuckLoading(true), 12000);
    return () => window.clearTimeout(timer);
  }, [authInitialized]);

  if (!authInitialized) {
    return (
      <>
        {children}
        {showStuckLoading && <StuckLoadingOverlay delay={0} />}
      </>
    );
  }

  return (
    <>
      {children}
      {user && <ForcePasswordChangeGate />}
    </>
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ThemeProvider>
          <ServiceWorkerRegistration>
            <AuthProvider>
              <LoadingChecker>
                <MobileKeyboardHandler />
                <OfflineCacheScope />
                <OfflineRouteWarmer />
                <OfflineDataWarmer />
                <FaviconUpdater />
                <CommCenter />
                <BrandProvider>{children}</BrandProvider>
              </LoadingChecker>
            </AuthProvider>
          </ServiceWorkerRegistration>
        </ThemeProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
