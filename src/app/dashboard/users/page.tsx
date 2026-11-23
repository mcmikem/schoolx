import { redirect } from "next/navigation";

export default function DashboardUsersRedirectPage() {
  redirect("/dashboard/settings?tab=users");
}
