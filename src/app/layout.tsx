import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./globals-ux.css";
import "./mobile-responsive.css";
import Providers from "./providers";
import MobileInit from "./mobile-init";
import DebugPing from "@/components/DebugPing";
import { Analytics } from "@/components/Analytics";
import { AppTracker } from "@/components/AppTracker";
import Script from "next/script";
import { Suspense } from "react";
import { logger } from "@/lib/logger";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://omuto.org"),
  title: `${APP_NAME} | Your Digital School Partner`,
  description:
    "The all-in-one school management system built for Ugandan schools. Track attendance, grades, fees, and send parent SMS — all from one dashboard. Start your free 30-day trial today.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-512x512.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  openGraph: {
    title: `${APP_NAME} | Your Digital School Partner`,
    description:
      "Attendance, grades, fees, and parent SMS — all in one system built for Ugandan schools. Start your free 30-day trial.",
    type: "website",
    url: "https://omuto.org",
    locale: "en_UG",
    siteName: APP_NAME,
    images: [
      {
        url: "/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: APP_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} | Your Digital School Partner`,
    description: "Run your entire school from one dashboard. Attendance, grades, fees, and parent SMS.",
    images: ["/icons/icon-512x512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#001F3F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts — single request to reduce latency */}
        {}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <>
            <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
          </>
        )}
        <link
          rel="preload"
          as="style"
          crossOrigin="anonymous"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=Sora:wght@300;400;500;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=Sora:wght@300;400;500;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/icons/icon-512x512.png" type="image/png" />
      </head>
      <body
        className="antialiased min-h-screen"
        style={{
          backgroundColor: "var(--bg)",
          color: "var(--t1)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {process.env.NODE_ENV !== "production" && (
          <Script
            id="dev-sw-reset"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function () {
                  try {
                    if (!('serviceWorker' in navigator)) return;
                    navigator.serviceWorker.getRegistrations().then(function (registrations) {
                      registrations.forEach(function (registration) {
                        registration.unregister();
                      });
                    }).catch(function () {});
                    if ('caches' in window) {
                      caches.keys().then(function (keys) {
                        keys.forEach(function (key) {
                          if (key.indexOf('skoolmate-') === 0) {
                            caches.delete(key);
                          }
                        });
                      }).catch(function () {});
                    }
                  } catch (e) {}
                })();
              `,
            }}
          />
        )}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--navy)] focus:text-white focus:rounded-lg"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
        {process.env.NODE_ENV === "development" && <DebugPing />}
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
        <Suspense fallback={null}>
          <AppTracker />
        </Suspense>
        <MobileInit />
      </body>
    </html>
  );
}
