import { redirect } from "next/navigation";

export default function DashboardInvoicingRedirectPage() {
  redirect("/dashboard/fees?tab=invoices");
}
