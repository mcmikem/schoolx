import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | SkulMate OS",
  description:
    "Sign in to your SkulMate OS account. Your Digital School Partner.",
  openGraph: {
    title: "Sign In | SkulMate OS",
    description:
      "Access your school dashboard. Track attendance, grades, fees, and send parent SMS from one place.",
    type: "website",
    url: "https://omuto.sms/login",
    images: ["/og-image.png"],
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
