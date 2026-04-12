import { lazy, Suspense, ReactNode } from "react";

function LoadingSpinner({
  size = "md",
  label = "Loading...",
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const sizes = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center p-4"
    >
      <div
        className={`${sizes[size]} border-blue-600 border-t-transparent rounded-full animate-spin`}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

interface LazyLoadProps {
  children: ReactNode;
  fallback?: ReactNode;
  delay?: number;
}

export function LazyWrapper({ children, fallback, delay = 0 }: LazyLoadProps) {
  return (
    <Suspense
      fallback={
        fallback || (
          <div className="flex items-center justify-center p-8">
            <LoadingSpinner size="md" label="Loading..." />
          </div>
        )
      }
    >
      {children}
    </Suspense>
  );
}

export function createLazyComponent<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  options?: {
    ssr?: boolean;
    timeout?: number;
    fallback?: ReactNode;
  },
) {
  const LazyComponent = lazy(factory);

  return function LazyWrapper(props: any) {
    return (
      <Suspense
        fallback={
          options?.fallback || (
            <div className="flex items-center justify-center p-8 min-h-[200px]">
              <LoadingSpinner size="md" label="Loading component..." />
            </div>
          )
        }
      >
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

export function usePreload() {
  const preload = (path: string) => {
    if (typeof window !== "undefined") {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = path;
      document.head.appendChild(link);
    }
  };

  return { preload };
}

export function useSmartPrefetch() {
  const prefetchOnHover = (href: string) => {
    if (typeof window === "undefined") return;

    const link = document.createElement("a");
    link.href = href;
    link.rel = "prefetch";

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          document.head.appendChild(link);
          observer.disconnect();
        }
      });
    });

    setTimeout(() => {
      const target = document.querySelector(`[href="${href}"]`);
      if (target) {
        observer.observe(target);
      }
    }, 500);
  };

  return { prefetchOnHover };
}

export default LazyWrapper;
