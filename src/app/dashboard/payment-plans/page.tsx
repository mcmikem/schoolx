import { redirect } from "next/navigation";

export default function DashboardPaymentPlansRedirectPage() {
  redirect("/dashboard/fees?tab=payment-plans");
}
