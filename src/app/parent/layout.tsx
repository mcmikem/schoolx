import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parent Portal | Omuto School Management System",
  description:
    "Parent portal for Omuto School Management System. View your child's attendance, grades, fee balance, and school updates in one place.",
  openGraph: {
    title: "Parent Portal | Omuto School Management System",
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
