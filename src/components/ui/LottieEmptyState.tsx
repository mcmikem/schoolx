"use client";

import { Lottie } from "lottie-react";
import { useEffect, useState } from "react";

export default function LottieEmptyState({
  src = "/lottie/ripple.json",
  title,
  description,
  className = "",
}: {
  src?: string;
  title?: string;
  description?: string;
  className?: string;
}) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 text-center ${className}`}>
      <div className="h-32 w-32">{data && <Lottie src={data} className="h-32 w-32" loop autoplay />}</div>
      {title && <p className="text-sm font-semibold text-[var(--t1)]">{title}</p>}
      {description && <p className="max-w-xs text-xs text-[var(--t3)]">{description}</p>}
    </div>
  );
}
