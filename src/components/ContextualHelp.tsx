"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import MaterialIcon from "@/components/MaterialIcon";

interface HelpItem {
  id: string;
  title: string;
  content: string;
  icon: string;
  category: string;
}

const HELP_CONTENT: Record<string, HelpItem[]> = {
  attendance: [
    {
      id: "mark-attendance",
      title: "How to mark attendance",
      content:
        'Select a class, choose the date, then tap each student to cycle through statuses: In School → Away → Late. Use "Mark All In School" for quick entry.',
      icon: "event",
      category: "attendance",
    },
    {
      id: "roll-call",
      title: "Using Roll Call mode",
      content:
        'Enable Roll Call mode to start all students as "In School" - only mark those who are absent. Great for quick morning registration.',
      icon: "mic",
      category: "attendance",
    },
    {
      id: "parent-alerts",
      title: "Sending parent alerts",
      content:
        'After marking attendance, click "Notify Parents" to automatically send SMS alerts to parents of absent students.',
      icon: "sms",
      category: "attendance",
    },
    {
      id: "attendance-reports",
      title: "Viewing attendance reports",
      content:
        "Navigate to Reports to see class-wise, daily, and trend analysis of attendance patterns.",
      icon: "assessment",
      category: "attendance",
    },
  ],
  grades: [
    {
      id: "enter-marks",
      title: "Entering student marks",
      content:
        "Go to Grades → Select class → Choose assessment type → Enter marks for each subject. The system calculates totals automatically.",
      icon: "edit",
      category: "grades",
    },
    {
      id: "grading-config",
      title: "Configuring grading system",
      content:
        "Go to Settings → Grading to set up your grading rules, grade boundaries, and comment templates.",
      icon: "settings",
      category: "grades",
    },
    {
      id: "report-cards",
      title: "Generating report cards",
      content:
        "Navigate to Report Cards → Select class → Choose term → Generate. You can print or export to PDF.",
      icon: "description",
      category: "grades",
    },
    {
      id: "uneb-export",
      title: "UNEB exports",
      content:
        "Go to UNEB Center to register candidates and generate official UNEB submission files.",
      icon: "school",
      category: "grades",
    },
  ],
  fees: [
    {
      id: "record-payment",
      title: "Recording a payment",
      content:
        'Go to Fees → Find student → Click "Record Payment" → Enter amount and method → Save. Receipt is generated automatically.',
      icon: "payments",
      category: "fees",
    },
    {
      id: "fee-structure",
      title: "Setting up fee structure",
      content:
        "Go to Fees → Fee Structure → Add items for each term. You can set different amounts per class.",
      icon: "build",
      category: "fees",
    },
    {
      id: "send-reminders",
      title: "Sending fee reminders",
      content:
        'Select students with balances → Click "Send Reminder" → Choose template → Send. Parents receive SMS alerts.',
      icon: "sms",
      category: "fees",
    },
    {
      id: "payment-plans",
      title: "Setting up payment plans",
      content:
        "For students with outstanding balances, set up monthly payment plans to track installments.",
      icon: "calendar_today",
      category: "fees",
    },
  ],
  students: [
    {
      id: "add-student",
      title: "Adding a new student",
      content:
        "Go to Students → Add New → Enter details including parent contact → Save. Student receives automatic admission number.",
      icon: "person_add",
      category: "students",
    },
    {
      id: "import-students",
      title: "Importing students",
      content:
        "Go to Students → Import → Upload CSV/Excel file → Map columns → Import. Supports bulk enrollment.",
      icon: "upload_file",
      category: "students",
    },
    {
      id: "transfer-student",
      title: "Transferring a student",
      content:
        'Select student → Click "Transfer" → Choose destination class → Confirm. Attendance history is preserved.',
      icon: "swap_horiz",
      category: "students",
    },
  ],
  messages: [
    {
      id: "send-sms",
      title: "Sending individual SMS",
      content:
        "Go to Messages → New Message → Enter phone number or select student → Type message → Send.",
      icon: "sms",
      category: "messages",
    },
    {
      id: "bulk-sms",
      title: "Sending bulk messages",
      content:
        "Go to Messages → Bulk → Select recipients (by class, balance status, etc.) → Compose → Send.",
      icon: "group",
      category: "messages",
    },
    {
      id: "sms-templates",
      title: "Using SMS templates",
      content:
        "Create reusable message templates in Settings → SMS Templates. Save time on recurring messages.",
      icon: "text_snippet",
      category: "messages",
    },
  ],
  general: [
    {
      id: "dashboard-tour",
      title: "Taking the dashboard tour",
      content:
        "Click the help icon (question mark) in the header to restart the interactive tour of key features.",
      icon: "help",
      category: "general",
    },
    {
      id: "search-features",
      title: "Finding features quickly",
      content:
        "Press Cmd+K (or Ctrl+K) anywhere to open the quick search. Type any feature name to jump directly to it.",
      icon: "search",
      category: "general",
    },
    {
      id: "offline-mode",
      title: "Using offline mode",
      content:
        "When internet is unavailable, the app automatically saves data locally. Everything syncs when connection restores.",
      icon: "cloud_off",
      category: "general",
    },
  ],
};

export function useContextualHelp() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);

  const userRole = user?.role || "teacher";

  const roleCategories: Record<string, string[]> = {
    headmaster: [
      "general",
      "attendance",
      "grades",
      "fees",
      "students",
      "staff",
      "messages",
    ],
    dean_of_studies: ["general", "attendance", "grades", "students"],
    bursar: ["general", "fees", "students"],
    teacher: ["general", "attendance", "grades"],
    secretary: ["general", "students", "messages"],
    dorm_master: ["general", "attendance", "students"],
    parent: ["general"],
  };

  const availableCategories =
    roleCategories[userRole] || roleCategories.teacher;

  const filteredHelp = useCallback(() => {
    let items: HelpItem[] = [];

    if (selectedCategory && HELP_CONTENT[selectedCategory]) {
      items = HELP_CONTENT[selectedCategory];
    } else {
      availableCategories.forEach((cat) => {
        if (HELP_CONTENT[cat]) {
          items = [...items, ...HELP_CONTENT[cat]];
        }
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.content.toLowerCase().includes(query),
      );
    }

    return items;
  }, [selectedCategory, availableCategories, searchQuery]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const minimize = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const restore = useCallback(() => {
    setIsMinimized(false);
  }, []);

  return {
    isOpen,
    setIsOpen,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    isMinimized,
    minimize,
    restore,
    toggleOpen,
    categories: availableCategories,
    helpItems: filteredHelp(),
  };
}

export function ContextualHelp() {
  const help = useContextualHelp();

  if (!help.isOpen) {
    return (
      <button
        onClick={help.toggleOpen}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors z-40"
        aria-label="Open help"
      >
        <MaterialIcon icon="help" className="text-white text-xl" />
      </button>
    );
  }

  if (help.isMinimized) {
    return (
      <button
        onClick={help.restore}
        className="fixed bottom-6 right-6 bg-blue-600 rounded-full shadow-lg flex items-center gap-2 px-4 py-3 hover:bg-blue-700 transition-colors z-40"
      >
        <MaterialIcon icon="help" className="text-white" />
        <span className="text-white font-medium">Help</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
        <div className="flex items-center gap-2">
          <MaterialIcon icon="help" />
          <span className="font-semibold">Help & Guidance</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={help.minimize}
            className="p-1 hover:bg-blue-700 rounded"
            aria-label="Minimize"
          >
            <MaterialIcon icon="minimize" className="text-lg" />
          </button>
          <button
            onClick={() => help.setIsOpen(false)}
            className="p-1 hover:bg-blue-700 rounded"
            aria-label="Close"
          >
            <MaterialIcon icon="close" className="text-lg" />
          </button>
        </div>
      </div>

      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <MaterialIcon
            icon="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search help topics..."
            value={help.searchQuery}
            onChange={(e) => help.setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-1 px-3 py-2 border-b border-gray-100 overflow-x-auto">
        <button
          onClick={() => help.setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            !help.selectedCategory
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All
        </button>
        {help.categories.map((cat) => (
          <button
            key={cat}
            onClick={() => help.setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              help.selectedCategory === cat
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {help.helpItems.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <MaterialIcon
              icon="search_off"
              className="text-3xl mx-auto mb-2 opacity-50"
            />
            <p className="text-sm">No help topics found</p>
          </div>
        ) : (
          <div className="p-2">
            {help.helpItems.map((item) => (
              <details key={item.id} className="group">
                <summary className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer list-none">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MaterialIcon
                      icon={item.icon}
                      className="text-blue-600 text-lg"
                    />
                  </div>
                  <span className="font-medium text-gray-900 text-sm">
                    {item.title}
                  </span>
                  <MaterialIcon
                    icon="expand_more"
                    className="ml-auto text-gray-400 group-open:rotate-180 transition-transform"
                  />
                </summary>
                <div className="pl-14 pr-3 pb-3 text-sm text-gray-600 leading-relaxed">
                  {item.content}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
        Press{" "}
        <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">
          Cmd+K
        </kbd>{" "}
        for quick search
      </div>
    </div>
  );
}

export default ContextualHelp;
