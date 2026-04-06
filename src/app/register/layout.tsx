import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register Your School | SkulMate OS",
  description:
    "Register your school for a free 30-day trial of SkulMate OS. Your Digital School Partner.",
  openGraph: {
    title: "Register Your School | SkulMate OS",
    description:
      "Start your free 30-day trial. The all-in-one school management system built for Ugandan schools.",
    type: "website",
    url: "https://omuto.sms/register",
    images: ["/og-image.png"],
  },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
