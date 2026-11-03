"use client";
import { Suspense } from "react";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import DashboardRouter from "./DashboardRouter";
import { DashboardSkeleton } from "@/components/ui/Skeleton";

export default function DashboardPage() {
  return (
    <PageErrorBoundary>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardRouter />
      </Suspense>
    </PageErrorBoundary>
  );
}
