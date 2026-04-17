import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register Your School | SkoolMate OS",
  description:
    "Register your school, add location details, and create the first admin login.",
  openGraph: {
    title: "Register Your School | SkoolMate OS",
    description:
      "Create a school account in three steps using your school details, district, and admin phone number.",
    type: "website",
    url: "https://omuto.org/register",
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
