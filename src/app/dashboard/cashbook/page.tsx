import { redirect } from "next/navigation";

export default function DashboardCashbookRedirectPage() {
  redirect("/dashboard/fees?tab=cashbook");
}
