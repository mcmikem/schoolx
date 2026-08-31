import type { Metadata } from "next";
import HomePageClient from "@/components/marketing/HomePageClient";
import { APP_NAME } from "@/lib/app-name";

export const metadata: Metadata = {
  title: `${APP_NAME} | Your Digital School Partner`,
  description:
    "The all-in-one school management system built for Ugandan schools. Track attendance, grades, fees, and send parent SMS — all from one dashboard. Start your free 30-day trial today.",
};

export default function Page() {
  return <HomePageClient />;
}
