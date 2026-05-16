import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `Register Your School | ${APP_NAME}`,
  description:
    `Register your school for a free 30-day trial of ${APP_NAME}. Your Digital School Partner.`,
  openGraph: {
    title: `Register Your School | ${APP_NAME}`,
    description:
      "Start your free 30-day trial. The all-in-one school management system built for Ugandan schools.",
    type: "website",
    url: "https://omuto.org/register",
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
