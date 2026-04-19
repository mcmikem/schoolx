"use client";

import Image from "next/image";
import OwlMascot from "@/components/brand/OwlMascot";

interface StudentPhotoFieldProps {
  photoUrl?: string;
  firstName?: string;
  lastName?: string;
  gender?: "M" | "F";
  uploading?: boolean;
  title?: string;
  description?: string;
  onUpload: (file: File) => Promise<void> | void;
  size?: number;
  circular?: boolean;
}

export default function StudentPhotoField({
  photoUrl,
  firstName,
  lastName,
  gender = "M",
  uploading = false,
  title = "Passport Photo",
  description,
  onUpload,
  size = 88,
  circular = true,
}: StudentPhotoFieldProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 20,
        padding: 16,
        borderRadius: 16,
        background:
          "linear-gradient(135deg, rgba(0,31,63,0.04), rgba(46,148,72,0.05))",
        border: "1px solid var(--border)",
      }}
    >
      <label
        style={{
          width: size,
          height: circular ? size : size * 1.2,
          borderRadius: circular ? "50%" : 16,
          background: "var(--bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          border: "2px dashed var(--border)",
          cursor: "pointer",
          flexShrink: 0,
        }}
        title="Upload student passport photo"
      >
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            await onUpload(file);
            event.target.value = "";
          }}
          style={{ display: "none" }}
        />
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={`${firstName || "Student"} ${lastName || ""}`}
            width={size}
            height={circular ? size : size * 1.2}
            unoptimized
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                gender === "M"
                  ? "linear-gradient(180deg, rgba(11,28,57,0.08), rgba(46,148,72,0.06))"
                  : "linear-gradient(180deg, rgba(11,28,57,0.08), rgba(190,67,89,0.06))",
            }}
          >
            <OwlMascot size={Math.max(42, Math.round(size * 0.62))} premium ring glow />
          </div>
        )}
      </label>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--t3)",
            marginBottom: 6,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>
          Identity-ready student record
        </div>
        <p
          style={{
            fontSize: 12,
            color: "var(--t3)",
            marginTop: 6,
            lineHeight: 1.55,
          }}
        >
          {description ||
            "This photo will appear on the student profile, ID card, and report-ready documents."}
        </p>
        <div
          style={{
            fontSize: 12,
            color: "var(--primary)",
            marginTop: 8,
            fontWeight: 600,
          }}
        >
          {uploading
            ? "Uploading passport photo..."
            : photoUrl
              ? "Photo attached. Click the avatar to replace it."
              : "Click the owl avatar area to upload a passport photo. Large images are auto-shrunk below 5MB where possible."}
        </div>
      </div>
    </div>
  );
}