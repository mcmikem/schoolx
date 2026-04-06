"use client";

import { useState, useEffect } from "react";

const navItems = [
  "Dashboard",
  "Students",
  "Attendance",
  "Exams",
  "Finance",
  "Messages",
];

export default function LaptopMockup() {
  const [activeTab, setActiveTab] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className="relative mx-auto max-w-5xl transition-all duration-700"
      style={{ filter: "drop-shadow(0 50px 80px rgba(0, 31, 63, 0.25))" }}
    >
      {/* Laptop SVG */}
      <svg
        viewBox="0 0 900 580"
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="lidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2d2d2d" />
            <stop offset="100%" stopColor="#1a1a1a" />
          </linearGradient>
          <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="baseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3d3d3d" />
            <stop offset="50%" stopColor="#2a2a2a" />
            <stop offset="100%" stopColor="#1a1a1a" />
          </linearGradient>
        </defs>

        {/* Laptop Lid */}
        <rect
          x="30"
          y="20"
          width="840"
          height="500"
          rx="24"
          fill="url(#lidGrad)"
        />

        {/* Screen Bezel */}
        <rect x="50" y="40" width="800" height="460" rx="12" fill="#000" />

        {/* Screen */}
        <rect x="58" y="48" width="784" height="444" rx="6" fill="#f1f5f9" />

        {/* Screen Content - Sidebar */}
        <rect x="58" y="48" width="180" height="444" rx="6" fill="#001F3F" />

        {/* Logo */}
        <rect
          x="75"
          y="65"
          width="40"
          height="40"
          rx="8"
          fill="rgba(212, 175, 55, 0.2)"
        />
        <text
          x="95"
          y="90"
          textAnchor="middle"
          fill="#D4AF37"
          fontSize="20"
          fontWeight="bold"
        >
          S
        </text>

        {/* Sidebar Title */}
        <rect x="75" y="115" width="100" height="14" rx="4" fill="#fff" />
        <rect
          x="75"
          y="135"
          width="70"
          height="10"
          rx="4"
          fill="rgba(255,255,255,0.5)"
        />

        {/* Nav Items */}
        {navItems.map((item, i) => (
          <g key={item}>
            <rect
              x="68"
              y={170 + i * 45}
              width="160"
              height="36"
              rx="8"
              fill={
                activeTab === i
                  ? "#D4AF37"
                  : i === 0
                    ? "rgba(255,255,255,0.08)"
                    : "transparent"
              }
              onClick={() => setActiveTab(i)}
              style={{ cursor: "pointer" }}
            />
            <text
              x="80"
              y={195 + i * 45}
              fill={activeTab === i ? "#001F3F" : "#fff"}
              fontSize="12"
              fontWeight="500"
            >
              {item}
            </text>
          </g>
        ))}

        {/* Gold accent */}
        <rect x="58" y="170" width="4" height="36" rx="2" fill="#D4AF37" />

        {/* Main Content Area */}
        <rect x="238" y="48" width="604" height="444" fill="#f8fafc" />

        {/* Top Bar */}
        <rect x="238" y="48" width="604" height="56" fill="#fff" />
        <circle cx="265" cy="76" r="16" fill="#001F3F" />
        <rect x="290" y="68" width="160" height="16" rx="8" fill="#e2e8f0" />

        {/* Stats Cards Row */}
        <g>
          {/* Card 1 */}
          <rect
            x="255"
            y="120"
            width="170"
            height="90"
            rx="12"
            fill="#fff"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
          <rect x="265" y="132" width="80" height="10" rx="4" fill="#94a3b8" />
          <rect x="265" y="152" width="60" height="28" rx="6" fill="#001F3F" />
          <text
            x="295"
            y="172"
            textAnchor="middle"
            fill="#fff"
            fontSize="14"
            fontWeight="bold"
          >
            UGX 18.4M
          </text>

          {/* Card 2 */}
          <rect
            x="440"
            y="120"
            width="170"
            height="90"
            rx="12"
            fill="#fff"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
          <rect x="450" y="132" width="80" height="10" rx="4" fill="#94a3b8" />
          <rect x="450" y="152" width="60" height="28" rx="6" fill="#D4AF37" />
          <text
            x="480"
            y="172"
            textAnchor="middle"
            fill="#fff"
            fontSize="14"
            fontWeight="bold"
          >
            43 Staff
          </text>

          {/* Card 3 */}
          <rect
            x="625"
            y="120"
            width="170"
            height="90"
            rx="12"
            fill="#fff"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
          <rect x="635" y="132" width="80" height="10" rx="4" fill="#94a3b8" />
          <rect x="635" y="152" width="60" height="28" rx="6" fill="#10b981" />
          <text
            x="665"
            y="172"
            textAnchor="middle"
            fill="#fff"
            fontSize="14"
            fontWeight="bold"
          >
            3 Low
          </text>
        </g>

        {/* Table */}
        <rect
          x="255"
          y="230"
          width="540"
          height="240"
          rx="12"
          fill="#fff"
          stroke="#e2e8f0"
          strokeWidth="1"
        />

        {/* Table Header */}
        <rect x="255" y="230" width="540" height="40" rx="12" fill="#f1f5f9" />
        <rect x="270" y="242" width="60" height="12" rx="4" fill="#64748b" />
        <rect x="370" y="242" width="60" height="12" rx="4" fill="#64748b" />
        <rect x="470" y="242" width="60" height="12" rx="4" fill="#64748b" />
        <rect x="620" y="242" width="60" height="12" rx="4" fill="#64748b" />

        {/* Table Rows */}
        {[
          {
            name: "Nakamya Amina",
            className: "P.6",
            status: "Active",
            color: "#001F3F",
          },
          {
            name: "Ochen Brian",
            className: "P.6",
            status: "Active",
            color: "#334155",
          },
          {
            name: "Tumusiime Claire",
            className: "P.5",
            status: "Active",
            color: "#334155",
          },
          {
            name: "Mugisha Daniel",
            className: "P.5",
            status: "Pending",
            color: "#f59e0b",
          },
          {
            name: "Nalubega Esther",
            className: "P.4",
            status: "Active",
            color: "#334155",
          },
        ].map((row, i) => (
          <g key={i}>
            <rect
              x="270"
              y={285 + i * 40}
              width="100"
              height="20"
              rx="4"
              fill={row.color}
            />
            <text x="280" y={300 + i * 40} fill="#fff" fontSize="10">
              {row.name}
            </text>

            <rect
              x="370"
              y={285 + i * 40}
              width="50"
              height="20"
              rx="4"
              fill="#94a3b8"
            />
            <text x="380" y={300 + i * 40} fill="#fff" fontSize="9">
              {row.className}
            </text>

            <rect
              x="470"
              y={285 + i * 40}
              width="70"
              height="20"
              rx="10"
              fill={i === 3 ? "#fef3c7" : "#dcfce7"}
            />
            <text
              x="485"
              y={300 + i * 40}
              fill={i === 3 ? "#92400e" : "#166534"}
              fontSize="9"
            >
              {row.status}
            </text>

            <rect
              x="620"
              y={285 + i * 40}
              width="80"
              height="20"
              rx="4"
              fill={i < 2 ? "#10b981" : "#f59e0b"}
            />
          </g>
        ))}

        {/* Screen Notch Camera */}
        <circle cx="450" cy="30" r="4" fill="#333" />
        <circle cx="450" cy="30" r="2" fill="#555" />

        {/* Laptop Base */}
        <path
          d="M0 520 L50 520 L50 555 Q50 575 75 575 L825 575 Q850 575 850 555 L850 520 L900 520 L900 565 Q900 590 875 590 L25 590 Q0 590 0 565 Z"
          fill="url(#baseGrad)"
        />

        {/* Base Shadow */}
        <ellipse cx="450" cy="585" rx="380" ry="10" fill="rgba(0,0,0,0.25)" />

        {/* Trackpad Indentation */}
        <rect
          x="350"
          y="530"
          width="200"
          height="25"
          rx="4"
          fill="rgba(255,255,255,0.1)"
        />
      </svg>
    </div>
  );
}
