import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import MobileInit from "./mobile-init";

export const metadata: Metadata = {
  title: "SkoolMate OS | Your Digital School Partner",
  description:
    "The all-in-one school management system built for Ugandan schools. Track attendance, grades, fees, and send parent SMS — all from one dashboard. Start your free 30-day trial today.",
  manifest: "/manifest.json",
  icons: {
    icon: "/SkoolMate logos/SchoolMate icon.svg",
    apple: "/SkoolMate logos/SchoolMate icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SkoolMate OS",
  },
  openGraph: {
    title: "SkoolMate OS | Your Digital School Partner",
    description:
      "Attendance, grades, fees, and parent SMS — all in one system built for Ugandan schools. Start your free 30-day trial.",
    type: "website",
    url: "https://omuto.sms",
    images: ["/og-image.png"],
    locale: "en_UG",
    siteName: "SkoolMate OS",
  },
  twitter: {
    card: "summary_large_image",
    title: "SkoolMate OS | Your Digital School Partner",
    description:
      "Run your entire school from one dashboard. Attendance, grades, fees, and parent SMS.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0056D2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Sora:wght@300;400;500;600;700;800&family=Lato:wght@300;400;700;900&display=swap"
          rel="stylesheet"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="SkoolMate OS" />
        <link
          rel="apple-touch-icon"
          href="/SkoolMate logos/SchoolMate icon.svg"
        />
        <link
          rel="icon"
          href="/SkoolMate logos/SchoolMate icon.svg"
          type="image/svg+xml"
        />
      </head>
      <body
        className="antialiased min-h-screen"
        style={{
          backgroundColor: "var(--bg)",
          color: "var(--t1)",
          fontFamily: "'Lato', sans-serif",
        }}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--navy)] focus:text-white focus:rounded-lg"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
        <MobileInit />
        <script>{`
            (function() {
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    reg.addEventListener('updatefound', function() {
                      var newWorker = reg.installing;
                      if (newWorker) {
                        newWorker.addEventListener('statechange', function() {
                          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            var evt = new CustomEvent('sw-update-available', { detail: { registration: reg } });
                            window.dispatchEvent(evt);
                          }
                        });
                      }
                    });
                  }).catch(function(err) {
                    console.warn('SW registration failed:', err);
                  });
                });
              }
            })();
          `}</script>
      </body>
    </html>
  );
}
