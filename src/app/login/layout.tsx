import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | SkoolMate OS",
  description:
    "Sign in with the phone number and password your school gave you to open the school dashboard.",
  openGraph: {
    title: "Sign In | SkoolMate OS",
    description:
      "School staff can sign in with their saved phone number and password to open the dashboard.",
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
