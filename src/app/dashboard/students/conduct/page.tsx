"use client";

import { useState } from "react";
import SidebarLayout from "@/components/SidebarLayout";
import PageHeader from "@/components/PageHeader";
import MaterialIcon from "@/components/MaterialIcon";
import { format } from "date-fns";

export default function ConductManagementPage() {
  const [activeType, setActiveType] = useState<"all" | "merit" | "demerit">(
    "all",
  );

  const mockRecords = [
    {
      id: 1,
      student: "Isaac Mugisha",
      class: "P.5 Blue",
      type: "merit",
      category: "Leadership",
      description: "Led the class assembly with great confidence.",
      points: 10,
      date: "2026-04-09",
    },
    {
      id: 2,
      student: "Sarah Namayanja",
      class: "P.4 Red",
      type: "demerit",
      category: "Late Coming",
      description: "Arrived significantly late for the third time this week.",
      points: -5,
      date: "2026-04-08",
    },
    {
      id: 3,
      student: "Emma Kato",
      class: "P.6 Blue",
      type: "merit",
      category: "Academic Excellence",
      description:
        "Achieved the highest score in the regional math competition.",
      points: 20,
      date: "2026-04-07",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            Conduct & Merits
          </h1>
          <p className="text-slate-500 font-medium">
            Character tracking and disciplinary management
          </p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white rounded-2xl font-bold shadow-lg hover:scale-105 transition-all">
          <MaterialIcon icon="add" />
          Log Incident
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-[32px] bg-emerald-50 border border-emerald-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-emerald-600">
            <MaterialIcon icon="military_tech" style={{ fontSize: 28 }} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
              Monthly Merits
            </p>
            <p className="text-2xl font-black text-emerald-900">1,240</p>
          </div>
        </div>
        <div className="p-6 rounded-[32px] bg-red-50 border border-red-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-red-600">
            <MaterialIcon icon="gavel" style={{ fontSize: 28 }} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-red-700">
              Active Demerits
            </p>
            <p className="text-2xl font-black text-red-900">84</p>
          </div>
        </div>
        <div className="p-6 rounded-[32px] bg-primary-50 border border-primary-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary-700">
            <MaterialIcon icon="emoji_events" style={{ fontSize: 28 }} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary-700">
              Leading House
            </p>
            <p className="text-2xl font-black text-primary-900">Blue House</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex gap-2">
            {["all", "merit", "demerit"].map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type as any)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  activeType === type
                    ? "bg-slate-800 text-white shadow-md"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Filter by student..."
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary-100"
            />
            <MaterialIcon
              icon="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Date
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Student
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Category
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Description
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Points
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {mockRecords
                .filter((r) => activeType === "all" || r.type === activeType)
                .map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-800">
                        {record.date}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[10px]">
                          {record.student
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {record.student}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400">
                            {record.class}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          record.type === "merit"
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            : "bg-red-50 text-red-600 border border-red-100"
                        }`}
                      >
                        {record.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-[300px]">
                      <p className="text-xs text-slate-500 truncate">
                        {record.description}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p
                        className={`text-sm font-black ${record.type === "merit" ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {record.points > 0 ? "+" : ""}
                        {record.points}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <button className="p-2 rounded-lg hover:bg-white hover:shadow-sm opacity-0 group-hover:opacity-100 transition-all text-slate-400 hover:text-primary-800">
                        <MaterialIcon icon="edit" style={{ fontSize: 18 }} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
