import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DemoStudentClient from "./DemoStudentClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demo student",
  robots: { index: false, follow: false },
};

export default function DemoStudentPage() {
  const enabled = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES === "true";

  if (!enabled) notFound();

  return <DemoStudentClient />;
}
