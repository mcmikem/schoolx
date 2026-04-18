import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { redirect } from "next/navigation";

export default function DashboardVisitorsRedirectPage() {
  redirect("/dashboard/messages?tab=notices");
}
