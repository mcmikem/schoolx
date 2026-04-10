"use client";

import { QRCodeSVG } from "qrcode.react";
import SkoolMateLogo from "@/components/SkoolMateLogo";
import Image from "next/image";

interface StudentIDCardProps {
  student: {
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
  };
}

export default function StudentIDCard({ student, school }: StudentIDCardProps) {
  const className =
    student.classes?.name + (student.classes?.stream ? ` ${student.classes.stream}` : "");

  return (
    <div className="w-[85.6mm] h-[53.98mm] bg-white rounded-[4mm] shadow-xl overflow-hidden flex flex-col relative border border-slate-200 student-id-card print:shadow-none print:border-slate-300">
      {/* Background Motifs */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary-100/30 rounded-full -mr-16 -mt-16" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary-100/20 rounded-full -ml-12 -mb-12" />

      {/* Header */}
      <div className="px-4 py-2 bg-primary-800 text-white flex items-center gap-2 relative z-10">
        <SkoolMateLogo size="sm" variant="white" showText={false} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-[10px] font-black leading-tight uppercase truncate">
            {school.name}
          </h3>
          <p className="text-[7px] text-primary-200 font-bold tracking-wider leading-none">
            Digital Identity Card
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-3 flex gap-4 relative z-10">
        {/* Photo Area */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-[20mm] h-[25mm] bg-slate-100 rounded-lg border-2 border-primary-50 overflow-hidden flex items-center justify-center shadow-sm">
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
          <p className="text-[8px] font-black text-primary-800 tracking-tighter uppercase whitespace-nowrap">
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
              <p className="text-[9px] font-black text-primary-700 leading-none">
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
        </div>

        {/* QR Code */}
        <div className="w-[15mm] flex flex-col items-center justify-center gap-1">
          <div className="p-1 bg-white rounded-lg shadow-sm border border-slate-100">
            <QRCodeSVG
              value={`SM-OS:${student.student_number}`}
              size={48}
              level="H"
              includeMargin={false}
            />
          </div>
          <p className="text-[6px] font-black text-slate-400 uppercase tracking-tighter">
            Scan To Verify
          </p>
        </div>
      </div>

      {/* Footer / Stripe */}
      <div className="h-1 bg-primary-800 w-full" />
    </div>
  );
}
