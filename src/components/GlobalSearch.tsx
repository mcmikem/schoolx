"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";

const RECENT_SEARCHES_KEY = "skoolmate_recent_searches";
const MAX_RECENT_SEARCHES = 8;

interface SearchResult {
  type: "student" | "staff" | "page" | "payment" | "message";
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  href: string;
}

interface GlobalSearchProps {
  trigger?: React.ReactNode;
}

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  try {
    const existing = getRecentSearches();
    const filtered = existing.filter((s) => s !== query);
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // ignore
  }
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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches());
    }
  }, [isOpen]);

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
      const [studentsRes, staffRes, paymentsRes, messagesRes] =
        await Promise.all([
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
          supabase
            .from("fee_payments")
            .select(
              "id, payment_reference, amount_paid, payment_date, student_id, students(first_name, last_name)",
            )
            .eq("school_id", schoolId)
            .ilike("payment_reference", searchTerm)
            .order("payment_date", { ascending: false })
            .limit(3),
          supabase
            .from("messages")
            .select("id, message, phone, created_at")
            .eq("school_id", schoolId)
            .ilike("message", searchTerm)
            .order("created_at", { ascending: false })
            .limit(3),
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

      const paymentResults: SearchResult[] = (paymentsRes.data || []).map(
        (p) => {
          const student = Array.isArray(p.students)
            ? p.students[0]
            : p.students;
          return {
            type: "payment",
            id: p.id,
            title: `Payment ${p.payment_reference || p.id.slice(0, 8)}`,
            subtitle: `${student?.first_name || "Unknown"} ${student?.last_name || ""} - UGX ${Number(p.amount_paid).toLocaleString()}`,
            icon: "receipt_long",
            href: `/dashboard/fees`,
          };
        },
      );

      const messageResults: SearchResult[] = (messagesRes.data || []).map(
        (m) => ({
          type: "message",
          id: m.id,
          title: m.message.slice(0, 60) + (m.message.length > 60 ? "..." : ""),
          subtitle: `To: ${m.phone}`,
          icon: "chat",
          href: `/dashboard/messages`,
        }),
      );

      const pageResults = pages
        .filter((p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()),
        )
        .slice(0, 5);

      setResults([
        ...studentResults,
        ...staffResults,
        ...paymentResults,
        ...messageResults,
        ...pageResults,
      ]);
      setLoading(false);
    },
    [schoolId, pages],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        searchDatabase(query);
        saveRecentSearch(query);
      } else {
        setResults([]);
      }
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

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex((idx) =>
      results.length === 0 ? 0 : Math.min(idx, results.length - 1),
    );
  }, [results]);

  const handleSelect = (result: SearchResult) => {
    router.push(result.href);
    setIsOpen(false);
    setQuery("");
  };

  const handleRecentSearchClick = (search: string) => {
    setQuery(search);
    saveRecentSearch(search);
    setSelectedIndex(0);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length === 0) return;
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (
      e.key === "Enter" &&
      results.length > 0 &&
      results[selectedIndex]
    ) {
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
        type="button"
        data-globalsearch-trigger
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-transparent bg-[var(--surface-container-low)] px-3 py-2 text-[var(--on-surface-variant)] transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/25"
      >
        {trigger || (
          <>
            <MaterialIcon icon="search" className="text-lg" />
            <span className="hidden text-sm md:inline">Search...</span>
            <kbd className="hidden rounded border border-[var(--border)] bg-[var(--surface-container)] px-1.5 py-0.5 font-sans text-xs text-[var(--t3)] md:inline">
              ⌘K
            </kbd>
          </>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
            role="presentation"
          />

          <div
            className="relative mx-4 w-full max-w-xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--sh3)] animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
          >
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
              <MaterialIcon
                icon="search"
                className="text-xl text-[var(--t3)]"
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
                className="flex-1 border-0 bg-transparent text-base text-[var(--on-surface)] outline-none placeholder:text-[var(--t4)]"
              />
              {loading && (
                <MaterialIcon
                  icon="hourglass_empty"
                  className="animate-spin text-[var(--t3)]"
                />
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-[var(--t3)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--t1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/25"
                aria-label="Close"
              >
                <MaterialIcon icon="close" />
              </button>
            </div>

            <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto">
              {results.length === 0 && query.length >= 2 && !loading && (
                <div className="px-4 py-8 text-center text-[var(--t3)]">
                  No results found for &quot;{query}&quot;
                </div>
              )}

              {results.length > 0 && (
                <div className="py-2">
                  {results.map((result, index) => (
                    <button
                      type="button"
                      key={`${result.type}-${result.id}`}
                      data-index={index}
                      onClick={() => handleSelect(result)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                        index === selectedIndex
                          ? "bg-[var(--primary-50)] text-[var(--primary)]"
                          : "hover:bg-[var(--surface-container-low)]"
                      }`}
                    >
                      <MaterialIcon
                        icon={result.icon}
                        className={`text-xl ${index === selectedIndex ? "text-[var(--primary)]" : "text-[var(--t3)]"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {result.title}
                        </div>
                        {result.subtitle && (
                          <div className="truncate text-sm text-[var(--t3)]">
                            {result.subtitle}
                          </div>
                        )}
                      </div>
                      <MaterialIcon
                        icon="arrow_forward"
                        className="text-lg text-[var(--t3)]"
                      />
                    </button>
                  ))}
                </div>
              )}

              {query.length < 2 && (
                <div className="px-4 py-6">
                  {recentSearches.length > 0 ? (
                    <>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-[var(--t1)]">
                          Recent Searches
                        </h3>
                        <button
                          type="button"
                          onClick={clearRecentSearches}
                          className="text-xs text-[var(--t3)] transition-colors hover:text-[var(--primary)]"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="space-y-1">
                        {recentSearches.map((search, idx) => (
                          <button
                            type="button"
                            key={idx}
                            onClick={() => handleRecentSearchClick(search)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-container-low)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]/20"
                          >
                            <MaterialIcon
                              icon="history"
                              className="text-[var(--t3)]"
                            />
                            <span className="truncate text-sm text-[var(--t1)]">
                              {search}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-[var(--t3)]">
                      <MaterialIcon icon="keyboard" className="mb-2 text-3xl" />
                      <p>Type at least 2 characters to search</p>
                      <p className="mt-1 text-sm">
                        Search students by name or number, staff, or navigate to
                        pages
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--t3)]">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-[var(--border)] bg-[var(--surface-container)] px-1.5 py-0.5 font-sans">
                    ↑↓
                  </kbd>{" "}
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-[var(--border)] bg-[var(--surface-container)] px-1.5 py-0.5 font-sans">
                    ↵
                  </kbd>{" "}
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-[var(--border)] bg-[var(--surface-container)] px-1.5 py-0.5 font-sans">
                    esc
                  </kbd>{" "}
                  Close
                </span>
              </div>
              {recentSearches.length > 0 && (
                <span className="text-[11px] text-[var(--t4)]">
                  {recentSearches.length} recent
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
