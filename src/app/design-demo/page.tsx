"use client";

import { useState } from "react";

const C = {
  canvas: "#010102",
  surface1: "#0f1011",
  surface2: "#141516",
  surface3: "#18191a",
  hairline: "#23252a",
  ink: "#f7f8f8",
  inkMuted: "#d0d6e0",
  inkSubtle: "#8a8f98",
  inkTertiary: "#62666d",
  primary: "#5e6ad2",
  primaryHover: "#828fff",
  success: "#27a644",
};
const fontDisplay = '"SF Pro Display", "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
const fontText = '"SF Pro Text", "Inter", -apple-system, BlinkMacSystemFont, sans-serif';

export default function DesignDemoPage() {
  const [toggled, setToggled] = useState(false);
  return (
    <div style={{ background: C.canvas, color: C.ink, fontFamily: fontText, minHeight: "100vh" }}>
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
          borderBottom: `1px solid ${C.hairline}`,
          position: "sticky",
          top: 0,
          background: C.canvas,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: C.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 13,
              color: "#fff",
            }}
          >
            S
          </div>
          <span style={{ fontFamily: fontDisplay, fontWeight: 600, fontSize: 15, letterSpacing: "-0.2px" }}>
            SkoolMate
          </span>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 13, color: C.inkSubtle }}>
          <span>Dashboard</span>
          <span>Students</span>
          <span>Fees</span>
          <span>Reports</span>
        </div>
        <button
          style={{
            background: C.primary,
            color: "#fff",
            border: "none",
            padding: "8px 16px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: fontText,
          }}
        >
          New student
        </button>
      </nav>
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "64px 32px" }}>
        <section style={{ marginBottom: 80 }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: C.inkTertiary,
              marginBottom: 16,
            }}
          >
            Design showcase · Linear system
          </p>
          <h1
            style={{
              fontFamily: fontDisplay,
              fontSize: 56,
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-1.8px",
              margin: 0,
              maxWidth: 720,
            }}
          >
            Software-craft documentation for school operations.
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.5, color: C.inkSubtle, maxWidth: 640, marginTop: 24 }}>
            Dense, technical, quietly luxurious. The accent lavender appears on the brand mark, focus rings, and a few
            intentional CTAs — never decoratively.
          </p>
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 64 }}>
          {[
            { label: "Students", value: "1,248", delta: "+34 this term", tone: C.success },
            { label: "Fees collected", value: "UGX 42.3M", delta: "87% of target", tone: C.primary },
            { label: "Attendance", value: "94.2%", delta: "−1.1% vs last week", tone: C.inkSubtle },
          ].map((s) => (
            <div
              key={s.label}
              style={{ background: C.surface1, border: `1px solid ${C.hairline}`, borderRadius: 8, padding: 24 }}
            >
              <div style={{ fontSize: 12, color: C.inkTertiary, marginBottom: 8, fontWeight: 500 }}>{s.label}</div>
              <div style={{ fontFamily: fontDisplay, fontSize: 32, fontWeight: 600, letterSpacing: "-0.6px" }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12, color: s.tone, marginTop: 8 }}>{s.delta}</div>
            </div>
          ))}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 64 }}>
          <div style={{ background: C.surface1, border: `1px solid ${C.hairline}`, borderRadius: 8, padding: 24 }}>
            <h2 style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 500, letterSpacing: "-0.4px", margin: 0 }}>
              Recent activity
            </h2>
            <p style={{ fontSize: 13, color: C.inkSubtle, marginTop: 4, marginBottom: 20 }}>
              Last 5 events across your school.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { t: "Fee payment received", d: "Sarah Nakato · UGX 450,000", time: "2m ago" },
                { t: "New student enrolled", d: "James Otim · P.4 East", time: "14m ago" },
                { t: "Report card generated", d: "P.6 batch · Term 2", time: "1h ago" },
                { t: "SMS sent to 124 parents", d: "Fee reminder campaign", time: "3h ago" },
                { t: "Timetable updated", d: "P.5 Science · Room 12", time: "5h ago" },
              ].map((e, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderTop: i === 0 ? "none" : `1px solid ${C.hairline}`,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{e.t}</div>
                    <div style={{ fontSize: 12, color: C.inkSubtle, marginTop: 2 }}>{e.d}</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.inkTertiary, fontFamily: "ui-monospace, monospace" }}>
                    {e.time}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ background: C.surface1, border: `1px solid ${C.hairline}`, borderRadius: 8, padding: 24 }}>
            <h2 style={{ fontFamily: fontDisplay, fontSize: 22, fontWeight: 500, letterSpacing: "-0.4px", margin: 0 }}>
              Quick add student
            </h2>
            <p style={{ fontSize: 13, color: C.inkSubtle, marginTop: 4, marginBottom: 20 }}>
              Minimal fields. Everything else can be filled later.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                placeholder="Full name"
                style={{
                  background: C.surface2,
                  border: `1px solid ${C.hairline}`,
                  borderRadius: 6,
                  padding: "10px 12px",
                  color: C.ink,
                  fontSize: 14,
                  fontFamily: fontText,
                  outline: "none",
                }}
              />
              <input
                placeholder="Class (e.g. P.4 East)"
                style={{
                  background: C.surface2,
                  border: `1px solid ${C.hairline}`,
                  borderRadius: 6,
                  padding: "10px 12px",
                  color: C.ink,
                  fontSize: 14,
                  fontFamily: fontText,
                  outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                <button
                  onClick={() => setToggled(!toggled)}
                  style={{
                    width: 36,
                    height: 20,
                    borderRadius: 10,
                    background: toggled ? C.primary : C.surface3,
                    border: `1px solid ${toggled ? C.primary : C.hairline}`,
                    position: "relative",
                    cursor: "pointer",
                    transition: "background 120ms",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: toggled ? 18 : 2,
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      background: "#fff",
                      transition: "left 120ms",
                    }}
                  />
                </button>
                <span style={{ fontSize: 13, color: C.inkSubtle }}>Boarding student</span>
              </div>
              <button
                style={{
                  background: C.primary,
                  color: "#fff",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: fontText,
                  marginTop: 8,
                }}
              >
                Add student
              </button>
            </div>
          </div>
        </section>
        <section
          style={{
            background: C.surface1,
            border: `1px solid ${C.hairline}`,
            borderRadius: 8,
            padding: 24,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 13,
            lineHeight: 1.6,
            color: C.inkMuted,
          }}
        >
          <div
            style={{
              color: C.inkTertiary,
              marginBottom: 8,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Terminal
          </div>
          <div>
            <span style={{ color: C.primary }}>~</span> npm run dev
          </div>
          <div style={{ color: C.inkSubtle }}> ▲ Next.js 16.0.0 (Turbopack)</div>
          <div style={{ color: C.inkSubtle }}> - Local: http://localhost:3000</div>
          <div style={{ color: C.success }}> ✓ Ready in 1.2s</div>
        </section>
        <footer
          style={{
            marginTop: 80,
            paddingTop: 24,
            borderTop: `1px solid ${C.hairline}`,
            fontSize: 12,
            color: C.inkTertiary,
          }}
        >
          Linear design system showcase · SkoolMate OS · /design-demo
        </footer>
      </main>
    </div>
  );
}
