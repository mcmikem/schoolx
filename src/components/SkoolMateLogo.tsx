"use client";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface SkoolMateLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "white" | "dark";
  showText?: boolean;
  className?: string;
}

export default function SkoolMateLogo({
  size = "md",
  variant = "default",
  showText = true,
  className,
}: SkoolMateLogoProps) {
  const sizes = {
    sm: { icon: 32, text: "text-lg" },
    md: { icon: 40, text: "text-xl" },
    lg: { icon: 56, text: "text-2xl" },
    xl: { icon: 80, text: "text-4xl" },
  };

  const logoFiles = {
    default: "SchoolMate logo official.svg",
    white: "SchoolMate White.svg",
    dark: "SchoolMate black.svg",
  };

  const s = sizes[size];
  const logoFile = logoFiles[variant];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative" style={{ width: s.icon, height: s.icon }}>
        <Image
          src={`/SkoolMate logos/${logoFile}`}
          alt="SkoolMate OS Logo"
          width={s.icon}
          height={s.icon}
          className="object-contain"
          unoptimized
        />
      </div>

      {showText && (
        <div className="flex flex-col">
          <span
            className={cn(s.text, "font-bold leading-tight")}
            style={{
              color:
                variant === "white"
                  ? "#ffffff"
                  : variant === "dark"
                    ? "#000000"
                    : "#001F3F",
              fontFamily: "Montserrat, sans-serif",
              letterSpacing: "0.05em",
            }}
          >
            SKOOLMATE OS
          </span>
          {size !== "sm" && (
            <span className="text-[10px] text-outline font-medium tracking-wider uppercase leading-tight">
              Your Digital School Partner
            </span>
          )}
        </div>
      )}
    </div>
  );
}
