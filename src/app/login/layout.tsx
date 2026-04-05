import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | ASSEMBLE",
  description:
    "Sign in to your ASSEMBLE account. Powered by Omuto Foundation.",
  openGraph: {
    title: "Sign In | ASSEMBLE",
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
