import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { redirect } from "next/navigation";

export default function DashboardHealthLogRedirectPage() {
  redirect("/dashboard/health");
}
