'use client'
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import DashboardRouter from './DashboardRouter'

export default function DashboardPage() {
  return (
    <PageErrorBoundary>
      <DashboardRouter />
    </PageErrorBoundary>
  );
}
