"use client";

import { QRCodeSVG } from "qrcode.react";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import Image from "next/image";

interface StudentIDCardProps {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    student_number: string;
    classes?: { name: string; stream?: string };
    date_of_birth?: string;
    boarding_status?: string;
    house?: { name: string };
    photo_url?: string;
  };
  school: {
    name: string;
    logo_url?: string;
    address?: string;
    phone?: string;
    primary_color?: string;
    accent_color?: string;
  };
}

function hexWithAlpha(hexColor: string, alphaHex: string): string {
  const normalized = (hexColor || "#1e3a8a").replace("#", "");
  if (normalized.length === 3) {
    const expanded = normalized
      .split("")
      .map((c) => `${c}${c}`)
      .join("");
    return `#${expanded}${alphaHex}`;
  }
  if (normalized.length === 6) return `#${normalized}${alphaHex}`;
  return "#1e3a8a22";
}

export default function StudentIDCard({ student, school }: StudentIDCardProps) {
  const className =
    student.classes?.name + (student.classes?.stream ? ` ${student.classes.stream}` : "");
  const primaryColor = school.primary_color || "#1e3a8a";
  const accentColor = school.accent_color || primaryColor;

  return (
    <div className="w-[85.6mm] h-[53.98mm] bg-white rounded-[4mm] shadow-xl overflow-hidden flex flex-col relative border border-slate-200 student-id-card print:shadow-none print:border-slate-300">
      {/* Background Motifs */}
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16"
        style={{ backgroundColor: hexWithAlpha(primaryColor, "26") }}
      />
      <div
        className="absolute bottom-0 left-0 w-24 h-24 rounded-full -ml-12 -mb-12"
        style={{ backgroundColor: hexWithAlpha(accentColor, "22") }}
      />

      {/* Header */}
      <div className="px-4 py-2 text-white flex items-center gap-2 relative z-10" style={{ backgroundColor: primaryColor }}>
        {school.logo_url ? (
          <Image
            src={school.logo_url}
            alt={school.name}
            width={24}
            height={24}
            className="w-6 h-6 rounded object-contain bg-white/20 shrink-0"
          />
        ) : (
          <SkoolMateLogo size="sm" variant="white" showText={false} className="shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-[10px] font-black leading-tight uppercase truncate">
            {school.name}
          </h3>
          <p className="text-[7px] font-bold tracking-wider leading-none" style={{ color: hexWithAlpha("#ffffff", "cc") }}>
            Digital Identity Card
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-3 flex gap-4 relative z-10">
        {/* Photo Area */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="w-[20mm] h-[25mm] bg-slate-100 rounded-lg border-2 overflow-hidden flex items-center justify-center shadow-sm"
            style={{ borderColor: hexWithAlpha(primaryColor, "33") }}
          >
            {student.photo_url ? (
              <Image
                src={student.photo_url}
                alt="Student"
                width={80}
                height={100}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl font-black text-slate-300">
                {student.first_name[0]}
                {student.last_name[0]}
              </span>
            )}
          </div>
          <p className="text-[8px] font-black tracking-tighter uppercase whitespace-nowrap" style={{ color: primaryColor }}>
            Valid {new Date().getFullYear()} - {new Date().getFullYear() + 1}
          </p>
        </div>

        {/* Info Area */}
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
              Name
            </p>
            <h4 className="text-[11px] font-black text-slate-800 leading-tight uppercase">
              {student.first_name} {student.last_name}
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
                Reg No
              </p>
              <p className="text-[9px] font-black leading-none" style={{ color: primaryColor }}>
                {student.student_number}
              </p>
            </div>
            <div>
              <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
                Class
              </p>
              <p className="text-[9px] font-black text-slate-700 leading-none">
                {className}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
                DOB
              </p>
              <p className="text-[9px] font-black text-slate-700 leading-none">
                {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
                Status
              </p>
              <p className="text-[9px] font-black text-slate-700 leading-none capitalize">
                {student.boarding_status || "Day"}
              </p>
            </div>
          </div>

          {student.house && (
            <div>
              <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-0.5">
                House
              </p>
              <p className="text-[9px] font-black text-slate-700 leading-none">
                {student.house.name}
              </p>
            </div>
          )}
        </div>

        {/* QR Code */}
        <div className="w-[15mm] flex flex-col items-center justify-center gap-1">
          <div className="p-1 bg-white rounded-lg shadow-sm border border-slate-100">
            <QRCodeSVG
              value={student.id}
              size={48}
              level="H"
              includeMargin={false}
            />
          </div>
          <p className="text-[6px] font-black text-slate-400 uppercase tracking-tighter text-center">
            Scan for Profile
          </p>
        </div>
      </div>

      {/* Footer / Stripe */}
      <div className="h-1 w-full" style={{ backgroundColor: primaryColor }} />
    </div>
  );
}
