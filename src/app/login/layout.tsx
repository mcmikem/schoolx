import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Omuto School Management System",
  description:
    "Sign in to your Omuto School Management System account. Access your dashboard for attendance, grades, fees, and parent communication.",
  openGraph: {
    title: "Sign In | Omuto School Management System",
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
