"use client";
import { useState } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { useAuth } from "@/lib/auth-context";

const PROGRAMS = [
  {
    id: "slf",
    name: "Student Leaders Forum",
    icon: "military_tech",
    color: "bg-blue-500",
    description: "Leadership training & interschool debate championships.",
    stats: "12 Leaders Trained",
    active: true,
  },
  {
    id: "red",
    name: "RED Campaign",
    icon: "female",
    color: "bg-red-500",
    description: "Menstrual dignity kits and peer hygiene advocacy.",
    stats: "700+ Girls Reached",
    active: true,
  },
  {
    id: "green",
    name: "GreenSchools",
    icon: "eco",
    color: "bg-emerald-500",
    description: "Tree planting, gardens, and Ecoloop projects.",
    stats: "3 Gardens Active",
    active: true,
  },
  {
    id: "water",
    name: "PureWater Initiative",
    icon: "water_drop",
    color: "bg-cyan-500",
    description: "Spouts Purifaaya ceramic filters maintenance.",
    stats: "0 Firewood Used",
    active: false,
  },
];

const STEPS = [
  { id: 1, name: "Register", status: "complete" },
  { id: 2, name: "Launch", status: "complete" },
  { id: 3, name: "Action Teams", status: "current" },
  { id: 4, name: "Support", status: "upcoming" },
  { id: 5, name: "Recognition", status: "upcoming" },
];

export default function OSXPage() {
  const { school } = useAuth();
  const [tier] = useState("Active");

  return (
    <div className="space-y-6">
      <PageHeader
        title="School Xperience"
        subtitle="Student Leadership & Social Impact Hub"
        variant="premium"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end mr-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--t4)]">Partnership Tier</span>
              <span className="text-sm font-black text-amber-600 uppercase tracking-tighter italic">★ {tier} Partner</span>
            </div>
            <Button variant="secondary" size="sm" icon={<MaterialIcon icon="upgrade" />}>Upgrade Tier</Button>
          </div>
        }
      />

      {/* Chapter Progress */}
      <Card className="bg-[var(--navy-soft)] border-none shadow-none">
        <CardBody className="py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 max-w-4xl mx-auto">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="relative flex flex-col items-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm mb-2 transition-all shadow-md ${
                    step.status === "complete" ? "bg-green-500 text-white" :
                    step.status === "current" ? "bg-white text-[var(--navy)] ring-4 ring-white/30 animate-pulse" :
                    "bg-[var(--navy)] text-white/40"
                  }`}
                >
                  {step.status === "complete" ? <MaterialIcon icon="check" /> : step.id}
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#002045]/60 text-center">
                  {step.name}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`hidden md:block absolute top-6 left-[calc(50%+28px)] w-[calc(100%-56px)] h-0.5 ${step.status === "complete" ? "bg-green-500/30" : "bg-[#002045]/10"}`} />
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Programs — Left 2 columns */}
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PROGRAMS.map(prog => (
              <Card key={prog.id} className={`group hover:shadow-xl transition-all duration-300 border-l-4 ${prog.active ? "border-primary" : "border-gray-200 opacity-70"}`}>
                <CardBody>
                  <div className="flex items-start justify-between mb-3 text-sm">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg ${prog.color}`}>
                      <MaterialIcon icon={prog.icon} />
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${prog.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {prog.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <h3 className="font-bold text-[var(--t1)] mb-1">{prog.name}</h3>
                  <p className="text-xs text-[var(--t3)] leading-relaxed mb-4">{prog.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black text-primary uppercase tracking-widest">{prog.stats}</div>
                    <Button variant="ghost" size="sm" className="p-1 min-h-0 text-[10px] uppercase font-bold text-[var(--t4)] hover:text-primary">Reports ↗</Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>

        {/* Sidebar — Right 1 column */}
        <div className="space-y-6">
          <Card className="border-t-4 border-amber-500">
            <CardBody>
              <h3 className="font-bold text-sm text-[var(--t1)] mb-4 flex items-center justify-between">
                Leadership Scorecard
                <span className="text-xs text-amber-600 font-mono">Term 1 2026</span>
              </h3>
              <div className="space-y-4">
                {[
                  { label: "Training Attendance", val: 85, color: "bg-green-500" },
                  { label: "Action Team Activity", val: 62, color: "bg-blue-500" },
                  { label: "Documentation Score", val: 40, color: "bg-amber-500" },
                  { label: "Community Outreach", val: 75, color: "bg-teal-500" },
                ].map(metric => (
                  <div key={metric.label}>
                    <div className="flex justify-between text-[11px] font-bold mb-1.5 uppercase tracking-wider text-[var(--t3)]">
                      <span>{metric.label}</span>
                      <span>{metric.val}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${metric.color}`} style={{ width: `${metric.val}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="font-bold text-sm text-[var(--t1)] mb-4 uppercase tracking-tighter">Foundation Services</h3>
              <div className="space-y-3">
                {[
                  { name: "Exam Printing", icon: "print", desc: "Starting UGX 300/pg" },
                  { name: "Branded Uniforms", icon: "apparel", desc: "Quality tailoring" },
                  { name: "Event Coverage", icon: "photo_camera", desc: "Pro media team" },
                  { name: "Design & Signage", icon: "draw", desc: "School profiling" },
                ].map(svc => (
                  <button key={svc.name} className="w-full h-auto p-3 text-left bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-transparent hover:border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-primary-600">
                        <MaterialIcon icon={svc.icon} className="text-lg" />
                      </div>
                      <div>
                        <div className="text-[12px] font-bold text-[var(--t1)]">{svc.name}</div>
                        <div className="text-[10px] text-[var(--t4)] font-medium">{svc.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 p-3 bg-primary-50 rounded-xl border border-primary-100 text-[10px] text-primary-800 font-medium leading-relaxed">
                💡 When your school buys SkoolMate services, you are directly funding local youth employment.
              </div>
              <Button variant="primary" className="w-full mt-4 text-xs font-black uppercase tracking-widest py-3">Request Rate Card</Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
