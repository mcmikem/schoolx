import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parent Portal | ASSEMBLE",
  description:
    "Parent portal for ASSEMBLE. Powered by Omuto Foundation. View your child's attendance, grades, fee balance, and school updates in one place.",
  openGraph: {
    title: "Parent Portal | ASSEMBLE",
    description:
      "Stay connected with your child's school life. View attendance, grades, fees, and receive SMS updates.",
    type: "website",
    url: "https://omuto.sms/parent",
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
