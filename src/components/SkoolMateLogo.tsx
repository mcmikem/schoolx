"use client";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface SkoolMateLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "white" | "black";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: { icon: 24, text: "text-sm" },
  md: { icon: 32, text: "text-base" },
  lg: { icon: 48, text: "text-xl" },
  xl: { icon: 80, text: "text-3xl" },
};

const variants = {
  default: "SchoolMate logo official.svg",
  white: "SchoolMate White.svg",
  black: "SchoolMate black.svg",
};

export default function SkoolMateLogo({
  size = "md",
  variant = "default",
  showText = true,
  className,
}: SkoolMateLogoProps) {
  const s = sizes[size];
  const logoFile = variants[variant];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative" style={{ width: s.icon, height: s.icon }}>
        <Image
          src={`/SkoolMate logos/${logoFile}`}
          alt="SkoolMate OS Logo"
          width={s.icon}
          height={s.icon}
          className="object-contain"
        />
      </div>

      {showText && (
        <div className="flex flex-col">
          <span
            className={cn(
              s.text,
              "font-bold tracking-tight",
              variant === "white"
                ? "text-white"
                : variant === "black"
                  ? "text-black"
                  : "text-[var(--primary)]",
            )}
            style={{ fontFamily: "Montserrat, sans-serif" }}
          >
            SKOOLMATE OS
          </span>
        </div>
      )}
    </div>
  );
}
