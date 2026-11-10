import type { Metadata } from "next";
import PrivacyClient from "@/components/privacy/PrivacyClient";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `Privacy & Data Protection | ${APP_NAME}`,
  description: "SkoolMate privacy notice, school data processing roles, and information about personal data requests.",
};

export default function Page() {
  return <PrivacyClient />;
}
