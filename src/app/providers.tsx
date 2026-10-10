"use client";
import { ReactNode, useEffect } from "react";
import BrandProvider from "@/components/BrandProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";
import { StuckLoadingOverlay } from "@/components/ui/Skeleton";
import { AcademicProvider } from "@/lib/academic-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { setupErrorLogging } from "@/lib/error-logger";
import { logger } from "@/lib/logger";
import { NotificationsProvider } from "@/lib/notifications";
import { ThemeProvider } from "@/lib/theme-context";
import ForcePasswordChangeGate from "@/components/ForcePasswordChangeGate";
import { ReactQueryProvider } from "./providers/ReactQueryProvider";

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

      const reloadForActivatedUpdate = () => {
        if (!shouldForceAuthRouteUpdate || hasReloadedForUpdate) return;
        if (!hadControllerAtStart) return;
        hasReloadedForUpdate = true;
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener("controllerchange", reloadForActivatedUpdate);

      let registration: ServiceWorkerRegistration | null = null;

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

          if (reg.waiting) {
            if (shouldForceAuthRouteUpdate) {
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
                if (shouldForceAuthRouteUpdate) {
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
        document.removeEventListener("visibilitychange", handleVisibility);
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

function LoadingChecker({ children }: { children: ReactNode }) {
  const { authInitialized } = useAuth();

  if (!authInitialized) {
    return (
      <>
        {children}
        <StuckLoadingOverlay delay={12000} />
      </>
    );
  }

  return <>{children}</>;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ReactQueryProvider>
        <ToastProvider>
          <ThemeProvider>
            <ServiceWorkerRegistration>
              <AuthProvider>
                <ForcePasswordChangeGate />
                <LoadingChecker>
                  <MobileKeyboardHandler />
                  <FaviconUpdater />
                  <AcademicProvider>
                    <BrandProvider>
                      <NotificationsProvider>{children}</NotificationsProvider>
                    </BrandProvider>
                  </AcademicProvider>
                </LoadingChecker>
              </AuthProvider>
            </ServiceWorkerRegistration>
          </ThemeProvider>
        </ToastProvider>
      </ReactQueryProvider>
    </ErrorBoundary>
  );
}
