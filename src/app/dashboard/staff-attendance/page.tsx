"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import MaterialIcon from "@/components/MaterialIcon";
import OwlMascot from "@/components/brand/OwlMascot";

interface StaffMember {
  id: string;
  full_name: string;
  role: string;
}

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  status: string;
  time_in: string | null;
  time_out: string | null;
}

export default function StaffAttendancePage() {
  const { school, user } = useAuth();
  const toast = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchStaffAndAttendance = useCallback(async () => {
    if (!school?.id) return;
    try {
      setLoading(true);

      const { data: staffData } = await supabase
        .from("users")
        .select("id, full_name, role")
        .eq("school_id", school.id)
        .eq("is_active", true)
        .neq("role", "student")
        .neq("role", "parent");

      setStaff(staffData || []);

      const { data: attendanceData } = await supabase
        .from("staff_attendance")
        .select("*")
        .eq("school_id", school.id)
        .eq("date", date);

      const attendanceMap: Record<string, string> = {};
      attendanceData?.forEach((a) => {
        attendanceMap[a.user_id] = a.status;
      });
      setAttendance(attendanceMap);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [school?.id, date]);

  useEffect(() => {
    fetchStaffAndAttendance();
  }, [fetchStaffAndAttendance]);

  const markAttendance = (userId: string, status: string) => {
    setAttendance((prev) => ({ ...prev, [userId]: status }));
  };

  const markAll = (status: string) => {
    const newAttendance: Record<string, string> = {};
    staff.forEach((s) => {
      newAttendance[s.id] = status;
    });
    setAttendance(newAttendance);
  };

  const saveAttendance = async () => {
    if (!school?.id || !user?.id) return;

    try {
      setSaving(true);
      const records = Object.entries(attendance).map(([userId, status]) => ({
        school_id: school.id,
        user_id: userId,
        date,
        status,
        time_in:
          status === "present" || status === "late"
            ? new Date().toISOString()
            : null,
        time_out: null,
        recorded_by: user.id,
      }));

      const { error } = await supabase
        .from("staff_attendance")
        .upsert(records, { onConflict: "user_id,date" });

      if (error) throw error;
      toast.success("Staff attendance saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(attendance).filter(
    (s) => s === "present",
  ).length;
  const absentCount = Object.values(attendance).filter(
    (s) => s === "absent",
  ).length;
  const lateCount = Object.values(attendance).filter(
    (s) => s === "late",
  ).length;

  const statusOptions = [
    {
      status: "present",
      label: "Present",
      color: "bg-[#ecfdf5] text-[#006e1c] border-[#006e1c]",
      active: false,
    },
    {
      status: "absent",
      label: "Absent",
      color: "bg-[#fef2f2] text-[#ba1a1a] border-[#ba1a1a]",
      active: false,
    },
    {
      status: "late",
      label: "Late",
      color: "bg-[#fff7ed] text-[#b86e00] border-[#b86e00]",
      active: false,
    },
    {
      status: "leave",
      label: "Leave",
      color: "bg-[#e3f2fd] text-[#002045] border-[#002045]",
      active: false,
    },
  ];

  const getStatusClasses = (option: {
    status: string;
    color: string;
    active: boolean;
  }) => {
    return (prev: Record<string, string>, memberId: string) => {
      const isActive = prev[memberId] === option.status;
      return isActive
        ? option.color
        : "bg-white text-[#5c6670] border-[#e8eaed] hover:border-[#c4c6cf]";
    };
  };

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Staff Attendance"
        subtitle="Track daily staff attendance"
      />

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input sm:w-48"
            aria-label="Attendance date"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => markAll("present")}
            >
              <MaterialIcon icon="check_circle" className="text-lg" />
              Mark All Present
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => markAll("absent")}
            >
              <MaterialIcon icon="cancel" className="text-lg" />
              Mark All Absent
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="text-center">
          <div className="text-2xl font-bold text-[#006e1c]">
            {presentCount}
          </div>
          <div className="text-sm text-[#5c6670] mt-1">Present</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-[#ba1a1a]">{absentCount}</div>
          <div className="text-sm text-[#5c6670] mt-1">Absent</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-[#b86e00]">{lateCount}</div>
          <div className="text-sm text-[#5c6670] mt-1">Late</div>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <TableSkeleton key={i} rows={1} />
          ))}
        </div>
      ) : staff.length === 0 ? (
        <EmptyState
          icon="groups"
          title="No staff members"
          description="Add staff members first"
        />
      ) : (
        <>
          <div className="space-y-3">
            {staff.map((member) => (
              <Card key={member.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <OwlMascot size={40} premium ring glow />
                    <div>
                      <div className="font-medium text-[#191c1d]">
                        {member.full_name}
                      </div>
                      <div className="text-xs text-[#5c6670] capitalize">
                        {member.role}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {statusOptions.map((option) => (
                      <button
                        key={option.status}
                        onClick={() => markAttendance(member.id, option.status)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          attendance[member.id] === option.status
                            ? option.color
                            : "bg-white text-[#5c6670] border-[#e8eaed] hover:border-[#c4c6cf]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Button
            onClick={saveAttendance}
            disabled={saving || Object.keys(attendance).length === 0}
            className="w-full"
          >
            <MaterialIcon icon="save" className="text-lg" />
            {saving ? "Saving..." : "Save Attendance"}
          </Button>
        </>
      )}
    </div>
    </PageErrorBoundary>
  );
}
