"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import AnimatedLogo from "@/components/AnimatedLogo";
import LaptopMockup from "@/components/LaptopMockup";
import { MaterialIcon } from "@/components/marketing/MaterialIcon";
import { FadeIn } from "@/components/marketing/FadeIn";
import { FAQItem } from "@/components/marketing/FAQItem";
import { StatStrip } from "@/components/marketing/StatStrip";
import { RoleSwitcher } from "@/components/marketing/RoleSwitcher";
import { DayTimeline } from "@/components/marketing/DayTimeline";
import { DesktopMockup } from "@/components/marketing/DesktopMockup";
import { PhoneMockup } from "@/components/marketing/PhoneMockup";
import { smoothScroll } from "@/lib/scroll";
import {
  HEADLINES,
  ROTATION_INTERVAL,
  trustBadges,
  modules,
  plans,
  securityDetails,
  storyMoments,
  storyPrinciples,
  osxLinks,
  faqItems,
  ANDROID_APP_URL,
  WINDOWS_APP_URL,
  MAC_APP_URL,
  DEFAULT_DEVICE_TARGET,
} from "@/components/marketing/landing-data";
import type { DownloadTarget } from "@/components/marketing/types";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [deviceTarget, setDeviceTarget] = useState<DownloadTarget>(
    DEFAULT_DEVICE_TARGET,
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const isCapacitor =
      typeof window !== "undefined" && (window as any).Capacitor?.isNative;
    const isStandalone =
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone ===
          true);
    if (isCapacitor || isStandalone) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeadlineIndex((prev) => (prev + 1) % HEADLINES.length);
    }, ROTATION_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(userAgent);
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isMac = /macintosh|mac os x/.test(userAgent) && !isIOS;
    const isWindows = /windows/.test(userAgent);
    const installFromBrowser: DownloadTarget = {
      key: "browser",
      label: "Install on this device",
      icon: "install_desktop",
      helper:
        "Install SkoolMate from your browser for fast access on supported desktop and mobile devices.",
      badge: "Browser install",
      useInstallPrompt: true,
    };

    const nextTarget = (): DownloadTarget => {
      if (isAndroid) {
        if (ANDROID_APP_URL) {
          return {
            key: "android",
            href: ANDROID_APP_URL,
            label: "Get Android app",
            icon: "android",
            helper:
              "Download the Android APK directly to your phone or tablet.",
            badge: "Android APK",
          };
        }
        return installFromBrowser;
      }

      if (isWindows && WINDOWS_APP_URL) {
        return {
          key: "windows",
          href: WINDOWS_APP_URL,
          label: "Get Windows app",
          icon: "desktop_windows",
          helper: "Install the desktop build for Windows.",
          badge: "Windows desktop",
        };
      }

      if (isMac && MAC_APP_URL) {
        return {
          key: "mac",
          href: MAC_APP_URL,
          label: "Get Mac app",
          icon: "laptop_mac",
          helper: "Install the desktop build for macOS.",
          badge: "macOS desktop",
        };
      }

      if (isIOS) {
        return {
          key: "ios",
          href: "/login",
          label: "Open on iPhone or iPad",
          icon: "phone_iphone",
          helper:
            "On iPhone or iPad, open the web app in Safari and use Share > Add to Home Screen.",
          badge: "Safari install",
        };
      }

      return installFromBrowser;
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setDeviceTarget((current) => {
        if (current.href && current.href !== "/login") return current;
        return installFromBrowser;
      });
    };

    setDeviceTarget(nextTarget());
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  const handleInstallApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }
    if (deviceTarget.href && deviceTarget.href !== "/login") {
      router.push(deviceTarget.href);
      return;
    }
    if (/iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())) {
      alert(
        'On iPhone or iPad: Open this page in Safari, tap the Share Button (\u2191) then tap "Add to Home Screen".',
      );
      return;
    }
    router.push("/login");
  };

  return (
    <PageErrorBoundary>
      <main
        className="min-h-screen bg-[var(--bg)] text-[var(--t1)]"
        id="main-content"
      >
        {/* ===== HERO ===== */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_top_left,_rgba(23,50,95,0.13),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(46,148,72,0.10),_transparent_38%),linear-gradient(180deg,_#ffffff_0%,_var(--bg)_72%)]" />
          <div className="absolute left-[8%] top-24 h-40 w-40 rounded-full bg-[#d6e4ff] blur-3xl opacity-50" />
          <div className="absolute right-[10%] top-40 h-48 w-48 rounded-full bg-[#dff3e5] blur-3xl opacity-50" />

          <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pb-24">
            {/* Nav */}
            <nav className="flex items-center justify-between rounded-full border border-white/70 bg-white/80 px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur sm:px-6">
              <SkoolMateLogo size="md" variant="default" />
              <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
                <button
                  onClick={() => smoothScroll("#features")}
                  className="transition hover:text-slate-950 cursor-pointer"
                >
                  Features
                </button>
                <button
                  onClick={() => smoothScroll("#how-it-works")}
                  className="transition hover:text-slate-950 cursor-pointer"
                >
                  How it works
                </button>
                <button
                  onClick={() => smoothScroll("#story")}
                  className="transition hover:text-slate-950 cursor-pointer"
                >
                  Story
                </button>
                <button
                  onClick={() => smoothScroll("#security")}
                  className="transition hover:text-slate-950 cursor-pointer"
                >
                  Security
                </button>
                <button
                  onClick={() => smoothScroll("#pricing")}
                  className="transition hover:text-slate-950 cursor-pointer"
                >
                  Pricing
                </button>
                <button
                  onClick={() => smoothScroll("#faq")}
                  className="transition hover:text-slate-950 cursor-pointer"
                >
                  FAQ
                </button>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Link href="/login" className="btn btn-secondary btn-sm">
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="btn btn-primary btn-sm hidden sm:inline-flex"
                >
                  Start free trial
                </Link>
                <button
                  className="flex md:hidden items-center justify-center w-9 h-9 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                  aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={mobileMenuOpen}
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {mobileMenuOpen ? "close" : "menu"}
                  </span>
                </button>
              </div>
            </nav>

            {/* Mobile nav dropdown */}
            {mobileMenuOpen && (
              <div className="md:hidden fixed left-4 right-4 top-[72px] z-50 rounded-[24px] border border-white/70 bg-white/96 shadow-[0_16px_48px_rgba(15,23,42,0.12)] backdrop-blur p-4">
                <div className="flex flex-col gap-1">
                  {[
                    { label: "Features", id: "#features" },
                    { label: "How it works", id: "#how-it-works" },
                    { label: "Install", id: "#install" },
                    { label: "Story", id: "#story" },
                    { label: "Security", id: "#security" },
                    { label: "Pricing", id: "#pricing" },
                    { label: "FAQ", id: "#faq" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        smoothScroll(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 rounded-[16px] text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      {item.label}
                    </button>
                  ))}
                  <div className="mt-2 pt-3 border-t border-slate-100">
                    <Link
                      href="/register"
                      className="btn btn-primary w-full justify-center py-3 text-sm"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Start free trial
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Hero grid */}
            <div className="grid gap-14 pt-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pt-20">
              <div className="max-w-2xl">
                <div className="mb-6 flex animate-fade-in">
                  <div className="px-4 py-1.5 rounded-full bg-[var(--navy-soft)] border border-[var(--navy)]/10 text-[var(--navy)] text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
                    <MaterialIcon icon="school" className="text-sm" />
                    Built for real school operations
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--primary)] shadow-sm">
                  <MaterialIcon icon="fact_check" className="text-[18px]" />
                  Admissions, attendance, fees, reports, and parent follow-up
                </div>
                <h1 className="mt-6 font-['Sora'] text-5xl font-semibold tracking-[-0.05em] text-[var(--t1)] sm:text-6xl lg:text-7xl">
                  <span
                    className="block leading-none overflow-hidden"
                    style={{ minHeight: "1.1em" }}
                  >
                    <span
                      key={headlineIndex}
                      className="animate-fade-in block leading-none"
                    >
                      {HEADLINES[headlineIndex]}
                    </span>
                  </span>
                  <span className="block leading-tight mt-2">
                    with <span className="text-[var(--green)]">all-in-one</span>{" "}
                    school management.
                  </span>
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--t2)] sm:text-xl">
                  Handle attendance, fees, marks, and parent messages — all in
                  one place. Built for Ugandan schools. Works even without
                  internet.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/register"
                    className="btn btn-primary px-7 py-4 text-base"
                  >
                    Start 30-day free trial
                  </Link>
                  {mounted &&
                    (deviceTarget.href && !deviceTarget.useInstallPrompt ? (
                      <Link
                        href={deviceTarget.href}
                        className="btn btn-secondary px-7 py-4 text-base flex items-center gap-3"
                      >
                        <MaterialIcon
                          icon={deviceTarget.icon}
                          className="text-[22px]"
                        />
                        {deviceTarget.label}
                      </Link>
                    ) : (
                      <button
                        className="btn btn-secondary px-7 py-4 text-base flex items-center gap-3"
                        onClick={handleInstallApp}
                      >
                        <MaterialIcon
                          icon={deviceTarget.icon}
                          className="text-[22px]"
                        />
                        {deviceTarget.label}
                      </button>
                    ))}
                </div>

                <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
                  {trustBadges.map((badge) => (
                    <div
                      key={badge.label}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--t3)]"
                    >
                      <MaterialIcon
                        icon={badge.icon}
                        className="text-[14px] text-[var(--green)]"
                      />
                      {badge.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative hero-stage">
                <div className="floating-note absolute right-0 top-0 z-20 w-52 rounded-[28px] border border-white/70 bg-white/88 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur xl:block hidden">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Today at a glance
                  </p>
                  <div className="mt-4 space-y-3">
                    {[
                      ["Attendance filed", "12 classes by 8:05 AM"],
                      ["Fee follow-up", "426 parents queued"],
                      ["Candidate review", "S.4 report cards ready"],
                    ].map(([label, note]) => (
                      <div
                        key={label}
                        className="rounded-[20px] bg-slate-50 p-3 ring-1 ring-slate-200"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {note}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="phone-stage relative z-10 mx-auto mb-6 max-w-[320px] lg:absolute lg:-left-8 lg:top-10 lg:mb-0 xl:block">
                  <PhoneMockup />
                </div>
                <div className="desktop-stage relative z-0 hidden lg:block lg:ml-16">
                  <LaptopMockup />
                </div>
                <div className="floating-callout absolute bottom-5 left-3 z-20 rounded-[24px] border border-[#d7e4fb] bg-white/92 px-4 py-3 shadow-[0_22px_55px_rgba(15,23,42,0.12)] backdrop-blur md:block hidden">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                    From registers to reports
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--t1)]">
                    One flow, one view, one calmer morning.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== STATS STRIP ===== */}
        <StatStrip />

        {/* ===== HOW TO GET STARTED ===== */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center mb-10">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                Get started in 3 steps
              </p>
              <h2 className="mt-3 font-['Sora'] text-2xl font-semibold text-slate-950 sm:text-3xl">
                From signup to running your school
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                {
                  step: "1",
                  icon: "how_to_reg",
                  title: "Register your school",
                  desc: "Create your account in under 2 minutes. No credit card needed.",
                },
                {
                  step: "2",
                  icon: "group_add",
                  title: "Add your students",
                  desc: "Upload a CSV or add students manually. Create classes and subjects.",
                },
                {
                  step: "3",
                  icon: "rocket_launch",
                  title: "Start using it",
                  desc: "Mark attendance, record fees, send SMS — your school runs from one place.",
                },
              ].map((item, i) => (
                <FadeIn key={item.step} delay={i * 150}>
                  <div className="relative rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow text-center">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-[#17325F] text-white text-xs font-bold flex items-center justify-center">
                      {item.step}
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448] mx-auto mt-2">
                      <MaterialIcon icon={item.icon} className="text-[26px]" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </FadeIn>
        </section>

        {/* ===== INTERACTIVE DASHBOARD PREVIEW (Reciprocity) ===== */}
        <section className="relative overflow-hidden bg-[#f2f6fe] py-18 sm:py-24">
          <div className="absolute top-[-20%] right-[-10%] h-[60%] w-[50%] rounded-full bg-[#d6e4ff] blur-[120px] opacity-40" />
          <div className="absolute bottom-[-20%] left-[-10%] h-[50%] w-[40%] rounded-full bg-[#dff3e5] blur-[120px] opacity-30" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="text-center mb-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#17325F]/10 bg-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#17325F] shadow-sm">
                  <MaterialIcon icon="travel_explore" className="text-sm" />
                  See it for yourself
                </span>
              </div>
              <h2 className="text-center font-['Sora'] text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
                Your school dashboard,
                <br />
                <span className="text-[#2E9448]">fully interactive</span>
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-slate-600">
                Click through the tabs below. This is exactly what you and your
                staff will see every morning — no sign-up required.
              </p>
            </FadeIn>
            <div className="mt-10 max-w-5xl mx-auto">
              <DesktopMockup />
            </div>
            <FadeIn delay={200}>
              <div className="mt-10 text-center">
                <p className="text-sm text-slate-500 mb-4">
                  No catch. No credit card. Start your 30-day free trial.
                </p>
                <Link
                  href="/register"
                  className="btn btn-primary px-8 py-4 text-base inline-flex items-center gap-2"
                >
                  Start free trial
                  <MaterialIcon icon="arrow_forward" className="text-lg" />
                </Link>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ===== ROLE SWITCHER ===== */}
        <RoleSwitcher />

        {/* ===== HOW IT WORKS ===== */}
        <DayTimeline />

        {/* ===== STORY ===== */}
        <section
          id="story"
          className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24"
        >
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <FadeIn>
              <div className="rounded-[34px] bg-[#0f1f3d] p-7 text-white shadow-[0_24px_60px_rgba(15,23,42,0.16)] lg:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">
                  The story behind SkoolMate OS
                </p>
                <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                  It did not start as an idea. It started with what schools kept
                  carrying every day.
                </h2>
                <p className="mt-5 text-base leading-7 text-white/76">
                  At Omuto Foundation, the work has been close enough to schools
                  to see the real picture, not an abstract one. The issue was
                  never that people were not trying. The issue was that the
                  system around them kept slowing the work down.
                </p>
                <div className="mt-8 grid gap-3">
                  {storyMoments.map((item) => (
                    <div
                      key={item}
                      className="story-card rounded-[22px] border border-white/10 bg-white/6 px-4 py-4"
                    >
                      <p className="text-sm leading-6 text-white/82">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            <div className="grid gap-5">
              <FadeIn>
                <div className="rounded-[34px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                    What became obvious
                  </p>
                  <h3 className="mt-4 font-['Sora'] text-2xl font-semibold leading-tight tracking-[-0.03em] text-slate-950">
                    Schools do not need more pressure. They need better tools.
                  </h3>
                  <p className="mt-4 text-base leading-7 text-slate-600">
                    SkoolMate OS was built to match the real flow of school
                    life: attendance, marks, fees, communication, and
                    decision-making in one place. Not another generic system. A
                    calmer operating layer for schools that are already working
                    hard.
                  </p>
                </div>
              </FadeIn>

              <div className="grid gap-4 sm:grid-cols-2">
                {storyPrinciples.map((item, i) => (
                  <FadeIn key={item.label} delay={i * 100}>
                    <div className="story-card rounded-[28px] border border-slate-200 bg-[#f8fbff] p-5 shadow-sm h-full">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#17325F]/8 text-[#17325F]">
                        <MaterialIcon
                          icon={item.icon}
                          className="text-[20px]"
                        />
                      </div>
                      <p className="mt-4 text-base font-semibold leading-7 text-slate-900">
                        {item.label}
                      </p>
                    </div>
                  </FadeIn>
                ))}
              </div>

              <FadeIn delay={200}>
                <div className="rounded-[34px] border border-[#d7e4fb] bg-[linear-gradient(180deg,#ffffff_0%,#f5f9ff_100%)] p-6 shadow-sm lg:p-8">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                    What changes when the system runs well
                  </p>
                  <p className="mt-4 text-base leading-7 text-slate-600">
                    Teachers get more time to focus on students. Leaders can see
                    what is working and what is not. Parents stay informed.
                    Students are noticed early instead of slipping through the
                    cracks. The X in SkoolMate OS stands for Xperience, because
                    this system comes from what has been seen, learned, and
                    asked for in the field.
                  </p>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ===== MODULES ===== */}
        <section className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24">
          <FadeIn>
            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                  Inside the platform
                </p>
                <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  Every major school unit connected in one system.
                </h2>
                <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                  From academics to administration, SkoolMate OS is designed to
                  reduce duplicate work. Enter data once, then reuse it across
                  report cards, parent communication, financial follow-up, UNEB
                  prep, and board reporting.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {modules.map((module, i) => (
                  <FadeIn key={module.label} delay={i * 80}>
                    <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm hover:shadow-md hover:border-[#2E9448]/30 transition-all cursor-default">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448]">
                          <MaterialIcon
                            icon={module.icon}
                            className="text-[20px]"
                          />
                        </div>
                        <p className="text-sm font-semibold text-slate-800">
                          {module.label}
                        </p>
                      </div>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>
          </FadeIn>
        </section>

        {/* ===== INSTALL ON ANY DEVICE ===== */}
        <section id="install" className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24">
          <FadeIn>
            <div className="text-center mb-10">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                Install on any device
              </p>
              <h2 className="mt-3 font-['Sora'] text-2xl font-semibold text-slate-950 sm:text-3xl">
                Use SkoolMate OS everywhere
              </h2>
              <p className="mt-4 max-w-xl mx-auto text-base text-slate-600">
                Install on your phone, tablet, or computer for quick access — even works offline.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: "phone_iphone",
                  platform: "iPhone & iPad",
                  desc: "Open in Safari, tap Share, then Add to Home Screen.",
                  color: "bg-slate-100 text-slate-700",
                },
                {
                  icon: "android",
                  platform: "Android",
                  desc: ANDROID_APP_URL
                    ? "Download the APK directly to your device."
                    : "Tap the install banner or use Chrome menu > Install app.",
                  color: "bg-green-50 text-green-700",
                },
                {
                  icon: "desktop_windows",
                  platform: "Windows",
                  desc: WINDOWS_APP_URL
                    ? "Download the Windows desktop build."
                    : "Use Chrome or Edge address bar install icon.",
                  color: "bg-blue-50 text-blue-700",
                },
                {
                  icon: "laptop_mac",
                  platform: "Mac",
                  desc: MAC_APP_URL
                    ? "Download the macOS desktop build."
                    : "Use Chrome address bar install icon.",
                  color: "bg-slate-100 text-slate-700",
                },
              ].map((item, i) => (
                <FadeIn key={item.platform} delay={i * 100}>
                  <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all h-full">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.color}`}>
                      <MaterialIcon icon={item.icon} className="text-[22px]" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-slate-900">
                      {item.platform}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 leading-5">
                      {item.desc}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </FadeIn>
        </section>

        {/* ===== OSX ===== */}
        <section id="osx" className="bg-white py-18 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                    SkoolMate OS and OSX
                  </p>
                  <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
                    SkoolMate OS is the system layer inside the wider SkoolMate
                    School Xperience.
                  </h2>
                  <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                    OSX is the broader transformation model. SkoolMate OS is the
                    layer that helps that transformation hold, because progress
                    is hard to sustain when the underlying school systems stay
                    scattered and manual.
                  </p>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[32px] border border-slate-200 bg-[#f7f9fc] p-6 shadow-sm lg:p-8">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-[24px] bg-white p-5 ring-1 ring-slate-200 hover:shadow-md transition-shadow">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                          OSX
                        </p>
                        <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
                          Drives transformation
                        </p>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          Leadership, student engagement, accountability, and a
                          culture where schools do not just operate, but
                          perform.
                        </p>
                      </div>
                      <div className="rounded-[24px] bg-[#17325F] p-5 text-white hover:shadow-lg transition-shadow">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
                          SkoolMate OS
                        </p>
                        <p className="mt-3 text-xl font-semibold tracking-tight">
                          Sustains it daily
                        </p>
                        <p className="mt-3 text-sm leading-6 text-white/76">
                          Attendance, academics, fees, communication, and
                          operational visibility working in one reliable school
                          workflow.
                        </p>
                      </div>
                    </div>
                  </div>

                  {osxLinks.map((item, i) => (
                    <FadeIn key={item} delay={i * 100}>
                      <div className="story-card flex items-start gap-3 rounded-[26px] border border-slate-200 bg-white px-5 py-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448] flex-shrink-0">
                          <MaterialIcon
                            icon="north_east"
                            className="text-[18px]"
                          />
                        </div>
                        <p className="text-sm leading-6 text-slate-700">
                          {item}
                        </p>
                      </div>
                    </FadeIn>
                  ))}

                  <div className="rounded-[30px] border border-[#d7e4fb] bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                      The result
                    </p>
                    <p className="mt-4 text-base leading-7 text-slate-700">
                      Together, OSX drives the transformation and SkoolMate OS
                      makes it visible, usable, and measurable. That is the
                      complete school experience: organised systems, informed
                      decisions, earlier support, and progress that leaders can
                      actually track.
                    </p>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ===== SECURITY & DATA PROTECTION ===== */}
        <section
          id="security"
          className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24"
        >
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                Security &amp; Data Protection
              </p>
              <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Your school data is safe with us.
              </h2>
              <p className="mt-5 max-w-2xl mx-auto text-lg leading-8 text-slate-600">
                Student records, grades, and financial data are sensitive. Here
                is exactly how we protect your school — in plain language.
              </p>
            </div>
          </FadeIn>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {securityDetails.map((feature, i) => (
              <FadeIn key={feature.title} delay={i * 100}>
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-[#2E9448]/30 transition-all h-full">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf4ed] text-[#2E9448]">
                    <MaterialIcon icon={feature.icon} className="text-[24px]" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {feature.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* ===== PRICING ===== */}
        <section
          id="pricing"
          className="relative bg-[#0d1930] py-18 text-white lg:py-24"
        >
          <div className="absolute top-8 left-8 opacity-30">
            <AnimatedLogo type="logo_white" className="w-16 h-16" />
          </div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">
                  Pricing
                </p>
                <h2 className="mt-4 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                  Clear pricing. No hidden fees.
                </h2>
                <p className="mt-5 text-lg leading-8 text-white/72">
                  Per-student pricing that scales with your school. Start free,
                  upgrade when ready.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => smoothScroll("#comparison")}
                    className="text-sm font-semibold text-white/80 hover:text-white underline underline-offset-4"
                  >
                    See full feature comparison →
                  </button>
                </div>
              </div>
            </FadeIn>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan, i) => (
                <FadeIn key={plan.name} delay={i * 150}>
                  <div
                    className={`rounded-[32px] border p-6 h-full flex flex-col ${
                      plan.featured
                        ? "border-white/20 bg-white text-slate-950 shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
                        : "border-white/12 bg-white/6 backdrop-blur"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-lg font-semibold ${plan.featured ? "text-slate-950" : "text-white"}`}
                      >
                        {plan.name}
                      </p>
                      {plan.featured && (
                        <span className="rounded-full bg-[#17325F] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                          Most chosen
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-4 font-['Sora'] text-4xl font-semibold tracking-[-0.05em] ${plan.featured ? "text-slate-950" : "text-white"}`}
                    >
                      {plan.price}
                    </p>
                    <p
                      className={`mt-1 text-sm ${plan.featured ? "text-slate-500" : "text-white/60"}`}
                    >
                      {plan.cadence}
                    </p>
                    <p
                      className={`mt-1 text-xs ${plan.featured ? "text-slate-400" : "text-white/50"}`}
                    >
                      {plan.contrastLabel}
                    </p>
                    <p
                      className={`mt-2 text-xs font-semibold uppercase tracking-wider ${plan.featured ? "text-[#2E9448]" : "text-white/80"}`}
                    >
                      {plan.bestFor}
                    </p>
                    <div className="mt-6 space-y-3 flex-1">
                      <p className={`text-xs font-semibold uppercase tracking-wider ${plan.featured ? "text-slate-500" : "text-white/60"}`}>
                        What's included
                      </p>
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-3">
                          <MaterialIcon
                            icon="check"
                            className={`mt-0.5 text-[18px] ${plan.featured ? "text-[#2E9448]" : "text-white"}`}
                          />
                          <p
                            className={`text-sm ${plan.featured ? "text-slate-700" : "text-white/80"}`}
                          >
                            {feature}
                          </p>
                        </div>
                      ))}
                      {(plan as any).lossItems && (plan as any).lossItems.length > 0 && (
                        <>
                          <div className={`my-3 border-t ${plan.featured ? "border-slate-200" : "border-white/10"}`} />
                          <p className={`text-xs font-semibold uppercase tracking-wider ${plan.featured ? "text-amber-600" : "text-amber-400"}`}>
                            Not included on this plan
                          </p>
                          {(plan as any).lossItems.map((item: string) => (
                            <div key={item} className="flex items-start gap-3">
                              <MaterialIcon
                                icon="close"
                                className={`mt-0.5 text-[16px] ${plan.featured ? "text-amber-400" : "text-amber-500"}`}
                              />
                              <p
                                className={`text-sm ${plan.featured ? "text-slate-500" : "text-white/60"}`}
                              >
                                {item}
                              </p>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                    <Link
                      href="/register"
                      className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                        plan.featured
                          ? "bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90"
                          : "bg-white text-[var(--t1)] hover:bg-[var(--surface-container)]"
                      }`}
                    >
                      Start with {plan.name}
                    </Link>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ===== COMPARISON TABLE ===== */}
        <section
          id="comparison"
          className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:py-24"
        >
          <FadeIn>
            <div className="text-center mb-10">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                Feature Comparison
              </p>
              <h2 className="mt-3 font-['Sora'] text-2xl font-semibold text-slate-950 sm:text-3xl">
                How SkoolMate OS compares
              </h2>
            </div>
            <p className="text-center text-sm text-slate-500 mb-2">
              ✓ = Included &nbsp;&nbsp; ✗ = Not available &nbsp;&nbsp; ~ =
              Partial
            </p>
            <p className="text-center text-xs text-slate-400 mb-8">
              Based on publicly available information, April 2026. Competitor
              columns are illustrative.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">
                      Feature
                    </th>
                    <th className="py-3 px-4 font-bold text-[#2E9448] bg-green-50">
                      SkoolMate
                    </th>
                    <th className="py-3 px-4 text-slate-500">Alt A</th>
                    <th className="py-3 px-4 text-slate-500">Alt B</th>
                    <th className="py-3 px-4 text-slate-500">Alt C</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["NCDC syllabus & scheme of work", "✓", "✗", "✗", "✗"],
                    ["MTN MoMo + Airtel integration", "✓", "~", "✗", "✗"],
                    ["Student ID card generation", "✓", "✗", "✗", "✗"],
                    ["Transport route tracking", "✓", "✗", "✗", "✗"],
                    ["DNA + trend analysis", "✓", "✗", "✗", "✗"],
                    ["White-label option", "✓", "✗", "✗", "✗"],
                    ["Parent portal", "✓", "✓", "✓", "✗"],
                    ["Offline mode", "~", "✓", "✗", "✓"],
                    ["UNEB registration", "✓", "~", "✗", "✗"],
                    ["Full payroll", "✓", "✓", "✓", "~"],
                  ].map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="py-3 px-4 text-slate-700">{row[0]}</td>
                      <td className="py-3 px-4 text-center font-bold bg-green-50/50">
                        {row[1]}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-500">
                        {row[2]}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-500">
                        {row[3]}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-500">
                        {row[4]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </section>

        {/* ===== FAQ ===== */}
        <section
          id="faq"
          className="mx-auto max-w-3xl px-4 py-18 sm:px-6 lg:px-8 lg:py-24"
        >
          <FadeIn>
            <div className="text-center mb-10">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                Frequently asked questions
              </p>
              <h2 className="mt-3 font-['Sora'] text-2xl font-semibold text-slate-950 sm:text-3xl">
                Questions schools ask before signing up
              </h2>
            </div>
            <div className="space-y-3">
              {faqItems.map((item, i) => (
                <FadeIn key={item.q} delay={i * 80}>
                  <FAQItem q={item.q} a={item.a} />
                </FadeIn>
              ))}
            </div>
          </FadeIn>
        </section>

        {/* ===== FINAL CTA ===== */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="rounded-[36px] border border-[var(--border)] bg-[var(--surface)] px-6 py-8 shadow-[var(--sh1)] sm:px-8 lg:flex lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">
                  Ready to launch
                </p>
                <h2 className="mt-3 font-['Sora'] text-3xl font-semibold leading-tight tracking-[-0.04em] text-[var(--t1)]">
                  Give your school one place to run the term.
                </h2>
                <p className="mt-4 text-base leading-7 text-[var(--t2)]">
                  Register your school, set up classes and subjects, and start
                  using attendance, grading, fees, and parent communication in a
                  single workspace.
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
                <Link
                  href="/register"
                  className="btn btn-primary px-7 py-4 text-base"
                >
                  Start free trial
                </Link>
                <Link
                  href="/login"
                  className="btn btn-secondary px-7 py-4 text-base"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="border-t border-slate-200 bg-white pb-24 sm:pb-0">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <SkoolMateLogo size="md" variant="default" />
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  The school operating system built from real experience in
                  Ugandan schools.
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Product
                </h4>
                <ul className="mt-4 space-y-3">
                  <li>
                    <button
                      onClick={() => smoothScroll("#features")}
                      className="text-sm text-slate-600 hover:text-slate-900 transition cursor-pointer"
                    >
                      Features
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => smoothScroll("#comparison")}
                      className="text-sm text-slate-600 hover:text-slate-900 transition cursor-pointer"
                    >
                      Compare
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => smoothScroll("#security")}
                      className="text-sm text-slate-600 hover:text-slate-900 transition cursor-pointer"
                    >
                      Security
                    </button>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Resources
                </h4>
                <ul className="mt-4 space-y-3">
                  <li>
                    <a
                      href="/login"
                      className="text-sm text-slate-600 hover:text-slate-900 transition"
                    >
                      Sign In
                    </a>
                  </li>
                  <li>
                    <a
                      href="/register"
                      className="text-sm text-slate-600 hover:text-slate-900 transition"
                    >
                      Register School
                    </a>
                  </li>
                  <li>
                    <Link
                      href="/parent-portal"
                      className="text-sm text-slate-600 hover:text-slate-900 transition"
                    >
                      Parent Portal
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Contact
                </h4>
                <ul className="mt-4 space-y-3">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <MaterialIcon
                      icon="mail"
                      className="text-[16px] text-[#17325F]"
                    />
                    <a
                      href="mailto:os@omuto.org"
                      className="hover:text-slate-900 transition"
                    >
                      os@omuto.org
                    </a>
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <MaterialIcon
                      icon="phone"
                      className="text-[16px] text-[#17325F]"
                    />
                    <a
                      href="tel:0750028703"
                      className="hover:text-slate-900 transition"
                    >
                      0750 028 703
                    </a>
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <MaterialIcon
                      icon="chat"
                      className="text-[16px] text-[#25D366]"
                    />
                    <a
                      href="https://wa.me/256750028703"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-slate-900 transition"
                    >
                      WhatsApp
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-10 border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-400" suppressHydrationWarning>
                &copy; {new Date().getFullYear()} Omuto Foundation. All rights
                reserved.
              </p>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <MaterialIcon icon="lock" className="text-[14px]" />
                <span>Your data is encrypted and never shared.</span>
              </div>
            </div>
          </div>
        </footer>

        {/* ===== STICKY MOBILE CTA ===== */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 shadow-[0_-4px_24px_rgba(15,23,42,0.10)]">
          <div className="flex gap-3 max-w-sm mx-auto">
            <Link
              href="/register"
              className="btn btn-primary flex-1 justify-center py-3 text-sm"
            >
              Start free trial
            </Link>
            {installPrompt ? (
              <button
                onClick={handleInstallApp}
                className="btn btn-secondary py-3 px-5 text-sm flex items-center gap-2"
              >
                <MaterialIcon icon="install_mobile" className="text-[16px]" />
                Install
              </button>
            ) : (
              <Link href="/login" className="btn btn-secondary py-3 px-5 text-sm">
                Sign in
              </Link>
            )}
          </div>
        </div>

        <PWAInstallPrompt />

        {/* iOS Install Instructions Modal */}
        {showIosModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-800 mb-3">
                Add to Home Screen
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                On iPhone or iPad: Open this page in <strong>Safari</strong>, tap
                the <strong>Share Button</strong> (the square with arrow pointing
                up), then tap <strong>&quot;Add to Home Screen&quot;</strong>.
              </p>
              <button
                onClick={() => setShowIosModal(false)}
                className="w-full py-3 bg-primary-800 text-white rounded-xl font-bold text-sm hover:bg-primary-900 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </main>
    </PageErrorBoundary>
  );
}
