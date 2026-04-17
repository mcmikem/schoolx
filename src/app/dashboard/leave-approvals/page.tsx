import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { redirect } from "next/navigation";

export default function DashboardLeaveApprovalsRedirectPage() {
  redirect("/dashboard/leave");
}
