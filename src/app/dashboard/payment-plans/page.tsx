import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { redirect } from "next/navigation";

export default function DashboardPaymentPlansRedirectPage() {
  redirect("/dashboard/billing");
}
