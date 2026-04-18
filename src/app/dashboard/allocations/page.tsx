import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { redirect } from "next/navigation";

export default function DashboardAllocationsRedirectPage() {
  redirect("/dashboard/timetable");
}
