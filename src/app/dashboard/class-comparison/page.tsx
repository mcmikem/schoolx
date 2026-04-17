import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { redirect } from "next/navigation";

export default function DashboardClassComparisonRedirectPage() {
  redirect("/dashboard/analytics");
}
