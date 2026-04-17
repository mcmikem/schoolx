import { redirect } from "next/navigation";

export default function ParentRouteRedirectPage() {
  redirect("/parent/login");
}
