"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ParentDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/parent-portal");
  }, [router]);

  return null;
}
