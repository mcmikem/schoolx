"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import MaterialIcon from "@/components/MaterialIcon";

interface TableCheck {
  name: string;
  exists: boolean;
  count: number;
}

export default function SetupPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<TableCheck[]>([]);
  const [envOk, setEnvOk] = useState(false);

  const TABLES_TO_CHECK = [
    "schools",
    "users",
    "students",
    "classes",
    "subjects",
    "attendance",
    "grades",
    "fee_structure",
    "fee_payments",
    "messages",
    "timetable",
    "sms_logs",
    "sms_automations",
    "feedbacks",
    "error_logs",
    "student_conduct",
  ];

  const checkHealth = async () => {
    setLoading(true);
    const results: TableCheck[] = [];

    for (const table of TABLES_TO_CHECK) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true });
        results.push({
          name: table,
          exists: !error,
          count: count || 0,
        });
      } catch {
        results.push({ name: table, exists: false, count: 0 });
      }
    }

    setTables(results);
    setEnvOk(results.every((t) => t.exists));
    setLoading(false);
  };

  useEffect(() => {
    checkHealth();
  });

  const allOk = tables.length > 0 && tables.every((t) => t.exists);

  if (user?.role !== "super_admin") {
    return (
      <div className="p-6">
        <div className="empty-state">
          <MaterialIcon
            icon="admin_panel_settings"
            className="text-4xl text-gray-400"
          />
          <h3 className="text-lg font-semibold mt-2">Access Restricted</h3>
          <p className="text-sm text-gray-500">
            Only super admins can view system health.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002045]">System Health</h1>
        <p className="text-[#5c6670] mt-1">
          Verify database tables and system status
        </p>
      </div>

      {/* Overall Status */}
      <div
        className={`rounded-2xl border p-6 mb-6 ${allOk ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${allOk ? "bg-green-100" : "bg-red-100"}`}
          >
            <MaterialIcon
              icon={allOk ? "check_circle" : "error"}
              className={allOk ? "text-green-600" : "text-red-600"}
              style={{ fontSize: 28 }}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#002045]">
              {allOk ? "All Systems Operational" : "Issues Detected"}
            </h2>
            <p className="text-sm text-[#5c6670]">
              {allOk
                ? `${tables.length} database tables verified. System is ready.`
                : `${tables.filter((t) => !t.exists).length} table(s) missing. Run migrations in Supabase.`}
            </p>
          </div>
        </div>
      </div>

      {/* Environment */}
      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#002045] mb-4">
          Environment
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-[#f8fafb] rounded-lg">
            <div>
              <div className="font-medium text-sm text-[#002045]">
                Supabase Connection
              </div>
              <div className="text-xs text-[#5c6670]">
                Database URL and API keys configured
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${envOk ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
            >
              {envOk ? "Connected" : "Failed"}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-[#f8fafb] rounded-lg">
            <div>
              <div className="font-medium text-sm text-[#002045]">
                SMS Gateway
              </div>
              <div className="text-xs text-[#5c6670]">
                Africa's Talking API configured
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              {process.env.NEXT_PUBLIC_AFRICAS_TALKING_API_KEY
                ? "Configured"
                : "Sandbox Mode"}
            </span>
          </div>
        </div>
      </div>

      {/* Database Tables */}
      <div className="bg-white rounded-2xl border border-[#e8eaed] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#002045]">
            Database Tables
          </h2>
          <button
            onClick={checkHealth}
            disabled={loading}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <MaterialIcon icon="refresh" style={{ fontSize: 16 }} />
            {loading ? "Checking..." : "Re-check"}
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {tables.map((table) => (
              <div
                key={table.name}
                className="flex items-center justify-between p-3 bg-[#f8fafb] rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <MaterialIcon
                    icon={table.exists ? "table_chart" : "error_outline"}
                    style={{
                      fontSize: 18,
                      color: table.exists ? "#16a34a" : "#dc2626",
                    }}
                  />
                  <div>
                    <div className="font-medium text-sm text-[#002045]">
                      {table.name}
                    </div>
                    {table.exists && (
                      <div className="text-xs text-[#5c6670]">
                        {table.count} records
                      </div>
                    )}
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    table.exists
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {table.exists ? "OK" : "Missing"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
