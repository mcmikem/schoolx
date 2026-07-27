"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function Analytics() {
  const pathname = usePathname();
  const searchRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    searchRef.current = window.location.search;
  }, []);

  useEffect(() => {
    if (!GA_ID || typeof window === "undefined" || !(window as any).gtag) return;
    const query = searchRef.current;
    (window as any).gtag("config", GA_ID, {
      page_path: pathname + (query || ""),
    });
  }, [pathname]);

  if (!GA_ID) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { page_path: window.location.pathname });
        `}
      </Script>
    </>
  );
}
