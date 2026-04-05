import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register Your School | ASSEMBLE",
  description:
    "Register your school for a free 30-day trial of ASSEMBLE. Powered by Omuto Foundation.",
  openGraph: {
    title: "Register Your School | ASSEMBLE",
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
