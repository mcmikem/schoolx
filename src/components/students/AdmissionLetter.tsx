"use client";

import SkoolMateLogo from "@/components/SkoolMateLogo";
import MaterialIcon from "@/components/MaterialIcon";

interface AdmissionLetterProps {
  student: any;
  school: any;
  academicYear: string;
}

export default function AdmissionLetter({ student, school, academicYear }: AdmissionLetterProps) {
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="w-[210mm] min-h-[297mm] bg-white p-[20mm] shadow-2xl mx-auto print:shadow-none print:p-0 admission-letter text-slate-800 font-serif">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-primary-800 pb-6 mb-8">
        <div className="flex gap-4">
          <SkoolMateLogo size="lg" variant="default" showText={false} />
          <div>
            <h1 className="text-2xl font-black text-primary-900 uppercase leading-none">{school.name}</h1>
            <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">{school.address || "P.O Box 123, Kampala, Uganda"}</p>
            <p className="text-xs font-bold text-slate-400 mt-0.5">{school.phone || "+256 000 000 000"} | {school.email || "info@school.com"}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-primary-700">Admission Ref: {student.student_number || "ADM/2026/001"}</p>
          <p className="text-xs text-slate-500 font-medium">{currentDate}</p>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-10">
        <h2 className="text-xl font-black underline decoration-primary-500 decoration-2 underline-offset-8 uppercase tracking-widest">Letter of Admission</h2>
      </div>

      {/* Salutation */}
      <div className="mb-6">
        <p className="font-bold">To: {student.parent_name || "Parent/Guardian"},</p>
        <p className="mt-2 leading-relaxed">
          The School Management is pleased to offer <span className="font-black underline">{student.first_name} {student.last_name}</span> a place in 
          <span className="font-black"> {student.classes?.name || "the school"}</span> for the academic year <span className="font-bold">{academicYear}</span>.
        </p>
      </div>

      {/* Body */}
      <div className="space-y-6 text-sm leading-relaxed text-justify">
        <p>
          We are delighted that you have chosen <span className="font-bold italic">{school.name}</span> for your child's education. 
          Our school is committed to providing a holistic and nurturing environment that fosters academic excellence and moral integrity.
        </p>

        <div>
          <h3 className="font-black text-primary-800 uppercase text-xs tracking-wider mb-2">1. Registration Details</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><span className="font-bold">Student Number:</span> {student.student_number || "Pending"}</li>
            <li><span className="font-bold">Term / Commencement:</span> Term 1, May 2026</li>
            <li><span className="font-bold">Boarding Status:</span> {student.boarding_status || "Day"} Scholar</li>
          </ul>
        </div>

        <div>
          <h3 className="font-black text-primary-800 uppercase text-xs tracking-wider mb-2">2. Fee Payment</h3>
          <p>
            An admission fee of <span className="font-bold">UGX 150,000</span> is payable immediately to secure the vacancy. 
            All other school fees must be paid in full by the start of the term as per the attached fee structure.
          </p>
        </div>

        <div>
          <h3 className="font-black text-primary-800 uppercase text-xs tracking-wider mb-2">3. Requirements</h3>
          <p>
            Please ensure that the student is provided with all necessary school requirements, including 2 reams of paper, 
            mathematical sets, and the prescribed school uniform. A detailed requirement list is attached.
          </p>
        </div>
      </div>

      {/* Signatures */}
      <div className="mt-20 flex justify-between">
        <div className="text-center">
          <div className="w-40 border-b border-slate-400 mb-2"></div>
          <p className="text-xs font-black uppercase">Head Teacher</p>
          <p className="text-[10px] text-slate-400 italic">Signature / Stamp</p>
        </div>
        <div className="text-center">
          <div className="w-40 border-b border-slate-400 mb-2"></div>
          <p className="text-xs font-black uppercase">Parent Signature</p>
          <p className="text-[10px] text-slate-400 italic">Acceptance Date</p>
        </div>
      </div>

      {/* Footer Motif */}
      <div className="mt-32 pt-8 border-t border-slate-100 flex justify-between items-center opacity-30">
        <SkoolMateLogo size="sm" showText={true} />
        <p className="text-[10px] font-medium tracking-tighter uppercase italic">Always Progressing, Never Backwards</p>
      </div>
    </div>
  );
}
