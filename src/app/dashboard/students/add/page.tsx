import { redirect } from "next/navigation";

export default function DashboardStudentAddRedirectPage() {
  redirect("/dashboard/students?action=add");
}
