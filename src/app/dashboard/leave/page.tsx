"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Tabs } from "@/components/ui/Tabs";

interface LeaveRequest {
  id: string;
  staff_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: string;
  substitute_suggestion: string | null;
  created_at: string;
  users?: { full_name: string };
}

const LEAVE_TYPES = [
  { value: "sick", label: "Sick Leave" },
  { value: "personal", label: "Personal" },
  { value: "bereavement", label: "Bereavement" },
  { value: "maternity", label: "Maternity" },
  { value: "study", label: "Study Leave" },
  { value: "other", label: "Other" },
];

export default function LeavePage() {
  const { school, user } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<
    | "all"
    | "needs_approval"
    | "pending"
    | "dos_approved"
    | "approved"
    | "rejected"
  >("all");
  const [form, setForm] = useState({
    leave_type: "sick",
    start_date: "",
    end_date: "",
    reason: "",
    substitute_suggestion: "",
  });

  const isDOS = user?.role === "dean_of_studies";
  const isHM = user?.role === "headmaster" || user?.role === "school_admin";
  const [processing, setProcessing] = useState<string | null>(null);
  const [commentModal, setCommentModal] = useState<{
    id: string;
    action: "approved" | "rejected";
  } | null>(null);
  const [comments, setComments] = useState("");

  const fetchRequests = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, users!staff_id(full_name)")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch {
      console.error("Error fetching leave requests");
    } finally {
      setLoading(false);
    }
  }, [school?.id]);

  useEffect(() => {
    if (school?.id) fetchRequests();
  }, [school?.id, fetchRequests]);

  const calcDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id || !user?.id) return;

    setSaving(true);
    try {
      const days = calcDays(form.start_date, form.end_date);

      const { data, error } = await supabase
        .from("leave_requests")
        .insert({
          school_id: school.id,
          staff_id: user.id,
          leave_type: form.leave_type,
          start_date: form.start_date,
          end_date: form.end_date,
          days_count: days,
          reason: form.reason,
          substitute_suggestion: form.substitute_suggestion || null,
          status: "pending",
        })
        .select("*, users!staff_id(full_name)")
        .single();

      if (error) throw error;

      setRequests((prev) => [data, ...prev]);
      toast.success("Leave request submitted");
      setShowModal(false);
      setForm({
        leave_type: "sick",
        start_date: "",
        end_date: "",
        reason: "",
        substitute_suggestion: "",
      });
    } catch {
      toast.error("Failed to submit leave request");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> =
      {
        pending: {
          bg: "bg-[var(--amber-soft)]",
          text: "text-[var(--amber)]",
          label: "Pending",
        },
        dos_approved: {
          bg: "bg-[var(--navy-soft)]",
          text: "text-[var(--navy)]",
          label: "DOS Approved",
        },
        approved: {
          bg: "bg-[var(--green-soft)]",
          text: "text-[var(--green)]",
          label: "HM Approved",
        },
        rejected: {
          bg: "bg-[var(--red-soft)]",
          text: "text-[var(--red)]",
          label: "Rejected",
        },
      };
    const s = styles[status] || styles.pending;
    return (
      <span
        className={`px-2 py-1 rounded-lg text-xs font-medium ${s.bg} ${s.text}`}
      >
        {s.label}
      </span>
    );
  };

  const getLeaveTypeLabel = (type: string) => {
    return LEAVE_TYPES.find((t) => t.value === type)?.label || type;
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const dosApprovedCount = requests.filter(
    (r) => r.status === "dos_approved",
  ).length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;
  const needsApprovalCount = isHM
    ? requests.filter(
        (r) => r.status === "pending" || r.status === "dos_approved",
      ).length
    : isDOS
      ? pendingCount
      : 0;

  const tabs = [
    { id: "all", label: "All", count: requests.length },
    ...(isHM || isDOS
      ? [
          {
            id: "needs_approval",
            label: "Needs Approval",
            count: needsApprovalCount,
          },
        ]
      : []),
    { id: "pending", label: "Pending", count: pendingCount },
    { id: "dos_approved", label: "DOS Approved", count: dosApprovedCount },
    { id: "approved", label: "HM Approved", count: approvedCount },
    { id: "rejected", label: "Rejected", count: rejectedCount },
  ];

  const filteredRequests =
    filter === "all"
      ? requests
      : filter === "needs_approval"
        ? requests.filter((r) =>
            isHM
              ? r.status === "pending" || r.status === "dos_approved"
              : r.status === "pending",
          )
        : requests.filter((r) => r.status === filter);

  const handleApproval = async (
    requestId: string,
    action: "approved" | "rejected",
    commentText: string = "",
  ) => {
    if (!user?.id || !school?.id) return;
    setProcessing(requestId);
    try {
      const request = requests.find((r) => r.id === requestId);
      if (!request) return;

      let newStatus: string;
      if (action === "rejected") {
        newStatus = "rejected";
      } else if (isDOS) {
        if (request.days_count <= 3) {
          newStatus = "approved";
        } else {
          newStatus = "dos_approved";
        }
      } else {
        newStatus = "approved";
      }

      await supabase
        .from("leave_requests")
        .update({
          status: newStatus,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      await supabase.from("leave_approvals").insert({
        school_id: school.id,
        leave_request_id: requestId,
        approver_id: user.id,
        action: newStatus,
        comments: commentText || null,
      });

      toast.success(`Leave ${action === "approved" ? "approved" : "rejected"}`);
      await fetchRequests();
    } catch {
      toast.error("Failed to process leave request");
    } finally {
      setProcessing(null);
      setCommentModal(null);
      setComments("");
    }
  };

  const canApprove = (req: LeaveRequest) => {
    if (req.status === "approved" || req.status === "rejected") return false;
    if (isHM && (req.status === "pending" || req.status === "dos_approved"))
      return true;
    if (isDOS && req.status === "pending") return true;
    return false;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={isHM || isDOS ? "Leave Management" : "My Leave Requests"}
        subtitle={
          isHM || isDOS
            ? "Manage staff leave requests and approvals"
            : "Submit and track your leave applications"
        }
        actions={
          <Button onClick={() => setShowModal(true)}>
            <MaterialIcon icon="add" />
            Request Leave
          </Button>
        }
      />

      <Tabs
        tabs={tabs}
        activeTab={filter}
        onChange={(id) => setFilter(id as typeof filter)}
        className="mb-6"
      />

      {loading ? (
        <Card>
          <CardBody>
            <TableSkeleton rows={3} />
          </CardBody>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon="event_busy"
              title="No leave requests"
              description="Submit a request when you need time off"
              action={{
                label: "Request Leave",
                onClick: () => setShowModal(true),
              }}
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => (
            <Card key={req.id}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--on-surface)]">
                        {getLeaveTypeLabel(req.leave_type)}
                      </span>
                      {getStatusBadge(req.status)}
                    </div>
                    <div className="text-sm text-[var(--t3)] mt-1">
                      {new Date(req.start_date).toLocaleDateString()} –{" "}
                      {new Date(req.end_date).toLocaleDateString()} (
                      {req.days_count} day{req.days_count !== 1 ? "s" : ""})
                    </div>
                    {req.reason && (
                      <div className="text-sm text-[var(--t3)] mt-1">
                        {req.reason}
                      </div>
                    )}
                    {req.substitute_suggestion && (
                      <div className="text-sm text-[var(--t3)] mt-1">
                        <MaterialIcon
                          icon="person"
                          className="text-xs align-middle"
                        />{" "}
                        Suggested substitute: {req.substitute_suggestion}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-[var(--t3)]">
                    {new Date(req.created_at).toLocaleDateString()}
                  </span>
                </div>
                {req.status === "pending" && req.days_count > 3 && (
                  <div className="mt-2 text-xs text-[var(--t3)] bg-[var(--surface-container)] rounded-lg p-2">
                    Requires DOS approval → HM final approval
                  </div>
                )}
                {req.status === "pending" && req.days_count <= 3 && (
                  <div className="mt-2 text-xs text-[var(--t3)] bg-[var(--surface-container)] rounded-lg p-2">
                    DOS can approve directly (≤ 3 days)
                  </div>
                )}
                {req.status === "dos_approved" && (
                  <div className="mt-2 text-xs text-[var(--t3)] bg-[var(--navy-soft)] rounded-lg p-2">
                    Awaiting Headmaster final approval
                  </div>
                )}
                {canApprove(req) && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproval(req.id, "approved")}
                      disabled={processing === req.id}
                      className="bg-[var(--green)] text-white hover:bg-[var(--green)]/90"
                    >
                      <MaterialIcon icon="check" className="text-sm" />
                      {processing === req.id ? "Processing..." : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleApproval(req.id, "rejected")}
                      disabled={processing === req.id}
                      className="text-[var(--red)] border-[var(--red)]/30 hover:bg-[var(--red-soft)]"
                    >
                      <MaterialIcon icon="close" className="text-sm" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Card className="w-full max-w-md">
              <div className="p-6 border-b border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                    Request Leave
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowModal(false)}
                  >
                    <MaterialIcon icon="close" className="text-xl" />
                  </Button>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    Leave Type
                  </label>
                  <select
                    value={form.leave_type}
                    onChange={(e) =>
                      setForm({ ...form, leave_type: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    required
                  >
                    {LEAVE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) =>
                        setForm({ ...form, start_date: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(e) =>
                        setForm({ ...form, end_date: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                      required
                    />
                  </div>
                </div>

                {form.start_date && form.end_date && (
                  <div className="text-sm text-[var(--t3)] bg-[var(--surface-container)] rounded-lg p-2">
                    {calcDays(form.start_date, form.end_date)} day
                    {calcDays(form.start_date, form.end_date) !== 1 ? "s" : ""}
                    {calcDays(form.start_date, form.end_date) > 3
                      ? " — Requires DOS → HM approval"
                      : " — DOS can approve directly"}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    Reason
                  </label>
                  <textarea
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 min-h-[80px]"
                    required
                    placeholder="Brief reason for your leave..."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    Substitute Suggestion (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.substitute_suggestion}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        substitute_suggestion: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                    placeholder="Name of suggested substitute teacher"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    className="flex-1"
                    loading={saving}
                  >
                    {saving ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
