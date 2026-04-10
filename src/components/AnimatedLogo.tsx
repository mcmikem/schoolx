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
    type === "opening" ? "/opening.webp" : 
    type === "logo_white" ? "/SkoolMate logos/SchoolMate White.svg" :
    "/SkoolMate logos/SchoolMate logo official.svg";

  return (
    <div className={`relative ${className}`}>
      <Image
        src={src}
        alt="SkoolMate Animation"
        fill
        sizes="(max-width: 768px) 256px, 512px"
        className="object-contain"
        priority
        // Keep animated WebP behavior consistent by serving the original file.
        unoptimized
        style={{ contentVisibility: "auto" }}
      />
    </div>
  );
}
