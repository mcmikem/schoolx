"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import MaterialIcon from "@/components/MaterialIcon";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
}

export default function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const el = containerRef.current;
    if (el && el.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      isDragging.current = true;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging.current || refreshing) return;
      currentY.current = e.touches[0].clientY;
      const diff = currentY.current - startY.current;
      if (diff > 0) {
        e.preventDefault();
        setPullDistance(Math.min(diff * 0.5, threshold + 20));
      }
    },
    [refreshing, threshold],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current || refreshing) return;
    isDragging.current = false;

    if (pullDistance >= threshold) {
      setRefreshing(true);
      setPullDistance(threshold);
      try {
        await onRefresh();
      } finally {
        setPullDistance(0);
        setRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, threshold, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div ref={containerRef} className="relative overflow-auto h-full">
      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex items-center justify-center transition-all duration-200"
          style={{ height: Math.max(pullDistance, refreshing ? 50 : 0) }}
        >
          {refreshing ? (
            <div className="flex items-center gap-2 text-sm text-onSurface-variant">
              <span className="material-symbols-outlined animate-spin text-primary">
                progress_activity
              </span>
              Refreshing...
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-onSurface-variant">
              <MaterialIcon
                icon={
                  pullDistance >= threshold ? "file_download" : "arrow_downward"
                }
                className={`transition-transform ${pullDistance >= threshold ? "text-primary" : ""}`}
              />
              {pullDistance >= threshold
                ? "Release to refresh"
                : "Pull to refresh"}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
