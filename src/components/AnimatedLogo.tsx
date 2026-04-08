"use client";

interface AnimatedLogoProps {
  type?: "opening" | "logo_white";
  className?: string;
  autoplay?: boolean;
}

export default function AnimatedLogo({
  type = "opening",
  className = "",
  autoplay = true,
}: AnimatedLogoProps) {
  const src = type === "opening" ? "/opening.webp" : "/logo-white.webp";

  return (
    <div className={`relative ${className}`}>
      <img
        src={src}
        alt="SkoolMate Animation"
        className="w-full h-full object-contain"
        style={{
          animation: autoplay ? "none" : "paused",
          contentVisibility: "auto",
        }}
      />
    </div>
  );
}
