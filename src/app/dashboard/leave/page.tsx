"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

interface LeaveRequest {
  id: string;
  staff_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: "pending" | "dos_approved" | "approved" | "rejected";
  created_at: string;
  users?: { full_name: string };
}

const MANAGER_ROLES = ["headmaster", "dean_of_studies", "admin", "school_admin"];

function diffDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

export default function LeavePage() {
  const { user, school, isDemo } = useAuth();
  const toast = useToast();
  const isManager = MANAGER_ROLES.includes(user?.role ?? "");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSub] = useState(false);
  const [form, setForm] = useState({
    leaveType: "sick",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const fetchRequests = useCallback(async () => {
    if (!school?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      let query = supabase
        .from("leave_requests")
        .select("*, users:staff_id(full_name)")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false });

      // Non-managers only see their own requests
      if (!isManager && user?.id) {
        query = query.eq("staff_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRequests((data as LeaveRequest[]) || []);
    } catch {
      toast.error("Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  }, [school?.id, user?.id, isManager, toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.startDate || !form.endDate) {
      toast.error("Please enter start and end dates");
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      toast.error("End date cannot be before start date");
      return;
    }
    setSub(true);
    try {
      const { error } = await supabase.from("leave_requests").insert({
        school_id: school!.id,
        staff_id: user!.id,
        leave_type: form.leaveType,
        start_date: form.startDate,
        end_date: form.endDate,
        days_count: diffDays(form.startDate, form.endDate),
        reason: form.reason,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Leave request submitted");
      setShowModal(false);
      setForm({ leaveType: "sick", startDate: "", endDate: "", reason: "" });
      fetchRequests();
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit leave request");
    } finally {
      setSub(false);
    }
  };

  const handleUpdateStatus = async (
    id: string,
    status: "approved" | "rejected",
  ) => {
    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({ status, approved_by: user!.id, approved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success(`Leave ${status}`);
      fetchRequests();
    } catch {
      toast.error("Failed to update leave status");
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "approved": return "bg-green-100 text-green-700";
      case "rejected": return "bg-red-100 text-red-700";
      case "dos_approved": return "bg-blue-100 text-blue-700";
      default: return "bg-yellow-100 text-yellow-700";
    }
  };

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Leave Requests"
        subtitle={isManager ? "Review and manage staff leave" : "Submit and track your leave applications"}
        actions={
          !isManager ? (
            <Button onClick={() => setShowModal(true)}>
              <MaterialIcon icon="add" />
              Apply for Leave
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <MaterialIcon icon="event_busy" className="text-4xl mx-auto mb-2" />
          <p>No leave requests</p>
          {!isManager && (
            <Button className="mt-4" onClick={() => setShowModal(true)}>Apply for Leave</Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {isManager && (
                      <p className="text-xs font-bold text-gray-500 uppercase mb-1">{r.users?.full_name || "Staff"}</p>
                    )}
                    <h3 className="font-semibold capitalize">{r.leave_type} Leave</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {r.start_date} → {r.end_date} ({r.days_count} day{r.days_count !== 1 ? "s" : ""})
                    </p>
                    {r.reason && <p className="text-xs text-gray-400 mt-1">{r.reason}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(r.status)}`}>
                      {r.status.replace("_", " ")}
                    </span>
                    {isManager && r.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(r.id, "approved")}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(r.id, "rejected")}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Apply for Leave</h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Leave Type</label>
                  <select
                    value={form.leaveType}
                    onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                    className="input w-full"
                  >
                    {["sick", "personal", "bereavement", "maternity", "paternity", "study", "annual", "unpaid", "other"].map((t) => (
                      <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Start Date</label>
                    <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input w-full" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">End Date</label>
                    <input type="date" value={form.endDate} min={form.startDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input w-full" required />
                  </div>
                </div>
                {form.startDate && form.endDate && (
                  <p className="text-xs text-gray-500">{diffDays(form.startDate, form.endDate)} day(s)</p>
                )}
                <div>
                  <label className="text-sm font-medium mb-1 block">Reason</label>
                  <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="input w-full min-h-[80px]" placeholder="Brief reason for leave..." />
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
                  <Button type="submit" disabled={submitting} className="flex-1">{submitting ? "Submitting..." : "Submit Request"}</Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
