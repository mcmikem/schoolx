"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  href: string;
  keywords?: string;
}

const STATIC_PAGES: PaletteItem[] = [
  {
    id: "p-dash",
    label: "Dashboard",
    icon: <MaterialIcon icon="calendar_today" size={16} />,
    href: "/dashboard/",
    keywords: "home overview",
  },
  {
    id: "p-students",
    label: "Students",
    icon: <MaterialIcon icon="group" size={16} />,
    href: "/dashboard/students/",
    keywords: "pupils roster",
  },
  {
    id: "p-attendance",
    label: "Attendance",
    icon: <MaterialIcon icon="menu_book" size={16} />,
    href: "/dashboard/attendance/",
    keywords: "register present absent",
  },
  {
    id: "p-grades",
    label: "Grades",
    icon: <MaterialIcon icon="description" size={16} />,
    href: "/dashboard/grades/",
    keywords: "marks scores",
  },
  {
    id: "p-fees",
    label: "Fees",
    icon: <MaterialIcon icon="account_balance_wallet" size={16} />,
    href: "/dashboard/fees/",
    keywords: "payments money",
  },
  {
    id: "p-timetable",
    label: "Timetable",
    icon: <MaterialIcon icon="calendar_today" size={16} />,
    href: "/dashboard/timetable/",
    keywords: "schedule classes",
  },
  {
    id: "p-messages",
    label: "Messages",
    icon: <MaterialIcon icon="group" size={16} />,
    href: "/dashboard/messages/",
    keywords: "sms notices",
  },
  {
    id: "p-reports",
    label: "Reports",
    icon: <MaterialIcon icon="description" size={16} />,
    href: "/dashboard/reports/",
    keywords: "report cards",
  },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<PaletteItem[]>([]);
  const router = useRouter();
  const { school } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim() || !school?.id) {
        setStudents([]);
        return;
      }
      const { data } = await supabase
        .from("students")
        .select("id, first_name, last_name, student_number, classes(name)")
        .eq("school_id", school.id)
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,student_number.ilike.%${q}%`)
        .limit(8);
      setStudents(
        (data || []).map((s: any) => ({
          id: `stu-${s.id}`,
          label: `${s.first_name} ${s.last_name}`,
          hint: s.student_number || s.classes?.name,
          icon: <MaterialIcon icon="person" size={16} />,
          href: `/dashboard/students/${s.id}/`,
          keywords: s.student_number,
        })),
      );
    },
    [school?.id],
  );

  useEffect(() => {
    const t = setTimeout(() => search(query), 120);
    return () => clearTimeout(t);
  }, [query, search]);

  if (!open) return null;

  const pages = STATIC_PAGES.filter((p) =>
    query.trim() === "" ? true : (p.label + " " + (p.keywords || "")).toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/40 p-4 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="flex flex-col">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
            <MaterialIcon icon="search" size={16} className="text-[var(--t3)]" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search students, pages, actions…"
              className="flex-1 bg-transparent text-sm text-[var(--t1)] outline-none placeholder:text-[var(--t3)]"
              autoFocus
            />
            <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--t3)]">Esc</kbd>
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-[var(--t3)]">No results.</Command.Empty>
            {students.length > 0 && (
              <Command.Group heading="Students" className="text-xs font-semibold text-[var(--t3)] px-2 py-1.5">
                {students.map((s) => (
                  <Command.Item
                    key={s.id}
                    value={s.label}
                    onSelect={() => {
                      router.push(s.href);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--t1)] aria-selected:bg-[var(--surface-container-low)]"
                  >
                    {s.icon}
                    <span className="flex-1 truncate">{s.label}</span>
                    {s.hint && <span className="text-xs text-[var(--t3)]">{s.hint}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            <Command.Group heading="Pages" className="text-xs font-semibold text-[var(--t3)] px-2 py-1.5">
              {pages.map((p) => (
                <Command.Item
                  key={p.id}
                  value={p.label}
                  onSelect={() => {
                    router.push(p.href);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--t1)] aria-selected:bg-[var(--surface-container-low)]"
                >
                  {p.icon}
                  <span className="flex-1 truncate">{p.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
