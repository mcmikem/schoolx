"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isLiteMode, PERFORMANCE_EVENT } from "@/lib/performance-mode";
import { useEffect, useState } from "react";

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes cache by default
            gcTime: 1000 * 60 * (isLiteMode() ? 5 : 30), // 30 min garbage collection
            retry: 1, // Only retry once on failure
            refetchOnWindowFocus: false, // Don't refetch on every tab switch
          },
        },
      }),
  );

  useEffect(() => {
    const update = () =>
      queryClient.setDefaultOptions({
        queries: {
          ...queryClient.getDefaultOptions().queries,
          gcTime: 1000 * 60 * (isLiteMode() ? 5 : 30),
        },
      });
    window.addEventListener(PERFORMANCE_EVENT, update);
    return () => window.removeEventListener(PERFORMANCE_EVENT, update);
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
