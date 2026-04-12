"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import MaterialIcon from "@/components/MaterialIcon";
import { useAuth } from "@/lib/auth-context";

interface SearchResult {
  id: string;
  title: string;
  description: string;
  icon: string;
  path: string;
  category:
    | "navigation"
    | "students"
    | "attendance"
    | "grades"
    | "fees"
    | "staff"
    | "messages"
    | "settings";
}

const NAVIGATION_ITEMS: SearchResult[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Main dashboard overview",
    icon: "dashboard",
    path: "/dashboard",
    category: "navigation",
  },
  {
    id: "students",
    title: "Students",
    description: "Manage student records",
    icon: "group",
    path: "/dashboard/students",
    category: "students",
  },
  {
    id: "attendance",
    title: "Attendance",
    description: "Mark and track attendance",
    icon: "event_available",
    path: "/dashboard/attendance",
    category: "attendance",
  },
  {
    id: "grades",
    title: "Grades & Exams",
    description: "Manage grades and assessments",
    icon: "grade",
    path: "/dashboard/grades",
    category: "grades",
  },
  {
    id: "fees",
    title: "Fee Management",
    description: "Track fees and payments",
    icon: "payments",
    path: "/dashboard/fees",
    category: "fees",
  },
  {
    id: "staff",
    title: "Staff",
    description: "Manage staff members",
    icon: "people",
    path: "/dashboard/staff",
    category: "staff",
  },
  {
    id: "messages",
    title: "Messages",
    description: "Send SMS and notifications",
    icon: "sms",
    path: "/dashboard/messages",
    category: "messages",
  },
  {
    id: "reports",
    title: "Reports",
    description: "View and generate reports",
    icon: "assessment",
    path: "/dashboard/reports",
    category: "navigation",
  },
  {
    id: "settings",
    title: "Settings",
    description: "School and account settings",
    icon: "settings",
    path: "/dashboard/settings",
    category: "settings",
  },
  {
    id: "uneb",
    title: "UNEB Center",
    description: "UNEB registration and reports",
    icon: "school",
    path: "/dashboard/uneb",
    category: "grades",
  },
  {
    id: "report-cards",
    title: "Report Cards",
    description: "Generate student reports",
    icon: "description",
    path: "/dashboard/report-cards",
    category: "grades",
  },
  {
    id: "promotions",
    title: "Promotions",
    description: "Manage student promotions",
    icon: "trending_up",
    path: "/dashboard/promotion",
    category: "students",
  },
  {
    id: "behavior",
    title: "Behavior",
    description: "Track student behavior",
    icon: "psychology",
    path: "/dashboard/behavior",
    category: "students",
  },
  {
    id: "cashbook",
    title: "Cashbook",
    description: "Financial transactions",
    icon: "account_balance",
    path: "/dashboard/cashbook",
    category: "fees",
  },
  {
    id: "payroll",
    title: "Payroll",
    description: "Staff salary management",
    icon: "money",
    path: "/dashboard/payroll",
    category: "staff",
  },
];

export function useCommandPalette() {
  const router = useRouter();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredResults = useMemo(() => {
    if (!query.trim()) return NAVIGATION_ITEMS.slice(0, 8);

    const lowerQuery = query.toLowerCase();
    return NAVIGATION_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(lowerQuery) ||
        item.description.toLowerCase().includes(lowerQuery),
    ).slice(0, 10);
  }, [query]);

  const openPalette = useCallback(() => setIsOpen(true), []);
  const closePalette = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const navigateTo = useCallback(
    (path: string) => {
      router.push(path);
      closePalette();
    },
    [router, closePalette],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Open with Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openPalette();
        return;
      }

      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredResults.length - 1),
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredResults[selectedIndex]) {
            navigateTo(filteredResults[selectedIndex].path);
          }
          break;
        case "Escape":
          e.preventDefault();
          closePalette();
          break;
      }
    },
    [
      isOpen,
      filteredResults,
      selectedIndex,
      openPalette,
      navigateTo,
      closePalette,
    ],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return {
    isOpen,
    query,
    setQuery,
    results: filteredResults,
    selectedIndex,
    setSelectedIndex,
    openPalette,
    closePalette,
    navigateTo,
  };
}

export function CommandPalette() {
  const {
    isOpen,
    query,
    setQuery,
    results,
    selectedIndex,
    setSelectedIndex,
    closePalette,
    navigateTo,
  } = useCommandPalette();

  if (!isOpen) return null;

  const categoryColors: Record<string, string> = {
    navigation: "bg-purple-100 text-purple-700",
    students: "bg-blue-100 text-blue-700",
    attendance: "bg-green-100 text-green-700",
    grades: "bg-amber-100 text-amber-700",
    fees: "bg-rose-100 text-rose-700",
    staff: "bg-cyan-100 text-cyan-700",
    messages: "bg-indigo-100 text-indigo-700",
    settings: "bg-gray-100 text-gray-700",
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={closePalette} />

      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
            <MaterialIcon icon="search" className="text-gray-400" />
            <input
              type="text"
              placeholder="Search pages, features, or actions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 text-lg outline-none placeholder:text-gray-400"
              autoFocus
            />
            <kbd className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded font-medium">
              ESC
            </kbd>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {results.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MaterialIcon
                  icon="search_off"
                  className="text-4xl mb-2 mx-auto opacity-50"
                />
                <p>No results found for "{query}"</p>
              </div>
            ) : (
              <div className="py-2">
                {results.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.path)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors ${
                      index === selectedIndex
                        ? "bg-blue-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${categoryColors[item.category] || "bg-gray-100"}`}
                    >
                      <MaterialIcon icon={item.icon} className="text-lg" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">
                        {item.title}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {item.description}
                      </div>
                    </div>
                    {index === selectedIndex && (
                      <MaterialIcon
                        icon="arrow_forward"
                        className="text-gray-400"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">
                ↑↓
              </kbd>
              <span>to navigate</span>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded ml-2">
                ↵
              </kbd>
              <span>to select</span>
            </div>
            <div className="flex items-center gap-1">
              <MaterialIcon icon="keyboard" className="text-sm" />
              <span>Cmd+K to open</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default CommandPalette;
