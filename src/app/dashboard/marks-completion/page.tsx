import { redirect } from "next/navigation";

export default function DashboardMarksCompletionRedirectPage() {
  redirect("/dashboard/grades");
}
