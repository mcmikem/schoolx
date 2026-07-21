import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `Student Portal | ${APP_NAME}`,
  description: `Student portal for ${APP_NAME}. View your attendance, grades, timetable, and school updates.`,
};

export default function StudentPortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
