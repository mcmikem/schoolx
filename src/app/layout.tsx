import type { Metadata, Viewport } from 'next'
import './globals.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'SchoolX | Run Your Entire School From One Dashboard',
  description: 'The all-in-one school management system built for Ugandan schools. Track attendance, grades, fees, and send parent SMS — all from one dashboard. Start your free 30-day trial today.',
  manifest: '/manifest.json',
  icons: {
    icon: '/schoolx-logo.svg',
    apple: '/schoolx-logo.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SchoolX',
  },
  openGraph: {
    title: 'SchoolX | Run Your Entire School From One Dashboard',
    description: 'Attendance, grades, fees, and parent SMS — all in one system built for Ugandan schools. Start your free 30-day trial.',
    type: 'website',
    locale: 'en_UG',
    siteName: 'SchoolX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SchoolX | School Management for Ugandan Schools',
    description: 'Run your entire school from one dashboard. Attendance, grades, fees, and parent SMS.',
  },
}

export const viewport: Viewport = {
  themeColor: '#0056D2',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700;800&family=Sora:wght@300;400;500;600;700;800&family=Lato:wght@300;400;700;900&display=swap"
          rel="stylesheet"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SchoolX" />
        <link rel="apple-touch-icon" href="/schoolx-logo.svg" />
        <link rel="icon" href="/schoolx-logo.svg" type="image/svg+xml" />
      </head>
      <body className="antialiased min-h-screen" style={{ backgroundColor: 'var(--bg)', color: 'var(--t1)', fontFamily: "'Lato', sans-serif" }}>
        <Providers>{children}</Providers>
        <script dangerouslySetInnerHTML={{
          __html: `
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
          `
        }} />
      </body>
    </html>
  )
}
