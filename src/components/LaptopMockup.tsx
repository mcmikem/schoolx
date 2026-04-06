"use client";

import { useState, useEffect } from "react";

interface AnimatedScreenProps {
  isActive: boolean;
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
  const [activeTab, setActiveTab] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="relative mx-auto max-w-5xl"
      style={{ filter: "drop-shadow(0 50px 80px rgba(0, 31, 63, 0.25))" }}
    >
      <div className="relative">
        {/* Screen Content - Behind the laptop frame */}
        <div className="absolute inset-0" style={{ zIndex: 1 }}>
          <div
            className="absolute overflow-hidden rounded-lg"
            style={{
              top: "3.5%",
              left: "6.5%",
              width: "87%",
              height: "76%",
            }}
          >
            <AnimatedDashboard isActive={true} />
          </div>
        </div>

        {/* Laptop SVG Frame - On top with transparent screen */}
        <svg
          viewBox="0 0 900 600"
          className="w-full h-auto relative"
          style={{ zIndex: 2, position: "relative" }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="lidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2d2d2d" />
              <stop offset="100%" stopColor="#1a1a1a" />
            </linearGradient>
            <linearGradient id="baseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3d3d3d" />
              <stop offset="50%" stopColor="#2a2a2a" />
              <stop offset="100%" stopColor="#1a1a1a" />
            </linearGradient>
            <filter
              id="screenShadow"
              x="-10%"
              y="-10%"
              width="120%"
              height="120%"
            >
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Laptop Lid */}
          <rect
            x="30"
            y="20"
            width="840"
            height="460"
            rx="20"
            fill="url(#lidGrad)"
            filter="url(#screenShadow)"
          />

          {/* Screen Bezel - with cutout for screen content */}
          <rect x="50" y="40" width="800" height="420" rx="10" fill="#000" />

          {/* Screen Background (slightly visible behind content) */}
          <rect
            x="58"
            y="48"
            width="784"
            height="404"
            rx="4"
            fill="url(#lidGrad)"
            opacity="0.3"
          />

          {/* Screen Edge Highlight */}
          <rect
            x="58"
            y="48"
            width="784"
            height="404"
            rx="4"
            fill="none"
            stroke="#333"
            strokeWidth="1"
          />

          {/* Camera Notch */}
          <circle cx="450" cy="32" r="5" fill="#1a1a1a" />
          <circle cx="450" cy="32" r="2" fill="#444" />

          {/* Laptop Base */}
          <path
            d="M0 480 L50 480 L50 540 Q50 560 75 560 L825 560 Q850 560 850 540 L850 480 L900 480 L900 545 Q900 575 875 575 L25 575 Q0 575 0 545 Z"
            fill="url(#baseGrad)"
          />

          {/* Base Shadow */}
          <ellipse cx="450" cy="580" rx="380" ry="12" fill="rgba(0,0,0,0.3)" />

          {/* Trackpad */}
          <rect
            x="350"
            y="495"
            width="200"
            height="30"
            rx="4"
            fill="rgba(255,255,255,0.08)"
          />

          {/* Base groove line */}
          <rect
            x="200"
            y="480"
            width="500"
            height="2"
            fill="rgba(255,255,255,0.1)"
          />
        </svg>
      </div>
    </div>
  );
}
