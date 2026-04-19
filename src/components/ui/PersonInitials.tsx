"use client";

const COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
  "bg-indigo-100 text-indigo-700",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getColor(name: string): string {
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length;
  return COLORS[idx];
}

export default function PersonInitials({
  name,
  size = 40,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = getInitials(name || "?");
  const color = getColor(name || "?");
  const fontSize = Math.max(10, Math.round(size * 0.36));

  return (
    <div
      className={`${color} rounded-full inline-flex items-center justify-center font-semibold select-none shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize }}
    >
      {initials}
    </div>
  );
}
