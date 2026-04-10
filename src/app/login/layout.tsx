import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | SkoolMate OS",
  description:
    "Sign in to your SkoolMate OS account. Your Digital School Partner.",
  openGraph: {
    title: "Sign In | SkoolMate OS",
    description:
      "Access your school dashboard. Track attendance, grades, fees, and send parent SMS from one place.",
    type: "website",
    url: "https://omuto.org/login",
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
