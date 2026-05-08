"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLeaveRequests } from "@/lib/hooks/staff";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { getErrorMessage } from "@/lib/validation";

export default function LeaveApprovalsPage() {
  const { school } = useAuth();
  const toast = useToast();
  const { requests, loading, updateRequestStatus } = useLeaveRequests(school?.id);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingRequests = requests.filter((r) => r.status === "pending");

  const handleAction = async (id: string, status: "approved" | "rejected") => {
    setProcessingId(id);
    try {
      await updateRequestStatus(id, status);
      toast.success(`Leave request ${status} successfully`);
    } catch (err: any) {
      toast.error(getErrorMessage(err, `Failed to ${status} leave request`));
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && requests.length === 0) {
    return (
      <div className="p-8">
        <TableSkeleton />
      </div>
    );
  }

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Staff Leave Approvals"
          subtitle="Manage teacher and staff time-off requests to ensure teaching continuity"
        />

        {pendingRequests.length === 0 ? (
          <EmptyState
            icon="event_available"
            title="All caught up!"
            description="There are no pending leave requests at the moment."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pendingRequests.map((request) => (
              <Card key={request.id} className="overflow-hidden border-l-4 border-l-indigo-500">
                <CardBody className="p-0">
                  <div className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {(request.users?.full_name || "S").charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-[var(--primary)]">
                            {request.users?.full_name || "Staff Member"}
                          </h3>
                          <p className="text-xs text-[var(--t3)] font-medium">
                            {request.leave_type} • Requested {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-[var(--surface-container)] rounded-xl p-3 mb-4">
                        <div className="flex items-center gap-6 mb-2">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-[var(--t3)] tracking-wider">Start Date</p>
                            <p className="text-sm font-semibold text-[var(--t1)]">{new Date(request.start_date).toLocaleDateString()}</p>
                          </div>
                          <MaterialIcon icon="arrow_forward" className="text-[var(--t3)]" />
                          <div>
                            <p className="text-[10px] uppercase font-bold text-[var(--t3)] tracking-wider">End Date</p>
                            <p className="text-sm font-semibold text-[var(--t1)]">{new Date(request.end_date).toLocaleDateString()}</p>
                          </div>
                          <div className="ml-auto text-right">
                            <p className="text-[10px] uppercase font-bold text-[var(--t3)] tracking-wider">Duration</p>
                            <p className="text-sm font-bold text-indigo-600">{request.days_count} Days</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-[var(--border)]">
                          <p className="text-[10px] uppercase font-bold text-[var(--t3)] tracking-wider mb-1">Reason</p>
                          <p className="text-sm text-[var(--t2)] italic">"{request.reason}"</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2 md:pt-0">
                      <Button
                        variant="ghost"
                        className="text-rose-600 hover:bg-rose-50"
                        onClick={() => handleAction(request.id, "rejected")}
                        disabled={processingId === request.id}
                      >
                        <MaterialIcon icon="close" />
                        Reject
                      </Button>
                      <Button
                        className="bg-indigo-600 shadow-indigo-600/20"
                        onClick={() => handleAction(request.id, "approved")}
                        disabled={processingId === request.id}
                        loading={processingId === request.id}
                      >
                        <MaterialIcon icon="check" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-10">
          <h3 className="text-sm font-bold text-[var(--t3)] uppercase tracking-widest mb-4">
            Recent Approvals
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
            {requests
              .filter((r) => r.status !== "pending")
              .slice(0, 6)
              .map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <MaterialIcon
                      icon={r.status === "approved" ? "check_circle" : "cancel"}
                      className={r.status === "approved" ? "text-emerald-500" : "text-rose-500"}
                    />
                    <div>
                      <p className="text-xs font-bold text-[var(--t1)]">{r.users?.full_name}</p>
                      <p className="text-[10px] text-[var(--t3)]">{r.leave_type}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${r.status === "approved" ? "text-emerald-600" : "text-rose-600"}`}>
                    {r.status}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  );
}
