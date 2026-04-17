import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { redirect } from "next/navigation";

export default function DashboardFeesLookupRedirectPage() {
  redirect("/dashboard/fees");
}
