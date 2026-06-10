"use client";

import Image from "next/image";

interface AnimatedLogoProps {
  type?: "opening" | "logo_white" | "logo";
  className?: string;
  autoplay?: boolean;
}

export default function AnimatedLogo({
  type = "opening",
  className = "",
  autoplay = true,
}: AnimatedLogoProps) {
  const src =
    type === "opening"
      ? "/opening.webp"
      : type === "logo_white"
        ? "/SkoolMate logos/SchoolMate White.svg"
        : "/SkoolMate logos/SchoolMate logo official.svg";

  return (
    <div className={`relative ${className}`}>
      <Image
        src={src}
        alt="SkoolMate Animation"
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="object-contain"
        priority
        unoptimized={autoplay}
        style={{ contentVisibility: "auto" }}
      />
    </div>
  );
}
