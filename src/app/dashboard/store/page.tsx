"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StoreHomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/store/inventory");
  }, [router]);

  return <div className="p-8 text-sm text-[var(--t2)]">Opening store...</div>;
}
