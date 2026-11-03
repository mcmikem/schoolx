import { redirect } from "next/navigation";

export default function DashboardSmsTemplatesRedirectPage() {
  redirect("/dashboard/messages?tab=templates");
}
