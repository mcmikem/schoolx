import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DemoLoginClient from "./DemoLoginClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demo sign-in",
  robots: { index: false, follow: false },
};

export default function DemoLoginPage() {
  const enabled = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES === "true";

  if (!enabled) notFound();

  return <DemoLoginClient />;
}
