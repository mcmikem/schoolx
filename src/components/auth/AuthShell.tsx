"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import { cn } from "@/lib/utils";

type Highlight = {
  icon: string;
  title: string;
  description: string;
};

interface AuthShellProps {
  badge: string;
  title: string;
  description: string;
  highlights: Highlight[];
  quickFacts: string[];
  contentTitle: string;
  contentDescription: string;
  children: ReactNode;
  footer?: ReactNode;
  supportNote?: ReactNode;
  panelClassName?: string;
}

export default function AuthShell({
  badge,
  title,
  description,
  highlights,
  quickFacts,
  contentTitle,
  contentDescription,
  children,
  footer,
  supportNote,
  panelClassName,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#eef4fb_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-[24px] border border-white/70 bg-white/75 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
          <SkoolMateLogo size="md" />
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            <MaterialIcon icon="arrow_back" size={16} />
            Back home
          </Link>
        </div>

        <div className="relative flex-1 overflow-hidden rounded-[32px] border border-white/80 bg-white/60 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="absolute left-[-10%] top-[-10%] h-56 w-56 rounded-full bg-[#17325F]/10 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] h-56 w-56 rounded-full bg-[#2E9448]/10 blur-3xl" />

          <div className="relative grid h-full lg:grid-cols-[1.08fr_0.92fr]">
            <section className="flex flex-col justify-between gap-8 px-5 py-8 sm:px-8 lg:px-10 lg:py-10 xl:px-12">
              <div className="space-y-6">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#17325F]/10 bg-[#17325F]/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#17325F]">
                  <MaterialIcon icon="verified" size={16} />
                  {badge}
                </div>

                <div className="max-w-2xl">
                  <h1 className="font-['Sora'] text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl lg:text-5xl">
                    {title}
                  </h1>
                  <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                    {description}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {quickFacts.map((fact) => (
                    <div
                      key={fact}
                      className="rounded-[24px] border border-slate-200/80 bg-white/90 p-4 shadow-sm"
                    >
                      <p className="text-sm font-semibold leading-6 text-slate-800">
                        {fact}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {highlights.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#17325F]/8 text-[#17325F]">
                        <MaterialIcon icon={item.icon} size={20} />
                      </div>
                      <h2 className="mt-4 text-base font-semibold text-slate-900">
                        {item.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-[#d7e4fb] bg-white/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#17325F]">
                  Designed for real school days
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Clear labels, large touch targets, and short steps help staff
                  finish tasks quickly on shared phones, office desktops, and
                  low-bandwidth connections.
                </p>
              </div>
            </section>

            <section className="border-t border-white/70 bg-white/80 px-4 py-6 backdrop-blur sm:px-6 lg:border-l lg:border-t-0 lg:px-8 lg:py-10">
              <div
                className={cn(
                  "mx-auto flex h-full w-full max-w-xl flex-col rounded-[30px] border border-white/80 bg-white/92 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-8",
                  panelClassName,
                )}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#17325F]">
                    {contentTitle}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
                    {contentDescription}
                  </p>
                </div>

                <div className="mt-6 flex-1">{children}</div>

                {supportNote ? (
                  <div className="mt-6 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600">
                    {supportNote}
                  </div>
                ) : null}

                {footer ? <div className="mt-6">{footer}</div> : null}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
