"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";

export default function StudentTransfersPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/students?tab=transfers");
  }, [router]);

  return (
    <PageErrorBoundary>
      <div className="p-6 text-sm text-[var(--t3)]">Redirecting to Student Hub Transfers...</div>
    </PageErrorBoundary>
  );
}
