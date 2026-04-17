import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parent Portal | SkoolMate OS",
  description:
    "Parents can sign in with the phone number saved by the school to check attendance, fees, and school updates.",
  openGraph: {
    title: "Parent Portal | SkoolMate OS",
    description:
      "Use the parent phone number on school records to sign in and follow your child's school information.",
    type: "website",
    url: "https://omuto.org/parent",
    images: ["/og-image.png"],
  },
};

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
