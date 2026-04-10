"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { DEMO_STAFF } from "@/lib/demo-data";

interface Activity {
  id: string;
  staffName: string;
  action: string;
  target: string;
  timestamp: string;
  type: "attendance" | "grade" | "note" | "leave";
}

export default function StaffActivityPage() {
  const { isDemo } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (isDemo) {
      setActivities([
        {
          id: "1",
          staffName: "Mary Johnson",
          action: "Marked attendance",
          target: "S.1 Blue",
          timestamp: "2026-04-10 08:15",
          type: "attendance",
        },
        {
          id: "2",
          staffName: "John Smith",
          action: "Submitted grades",
          target: "S.2 Mathematics",
          timestamp: "2026-04-10 09:30",
          type: "grade",
        },
        {
          id: "3",
          staffName: "Sarah Davis",
          action: "Posted notice",
          target: "Exam Schedule",
          timestamp: "2026-04-09 14:00",
          type: "note",
        },
        {
          id: "4",
          staffName: "Mike Brown",
          action: "Requested leave",
          target: "Apr 20-22",
          timestamp: "2026-04-09 10:00",
          type: "leave",
        },
      ]);
    }
  }, [isDemo]);

  const filtered =
    filter === "all" ? activities : activities.filter((a) => a.type === filter);

  const getIcon = (type: string) => {
    switch (type) {
      case "attendance":
        return "check_circle";
      case "grade":
        return "grade";
      case "note":
        return "campaign";
      case "leave":
        return "event_busy";
      default:
        return "history";
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Staff Activity"
        subtitle="Track recent staff actions and updates"
      />

      <div className="flex gap-2 mb-6">
        {["all", "attendance", "grade", "note", "leave"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <MaterialIcon icon="history" className="text-4xl mx-auto mb-2" />
            <p>No activity recorded</p>
          </div>
        ) : (
          filtered.map((activity) => (
            <Card key={activity.id}>
              <CardBody>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <MaterialIcon
                      icon={getIcon(activity.type)}
                      className="text-gray-600"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{activity.staffName}</h3>
                    <p className="text-sm text-gray-500">
                      {activity.action} • {activity.target}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {activity.timestamp}
                  </span>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
