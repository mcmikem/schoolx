"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import SkoolMateLogo from "@/components/SkoolMateLogo";

interface DashboardData {
  student: {
    id: string;
    name: string;
    class: string;
    student_id: string;
    photo?: string;
  };
  school: { id: string; name: string; logo?: string };
  stats: {
    attendance: { present: number; total: number; percentage: number };
    balance: number;
    next_term: string;
  };
  recent_grades: {
    id: string;
    subject: string;
    score: number;
    grade: string;
    term: string;
    date: string;
  }[];
  recent_attendance: { date: string; status: string }[];
}

const demoData: DashboardData = {
  student: {
    id: "1",
    name: "Nakamya Amina",
    class: "Primary 6",
    student_id: "P6-001",
  },
  school: { id: "demo", name: "St. Mary's Primary School" },
  stats: {
    attendance: { present: 42, total: 45, percentage: 93 },
    balance: 185000,
    next_term: "April 2026",
  },
  recent_grades: [
    {
      id: "1",
      subject: "Mathematics",
      score: 85,
      grade: "A",
      term: "Term II",
      date: "2026-03-15",
    },
    {
      id: "2",
      subject: "English",
      score: 78,
      grade: "B+",
      term: "Term II",
      date: "2026-03-14",
    },
    {
      id: "3",
      subject: "Science",
      score: 92,
      grade: "A",
      term: "Term II",
      date: "2026-03-13",
    },
    {
      id: "4",
      subject: "Social Studies",
      score: 70,
      grade: "B",
      term: "Term II",
      date: "2026-03-12",
    },
    {
      id: "5",
      subject: "Religious Education",
      score: 88,
      grade: "A",
      term: "Term II",
      date: "2026-03-11",
    },
  ],
  recent_attendance: [
    { date: "2026-04-06", status: "Present" },
    { date: "2026-04-05", status: "Present" },
    { date: "2026-04-04", status: "Present" },
    { date: "2026-04-03", status: "Absent" },
    { date: "2026-04-02", status: "Present" },
  ],
};

export default function ParentDashboard() {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<DashboardData | null>(demoData);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "academics" | "fees" | "messages"
  >("overview");
  const [message, setMessage] = useState("");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;
    toast.success("Message sent to school!");
    setMessage("");
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <MaterialIcon className="text-4xl text-primary animate-spin">
          sync
        </MaterialIcon>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#001F3F] text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#D4AF37] rounded-full flex items-center justify-center text-[#001F3F] font-bold">
              {data.student.name.charAt(0)}
            </div>
            <div>
              <h1 className="font-bold text-lg">{data.student.name}</h1>
              <p className="text-white/70 text-sm">
                {data.student.class} • {data.student.student_id}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/parent/login")}
            className="text-white/70 hover:text-white"
          >
            <MaterialIcon className="text-2xl">logout</MaterialIcon>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="max-w-4xl mx-auto p-4 -mt-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <MaterialIcon className="text-green-600">
                check_circle
              </MaterialIcon>
              <span className="text-xs text-gray-500">Attendance</span>
            </div>
            <div className="text-2xl font-bold text-[#001F3F]">
              {data.stats.attendance.percentage}%
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <MaterialIcon className="text-amber-600">
                account_balance_wallet
              </MaterialIcon>
              <span className="text-xs text-gray-500">Balance</span>
            </div>
            <div className="text-2xl font-bold text-[#001F3F]">
              {formatCurrency(data.stats.balance)}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <MaterialIcon className="text-blue-600">
                calendar_today
              </MaterialIcon>
              <span className="text-xs text-gray-500">Next Term</span>
            </div>
            <div className="text-lg font-bold text-[#001F3F]">
              {data.stats.next_term}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: "overview", icon: "dashboard", label: "Overview" },
            { id: "academics", icon: "school", label: "Academics" },
            { id: "fees", icon: "payments", label: "Fees" },
            { id: "messages", icon: "chat", label: "Messages" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-[#001F3F] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              <MaterialIcon className="inline mr-1 text-lg">
                {tab.icon}
              </MaterialIcon>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4">
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                Recent Grades
              </h3>
              <div className="space-y-3">
                {data.recent_grades.slice(0, 3).map((grade) => (
                  <div
                    key={grade.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {grade.subject}
                      </p>
                      <p className="text-xs text-gray-500">
                        {grade.term} • {grade.date}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#001F3F]">{grade.score}%</p>
                      <p
                        className={`text-xs font-medium ${grade.grade.startsWith("A") ? "text-green-600" : "text-amber-600"}`}
                      >
                        {grade.grade}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                Attendance (Last 5 Days)
              </h3>
              <div className="flex gap-2">
                {data.recent_attendance.map((att, i) => (
                  <div
                    key={i}
                    className={`flex-1 p-2 rounded-lg text-center ${att.status === "Present" ? "bg-green-50" : "bg-red-50"}`}
                  >
                    <p className="text-xs text-gray-500">
                      {new Date(att.date).toLocaleDateString("en-GB", {
                        weekday: "short",
                      })}
                    </p>
                    <MaterialIcon
                      className={`text-lg ${att.status === "Present" ? "text-green-600" : "text-red-600"}`}
                    >
                      {att.status === "Present" ? "check_circle" : "cancel"}
                    </MaterialIcon>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "academics" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">All Grades</h3>
              <div className="space-y-3">
                {data.recent_grades.map((grade) => (
                  <div
                    key={grade.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {grade.subject}
                      </p>
                      <p className="text-xs text-gray-500">{grade.term}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-[#001F3F] h-2 rounded-full"
                          style={{ width: `${grade.score}%` }}
                        />
                      </div>
                      <div className="text-right w-16">
                        <p className="font-bold text-[#001F3F]">
                          {grade.score}%
                        </p>
                        <p className="text-xs font-medium text-green-600">
                          {grade.grade}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "fees" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Fee Balance</h3>
                <span className="text-2xl font-bold text-[#001F3F]">
                  {formatCurrency(data.stats.balance)}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Next term: {data.stats.next_term}
              </p>
              <button className="w-full py-3 bg-[#D4AF37] text-[#001F3F] font-semibold rounded-xl hover:bg-[#c9a432] transition-colors">
                <MaterialIcon className="inline mr-2">payment</MaterialIcon>
                Pay Now via Mobile Money
              </button>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                Payment History
              </h3>
              <div className="text-center py-8 text-gray-500">
                <MaterialIcon className="text-4xl mb-2">
                  receipt_long
                </MaterialIcon>
                <p>No payment history yet</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "messages" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                Send Message to School
              </h3>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                className="w-full p-3 border border-gray-200 rounded-xl focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/20 outline-none"
                rows={3}
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim()}
                className="mt-3 w-full py-3 bg-[#001F3F] text-white font-semibold rounded-xl hover:bg-[#001a35] transition-colors disabled:opacity-50"
              >
                <MaterialIcon className="inline mr-2">send</MaterialIcon>
                Send Message
              </button>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">
                Recent Messages
              </h3>
              <div className="text-center py-8 text-gray-500">
                <MaterialIcon className="text-4xl mb-2">forum</MaterialIcon>
                <p>No messages yet</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
