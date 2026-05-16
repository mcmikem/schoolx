import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `Sign In | ${APP_NAME}`,
  description:
    `Sign in to your ${APP_NAME} account. Your Digital School Partner.`,
  openGraph: {
    title: `Sign In | ${APP_NAME}`,
    description:
      "Access your school dashboard. Track attendance, grades, fees, and send parent SMS from one place.",
    type: "website",
    url: "https://omuto.org/login",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
