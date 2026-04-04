"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";

interface SearchResult {
  type: "student" | "staff" | "page";
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  href: string;
}

interface GlobalSearchProps {
  trigger?: React.ReactNode;
}

export default function GlobalSearch({ trigger }: GlobalSearchProps) {
  const router = useRouter();
  const { user } = useAuth();
  const schoolId = user?.school_id;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const pages: SearchResult[] = useMemo(
    () => [
      {
        type: "page",
        id: "dashboard",
        title: "Dashboard",
        icon: "dashboard",
        href: "/dashboard",
      },
      {
        type: "page",
        id: "students",
        title: "Students",
        icon: "group",
        href: "/dashboard/students",
      },
      {
        type: "page",
        id: "attendance",
        title: "Attendance",
        icon: "how_to_reg",
        href: "/dashboard/attendance",
      },
      {
        type: "page",
        id: "grades",
        title: "Grades",
        icon: "menu_book",
        href: "/dashboard/grades",
      },
      {
        type: "page",
        id: "exams",
        title: "Exams",
        icon: "fact_check",
        href: "/dashboard/exams",
      },
      {
        type: "page",
        id: "fees",
        title: "Fees",
        icon: "payments",
        href: "/dashboard/fees",
      },
      {
        type: "page",
        id: "staff",
        title: "Staff",
        icon: "person",
        href: "/dashboard/staff",
      },
      {
        type: "page",
        id: "reports",
        title: "Reports",
        icon: "description",
        href: "/dashboard/reports",
      },
      {
        type: "page",
        id: "messages",
        title: "Messages",
        icon: "chat",
        href: "/dashboard/messages",
      },
      {
        type: "page",
        id: "settings",
        title: "Settings",
        icon: "settings",
        href: "/dashboard/settings",
      },
      {
        type: "page",
        id: "timetable",
        title: "Timetable",
        icon: "calendar_month",
        href: "/dashboard/timetable",
      },
      {
        type: "page",
        id: "payroll",
        title: "Payroll",
        icon: "payments",
        href: "/dashboard/payroll",
      },
      {
        type: "page",
        id: "budget",
        title: "Budget",
        icon: "account_balance_wallet",
        href: "/dashboard/budget",
      },
      {
        type: "page",
        id: "analytics",
        title: "Analytics",
        icon: "analytics",
        href: "/dashboard/analytics",
      },
      {
        type: "page",
        id: "health",
        title: "Health Records",
        icon: "medical_services",
        href: "/dashboard/health",
      },
      {
        type: "page",
        id: "discipline",
        title: "Discipline",
        icon: "warning",
        href: "/dashboard/discipline",
      },
    ],
    [],
  );

  const searchDatabase = useCallback(
    async (searchQuery: string) => {
      if (!schoolId || searchQuery.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      const searchTerm = `%${searchQuery}%`;
      const [studentsRes, staffRes] = await Promise.all([
        supabase
          .from("students")
          .select("id, first_name, last_name, student_number, class_id")
          .eq("school_id", schoolId)
          .or(
            `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},student_number.ilike.${searchTerm}`,
          )
          .limit(5),
        supabase
          .from("staff")
          .select("id, first_name, last_name, employee_number, role")
          .eq("school_id", schoolId)
          .or(
            `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},employee_number.ilike.${searchTerm}`,
          )
          .limit(5),
      ]);

      const studentResults: SearchResult[] = (studentsRes.data || []).map(
        (s) => ({
          type: "student",
          id: s.id,
          title: `${s.first_name} ${s.last_name}`,
          subtitle: s.student_number || "Student",
          icon: "person",
          href: `/dashboard/students/${s.id}`,
        }),
      );

      const staffResults: SearchResult[] = (staffRes.data || []).map((s) => ({
        type: "staff",
        id: s.id,
        title: `${s.first_name} ${s.last_name}`,
        subtitle: s.role || "Staff",
        icon: "person",
        href: `/dashboard/staff`,
      }));

      const pageResults = pages
        .filter((p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()),
        )
        .slice(0, 5);

      setResults([...studentResults, ...staffResults, ...pageResults]);
      setLoading(false);
    },
    [schoolId, pages],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      searchDatabase(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchDatabase]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (result: SearchResult) => {
    router.push(result.href);
    setIsOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  useEffect(() => {
    if (resultsRef.current) {
      const selected = resultsRef.current.querySelector(
        `[data-index="${selectedIndex}"]`,
      );
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <>
      <button
        data-globalsearch-trigger
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-low text-onSurface-variant hover:bg-surface-container hover:text-onSurface transition-colors"
      >
        {trigger || (
          <>
            <MaterialIcon icon="search" className="text-lg" />
            <span className="text-sm hidden md:inline">Search...</span>
            <kbd className="hidden md:inline px-1.5 py-0.5 text-xs bg-surface-container rounded border border-outline">
              ⌘K
            </kbd>
          </>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative w-full max-w-xl bg-surface-container-high rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-outline">
              <MaterialIcon
                icon="search"
                className="text-xl text-onSurface-variant"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search students, staff, or pages..."
                className="flex-1 bg-transparent text-onSurface outline-none text-base"
              />
              {loading && (
                <MaterialIcon
                  icon="hourglass_empty"
                  className="animate-spin text-onSurface-variant"
                />
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-surface-container rounded"
              >
                <MaterialIcon icon="close" />
              </button>
            </div>

            <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto">
              {results.length === 0 && query.length >= 2 && !loading && (
                <div className="px-4 py-8 text-center text-onSurface-variant">
                  No results found for &quot;{query}&quot;
                </div>
              )}

              {results.length > 0 && (
                <div className="py-2">
                  {results.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      data-index={index}
                      onClick={() => handleSelect(result)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        index === selectedIndex
                          ? "bg-primary-50 text-primary"
                          : "hover:bg-surface-container-low"
                      }`}
                    >
                      <MaterialIcon
                        icon={result.icon}
                        className={`text-xl ${index === selectedIndex ? "text-primary" : "text-onSurface-variant"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {result.title}
                        </div>
                        {result.subtitle && (
                          <div className="text-sm text-onSurface-variant truncate">
                            {result.subtitle}
                          </div>
                        )}
                      </div>
                      <MaterialIcon
                        icon="arrow_forward"
                        className="text-onSurface-variant text-lg"
                      />
                    </button>
                  ))}
                </div>
              )}

              {query.length < 2 && (
                <div className="px-4 py-6 text-center text-onSurface-variant">
                  <MaterialIcon icon="keyboard" className="text-3xl mb-2" />
                  <p>Type at least 2 characters to search</p>
                  <p className="text-sm mt-1">
                    Search students by name or number, staff, or navigate to
                    pages
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-4 py-2 border-t border-outline text-xs text-onSurface-variant">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-surface-container rounded">
                    ↑↓
                  </kbd>{" "}
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-surface-container rounded">
                    ↵
                  </kbd>{" "}
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-surface-container rounded">
                    esc
                  </kbd>{" "}
                  Close
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
