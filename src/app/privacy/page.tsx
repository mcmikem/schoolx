import type { Metadata } from "next";
import PrivacyClient from "@/components/privacy/PrivacyClient";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `Privacy & Data Protection | ${APP_NAME}`,
  description: "Privacy notice and data protection rights under Uganda's Data Protection and Privacy Act 2019.",
};

export default function Page() {
  return <PrivacyClient />;
}
