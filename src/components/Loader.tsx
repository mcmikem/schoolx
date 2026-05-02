"use client";

import Image from "next/image";
import { t } from "@/i18n";
import { OwlLoader } from "./loaders";

/* ────────────────────────────────────────────────────────────────
   SkoolMate OS — App Loader (full-screen)
   Replaced old pulse/spinner with animated OwlLoader.
   ──────────────────────────────────────────────────────────────── */

export default function AppLoader() {
  return (
    <OwlLoader
      fullScreen
      size={140}
      text="SkoolMate OS"
      subtext="Preparing your school dashboard..."
    />
  );
}

/* ─── Fallback minimal loader (for SSR / no-js) ─── */
export function MinimalLoader() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        gap: 24,
        zIndex: 9999,
      }}
    >
      <Image
        src="/SkoolMate logos/SchoolMate logo official.svg"
        alt="SkoolMate OS"
        width={64}
        height={64}
        priority
      />
      <div
        style={{
          fontFamily: "Sora",
          fontSize: 16,
          fontWeight: 600,
          color: "var(--navy)",
        }}
      >
        {t("common.loading")}
      </div>
    </div>
  );
}

/* ─── Re-exports for convenience ─── */
export { OwlLoader } from "./loaders";
export {
  Skeleton,
  CardSkeleton,
  TableSkeleton,
  StatsSkeleton,
  FormSkeleton,
  PageSkeleton,
  SidebarSkeleton,
} from "./loaders";
export {
  RingSpinner,
  DotPulse,
  OrbitalSpinner,
  CircularProgress,
  TopProgressBar,
} from "./loaders";

/* ─── Existing utility components (unchanged) ─── */

export function PageError({
  title = "Something went wrong",
  message = "Please try again or refresh the page",
  action,
}: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        textAlign: "center",
        minHeight: 300,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "var(--red-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 32, color: "var(--red)" }}
        >
          error_outline
        </span>
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "var(--t1)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 14,
          color: "var(--t3)",
          maxWidth: 300,
          marginBottom: action ? 20 : 0,
        }}
      >
        {message}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon = "inbox",
  title = "No data yet",
  message = "Get started by adding your first item",
  action,
}: {
  icon?: string;
  title?: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        textAlign: "center",
        minHeight: 250,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: "var(--bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 28, color: "var(--t3)" }}
        >
          {icon}
        </span>
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--t1)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--t3)",
          maxWidth: 280,
          marginBottom: action ? 16 : 0,
        }}
      >
        {message}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function HelperTip({
  title,
  steps,
}: {
  title: string;
  steps: string[];
}) {
  return (
    <div
      style={{
        background: "var(--navy-soft)",
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--navy)",
          marginBottom: 12,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          lightbulb
        </span>
        {title}
      </div>
      <ol
        style={{
          paddingLeft: 20,
          margin: 0,
          fontSize: 12,
          color: "var(--t2)",
          lineHeight: 1.8,
        }}
      >
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
