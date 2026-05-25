"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useOfflineLeaveRequests } from '@/lib/offline-hooks';
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

  const demoRequests: LeaveRequest[] = [
    {
      id: "demo-leave-1",
      staff_id: user?.id || "",
      leave_type: "sick",
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
      days_count: 3,
      reason: "Feeling unwell",
      status: "pending",
      created_at: new Date().toISOString(),
      users: { full_name: user?.role === "teacher" ? "You" : "John Okello" },
    },
  ];

  // Offline-aware leave requests
  const {
    data: rawRequests = [],
    loading,
    error: requestsError,
    refetch: refetchRequests,
  } = useOfflineLeaveRequests(school?.id, user?.id, isManager, { skipCache: isDemo });
  const requests = isDemo && rawRequests.length === 0 ? demoRequests : rawRequests;
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSub] = useState(false);
  const [form, setForm] = useState({
    leaveType: "sick",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const leaveValidationError = !form.startDate || !form.endDate
    ? "Add start date and end date to submit your request."
    : new Date(form.endDate) < new Date(form.startDate)
      ? "End date cannot be before start date."
      : "";

  // Offline hook handles fetching requests

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (leaveValidationError) {
      toast.error(leaveValidationError);
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
      refetchRequests();
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
      refetchRequests();
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

  const statusLabel = (s: LeaveRequest["status"]) => {
    switch (s) {
      case "dos_approved":
        return "DOS Approved";
      case "approved":
        return "HM Approved";
      case "rejected":
        return "Rejected";
      default:
        return "Pending";
    }
  };

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Leave Requests"
        subtitle={isManager ? "Review and manage staff leave" : "Submit and track your leave applications"}
        actions={
          !isManager ? (
            <Button onClick={() => setShowModal(true)} className="w-full sm:w-auto">
              <MaterialIcon icon="add" />
              Request Leave
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Pending", value: requests.filter((r) => r.status === "pending").length, tone: "text-amber-700 bg-amber-50" },
          { label: "DOS Approved", value: requests.filter((r) => r.status === "dos_approved").length, tone: "text-blue-700 bg-blue-50" },
          { label: "HM Approved", value: requests.filter((r) => r.status === "approved").length, tone: "text-emerald-700 bg-emerald-50" },
          { label: "Rejected", value: requests.filter((r) => r.status === "rejected").length, tone: "text-red-700 bg-red-50" },
          { label: "Total", value: requests.length, tone: "text-slate-700 bg-slate-50" },
        ].map((item) => (
          <div key={item.label} className={`rounded-2xl border border-slate-100 p-3 ${item.tone}`}>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] opacity-80">{item.label}</div>
            <div className="mt-1 text-lg font-bold">{item.value}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <MaterialIcon icon="event_busy" className="text-4xl mx-auto mb-2" />
          <p>No leave requests</p>
          {!isManager && (
            <Button className="mt-4" onClick={() => setShowModal(true)}>Request Leave</Button>
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
                      {statusLabel(r.status)}
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
        <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-4 overflow-y-auto flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto">
            <h2 className="text-xl font-semibold mb-4">Request Leave</h2>
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
                  <Button type="submit" disabled={submitting || Boolean(leaveValidationError)} className="flex-1">{submitting ? "Submitting..." : "Submit Request"}</Button>
                </div>
                {leaveValidationError && (
                  <p className="text-sm text-[var(--t3)]">{leaveValidationError}</p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
