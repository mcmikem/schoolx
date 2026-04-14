import { redirect } from "next/navigation";

export default function DashboardExpenseApprovalsRedirectPage() {
  redirect("/dashboard/budget");
}
