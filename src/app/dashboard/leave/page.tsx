"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { DEMO_STAFF } from "@/lib/demo-data";

const DEMO_MODE_ENABLED =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES === "true";

interface LeaveRequest {
  id: string;
  staffName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
}

export default function LeavePage() {
  const { user, isDemo } = useAuth();
  const toast = useToast();
  const [isManager, setIsManager] = useState(false);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    leaveType: "sick",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (DEMO_MODE_ENABLED && isDemo) {
      setIsManager(true);
      setRequests([
        {
          id: "1",
          staffName: "Mary Johnson",
          leaveType: "Sick",
          startDate: "2026-04-15",
          endDate: "2026-04-17",
          reason: "Medical appointment",
          status: "pending",
        },
        {
          id: "2",
          staffName: "John Smith",
          leaveType: "Annual",
          startDate: "2026-04-20",
          endDate: "2026-04-25",
          reason: "Family vacation",
          status: "approved",
        },
      ]);
    }
  }, [isDemo, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const newRequest: LeaveRequest = {
      id: `leave-${Date.now()}`,
      staffName: "Current User",
      leaveType: form.leaveType,
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason,
      status: "pending",
    };
    setRequests([newRequest, ...requests]);
    setShowModal(false);
    setForm({ leaveType: "sick", startDate: "", endDate: "", reason: "" });
    toast.success("Leave request submitted");
    setSubmitting(false);
  };

  const handleApprove = (id: string) => {
    setRequests(
      requests.map((r) => (r.id === id ? { ...r, status: "approved" } : r)),
    );
    toast.success("Leave approved");
  };

  const handleReject = (id: string) => {
    setRequests(
      requests.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)),
    );
    toast.success("Leave rejected");
  };

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {!DEMO_MODE_ENABLED && (
        <Card className="mb-6">
          <CardBody className="p-6">
            <p className="text-sm text-[var(--t2)]">
              Leave management is temporarily unavailable in this production
              build while workflow hardening is in progress.
            </p>
          </CardBody>
        </Card>
      )}
      <PageHeader
        title="Leave Requests"
        subtitle={
          isManager
            ? "Review and manage staff leave"
            : "Submit and track leave applications"
        }
        actions={
          <Button
            onClick={() => setShowModal(true)}
            disabled={!DEMO_MODE_ENABLED || !isDemo}
          >
            <MaterialIcon icon="add" />
            Request Leave
          </Button>
        }
      />

      <div className="space-y-4">
        {requests.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <MaterialIcon icon="event_busy" className="text-4xl mx-auto mb-2" />
            <p>No leave requests</p>
          </div>
        ) : (
          requests.map((req) => (
            <Card key={req.id}>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{req.staffName}</h3>
                    <p className="text-sm text-gray-500">
                      {req.leaveType} • {req.startDate} to {req.endDate}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{req.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${req.status === "pending" ? "bg-yellow-100 text-yellow-700" : req.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {req.status}
                    </span>
                    {isManager && req.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleApprove(req.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleReject(req.id)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>

      {DEMO_MODE_ENABLED && isDemo && showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Request Leave</h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Leave Type
                  </label>
                  <select
                    value={form.leaveType}
                    onChange={(e) =>
                      setForm({ ...form, leaveType: e.target.value })
                    }
                    className="input w-full"
                  >
                    <option>Sick</option>
                    <option>Annual</option>
                    <option>Personal</option>
                    <option>Maternity/Paternity</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) =>
                        setForm({ ...form, startDate: e.target.value })
                      }
                      className="input w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) =>
                        setForm({ ...form, endDate: e.target.value })
                      }
                      className="input w-full"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Reason
                  </label>
                  <textarea
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                    className="input w-full min-h-[80px]"
                    placeholder="Brief reason for your leave..."
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? "Submitting..." : "Submit Request"}
                  </Button>
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
