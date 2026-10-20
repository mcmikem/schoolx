import type { Metadata } from "next";
import { Suspense } from "react";
import { ParentPortalProvider } from "@/components/parent-portal/ParentPortalProvider";
import { AcademicProvider } from "@/lib/academic-context";
import { APP_NAME } from "@/lib/app-name";
import { NotificationsProvider } from "@/lib/notifications";

export const metadata: Metadata = {
  title: `Parent Portal | ${APP_NAME}`,
  description: `Parent portal for ${APP_NAME}. Your Digital School Partner. View your child's attendance, grades, fee balance, and school updates in one place.`,
  openGraph: {
    title: `Parent Portal | ${APP_NAME}`,
    description:
      "Stay connected with your child's school life. View attendance, grades, fees, and receive SMS updates.",
    type: "website",
    url: "https://omuto.org/parent-portal",
    images: ["/og-image.png"],
  },
};

export default function ParentPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      {/*
        The portal shell renders the dashboard TopBar, which reads the current
        term and academic year from the academic context. That provider was only
        ever mounted in the dashboard layout, so every parent-portal page threw
        "useAcademic must be used within an AcademicProvider" and showed
        "Something went wrong" instead of the child's attendance, grades or fees.
      */}
      <AcademicProvider>
        <NotificationsProvider>
          <ParentPortalProvider>{children}</ParentPortalProvider>
        </NotificationsProvider>
      </AcademicProvider>
    </Suspense>
  );
}
