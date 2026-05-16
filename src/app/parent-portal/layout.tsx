import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `Parent Portal | ${APP_NAME}`,
  description:
    `Parent portal for ${APP_NAME}. Your Digital School Partner. View your child's attendance, grades, fee balance, and school updates in one place.`,
  openGraph: {
    title: `Parent Portal | ${APP_NAME}`,
    description:
      "Stay connected with your child's school life. View attendance, grades, fees, and receive SMS updates.",
    type: "website",
    url: "https://omuto.org/parent-portal",
    images: ["/og-image.png"],
  },
};

export default function ParentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
