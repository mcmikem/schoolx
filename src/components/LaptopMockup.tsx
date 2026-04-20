"use client";

import { useState, useEffect } from "react";

interface AnimatedScreenProps {
  isActive: boolean;
}

function DashboardScreen({ isActive }: AnimatedScreenProps) {
  const [activeNav, setActiveNav] = useState(0);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (isActive) {
      const t = setTimeout(() => setAnimated(true), 400);
      return () => clearTimeout(t);
    }
  }, [isActive]);

  const navItems = [
    { icon: "dashboard", label: "Dashboard" },
    { icon: "group", label: "Students" },
    { icon: "how_to_reg", label: "Attendance" },
    { icon: "fact_check", label: "Exams" },
    { icon: "payments", label: "Finance" },
    { icon: "sms", label: "Messages" },
  ];

  const stats = [
    { icon: "how_to_reg", label: "Present Today", value: "782", sub: "out of 847", color: "#10b981" },
    { icon: "payments", label: "Fees Collected", value: "18.4M", sub: "UGX this term", color: "#001F3F" },
    { icon: "warning", label: "Pending Fees", value: "127", sub: "students", color: "#d97706" },
    { icon: "sms", label: "SMS Today", value: "426", sub: "97% delivered", color: "#0d9488" },
  ];

  const attendance = [
    { cls: "S.4", pct: 88, color: "#001F3F" },
    { cls: "S.3", pct: 91, color: "#10b981" },
    { cls: "S.2", pct: 76, color: "#d97706" },
    { cls: "S.1", pct: 85, color: "#001F3F" },
    { cls: "P.7", pct: 95, color: "#10b981" },
  ];

  const quickActions = [
    { icon: "add_card", label: "Record Payment" },
    { icon: "how_to_reg", label: "Take Attendance" },
    { icon: "sms", label: "Send Bulk SMS" },
    { icon: "description", label: "Print Reports" },
  ];

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "system-ui, -apple-system, sans-serif", overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: "22%", background: "#001F3F", display: "flex", flexDirection: "column", padding: "8px 5px", flexShrink: 0 }}>
        <div style={{ padding: "4px 7px 8px", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: 5 }}>
          <div style={{ color: "white", fontWeight: 800, fontSize: "7px", letterSpacing: "0.06em" }}>SkoolMate OS</div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "5.5px", marginTop: 1 }}>Head Teacher</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 4 }}>
          {navItems.map((item, i) => (
            <button
              key={item.label}
              onClick={() => setActiveNav(i)}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "4px 7px",
                borderRadius: 5, cursor: "pointer", border: "none",
                background: activeNav === i ? "rgba(255,255,255,0.15)" : "transparent",
                color: activeNav === i ? "white" : "rgba(255,255,255,0.5)",
                fontSize: "6.5px", fontWeight: activeNav === i ? 600 : 400, textAlign: "left", width: "100%",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 10 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <div style={{ background: "white", borderBottom: "1px solid #e8ecef", padding: "5px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: "8px", fontWeight: 700, color: "#001F3F" }}>Dashboard</div>
            <div style={{ fontSize: "5.5px", color: "#586979" }}>Term II · April 2026</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ background: "#f4f7f9", border: "1px solid #e8ecef", borderRadius: 4, padding: "2px 6px", fontSize: "6px", color: "#586979" }}>🔍 Search...</div>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#001F3F", color: "white", fontSize: "6px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>HT</div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "8px 10px", overflow: "hidden", display: "flex", flexDirection: "column", gap: 6, background: "#f4f7f9" }}>
          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ background: "white", borderRadius: 7, padding: "6px 8px", border: "1px solid #e8ecef", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 3 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 9, color: s.color }}>{s.icon}</span>
                  <span style={{ fontSize: "5.5px", color: "#586979", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
                </div>
                <div style={{ fontSize: "12px", fontWeight: 800, color: "#001F3F", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: "5.5px", color: "#8a9aaa", marginTop: 1 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Chart + Quick actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 5, flex: 1, minHeight: 0 }}>
            {/* Attendance bars */}
            <div style={{ background: "white", borderRadius: 7, padding: "7px 9px", border: "1px solid #e8ecef", overflow: "hidden" }}>
              <div style={{ fontSize: "6.5px", fontWeight: 700, color: "#001F3F", marginBottom: 6 }}>Attendance by Class · Today</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {attendance.map((a, i) => (
                  <div key={a.cls} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: "6px", color: "#586979", width: 16, flexShrink: 0 }}>{a.cls}</span>
                    <div style={{ flex: 1, height: 5, background: "#f0f4f8", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 3, background: a.color,
                        width: animated ? `${a.pct}%` : "0%",
                        transition: `width 0.9s ease ${i * 0.12}s`,
                      }} />
                    </div>
                    <span style={{ fontSize: "6px", color: "#586979", width: 20, textAlign: "right" }}>{a.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ background: "white", borderRadius: 7, padding: "7px 9px", border: "1px solid #e8ecef" }}>
              <div style={{ fontSize: "6.5px", fontWeight: 700, color: "#001F3F", marginBottom: 5 }}>Quick Actions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {quickActions.map((a) => (
                  <div key={a.label} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 6px", background: "#f4f7f9", borderRadius: 5 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 9, color: "#001F3F" }}>{a.icon}</span>
                    <span style={{ fontSize: "6.5px", color: "#3e4c59", fontWeight: 500 }}>{a.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnimatedDashboard({ isActive }: AnimatedScreenProps) {
  const [stats, setStats] = useState([
    { label: "Revenue", value: "UGX 18.4M", color: "#001F3F" },
    { label: "Staff", value: "43", color: "#D4AF37" },
    { label: "Attendance", value: "3 Low", color: "#10b981" },
  ]);

  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => {
        setStats((prev) =>
          prev.map((s, i) => ({
            ...s,
            value:
              i === 0
                ? `UGX ${(17.5 + Math.random() * 2).toFixed(1)}M`
                : s.value,
          })),
        );
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isActive]);

  return (
    <div className="w-full h-full bg-slate-50 p-4">
      <div className="flex gap-3 mb-4">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 flex-1"
          >
            <div className="text-xs text-slate-500 mb-1">{stat.label}</div>
            <div
              className="text-lg font-bold rounded-lg px-3 py-1 text-white"
              style={{ backgroundColor: stat.color }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex gap-8">
          {["Name", "Class", "Status", "Fees"].map((h) => (
            <div key={h} className="text-xs font-medium text-slate-500">
              {h}
            </div>
          ))}
        </div>
        {[
          {
            name: "Nakamya Amina",
            cls: "P.6",
            status: "Active",
            color: "green",
          },
          { name: "Ochen Brian", cls: "P.6", status: "Active", color: "green" },
          {
            name: "Tumusiime Claire",
            cls: "P.5",
            status: "Active",
            color: "green",
          },
          {
            name: "Mugisha Daniel",
            cls: "P.5",
            status: "Pending",
            color: "amber",
          },
        ].map((row, i) => (
          <div
            key={i}
            className="flex items-center px-4 py-2 border-b border-slate-100"
          >
            <div className="w-24 text-xs font-medium text-slate-700">
              {row.name}
            </div>
            <div className="w-12 text-xs text-slate-500">{row.cls}</div>
            <div className="w-16">
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full ${
                  row.color === "green"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {row.status}
              </span>
            </div>
            <div className="w-16">
              <span
                className={`text-[10px] px-2 py-0.5 rounded ${
                  i < 2 ? "bg-emerald-500" : "bg-amber-500"
                } text-white`}
              >
                {i < 2 ? "Paid" : "Partial"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const navItems = [
  { icon: "📊", label: "Dashboard" },
  { icon: "👥", label: "Students" },
  { icon: "📅", label: "Attendance" },
  { icon: "📝", label: "Exams" },
  { icon: "💰", label: "Finance" },
  { icon: "💬", label: "Messages" },
];

export default function LaptopMockup() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={`transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      style={{ filter: "drop-shadow(0 48px 96px rgba(0,31,63,0.32))", maxWidth: 680, margin: "0 auto" }}
    >
      {/* ── Lid ── */}
      <div style={{
        background: "linear-gradient(155deg, #404040 0%, #232323 60%, #181818 100%)",
        borderRadius: "20px 20px 0 0",
        padding: "6px 8px 0",
        border: "1px solid rgba(255,255,255,0.09)",
        borderBottom: "none",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
        position: "relative",
      }}>
        {/* Camera / notch bar */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 14, marginBottom: 4 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "radial-gradient(circle at 35% 35%, #4a4a4c, #1c1c1e)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 0 0 2px rgba(0,0,0,0.4)",
          }} />
        </div>

        {/* Screen — 16:10 aspect ratio (MacBook) */}
        <div style={{
          background: "#f4f7f9",
          borderRadius: "5px 5px 0 0",
          overflow: "hidden",
          aspectRatio: "16 / 10",
          width: "100%",
          border: "1px solid rgba(0,0,0,0.2)",
          borderBottom: "none",
        }}>
          <DashboardScreen isActive={mounted} />
        </div>
      </div>

      {/* ── Hinge ── */}
      <div style={{
        height: 7,
        background: "linear-gradient(180deg, #151515 0%, #0d0d0d 100%)",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }} />

      {/* ── Base (palmrest + keyboard + trackpad) ── */}
      <div style={{
        background: "linear-gradient(180deg, #383838 0%, #282828 40%, #1c1c1c 100%)",
        borderRadius: "0 0 18px 18px",
        padding: "14px 26px 20px",
        border: "1px solid rgba(255,255,255,0.07)",
        borderTop: "none",
        boxShadow: "0 10px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}>
        {/* Keyboard rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 12 }}>
          {([14, 13, 12] as const).map((count, row) => (
            <div key={row} style={{ display: "flex", gap: 3, justifyContent: "center" }}>
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} style={{
                  flex: 1,
                  height: 9,
                  background: "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.06) 100%)",
                  borderRadius: 3,
                  border: "1px solid rgba(0,0,0,0.35)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.06)",
                }} />
              ))}
            </div>
          ))}
        </div>

        {/* Trackpad */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{
            width: "38%",
            height: 52,
            background: "linear-gradient(155deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), 0 1px 3px rgba(0,0,0,0.3)",
          }} />
        </div>
      </div>
    </div>
  );
}
