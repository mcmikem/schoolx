"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useStudents } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { Tabs } from "@/components/ui/Tabs";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface BehaviorLog {
  id: string;
  student_id: string;
  description: string;
  type: string;
  severity: string;
  incident_date: string;
  action_taken: string;
  created_at: string;
  students: Student;
  users: { full_name: string };
}

const SEVERITY_LEVELS = [
  "Positive",
  "Minor",
  "Moderate",
  "Serious",
  "Critical",
];
const INCIDENT_TYPES = [
  "Disruption",
  "Respect",
  "Bullying",
  "Academic Honesty",
  "Safety Violation",
  "Property Damage",
  "Attendance",
  "Dress Code",
  "Other",
];

export default function BehaviorPage() {
  const { school, user } = useAuth();
  const { students } = useStudents(school?.id);
  const toast = useToast();
  const [logs, setLogs] = useState<BehaviorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLog, setEditingLog] = useState<BehaviorLog | null>(null);
  const [formData, setFormData] = useState({
    student_id: "",
    description: "",
    type: "",
    severity: "",
    incident_date: new Date().toISOString().split("T")[0],
    action_taken: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState("all");

  const fetchLogs = useCallback(async () => {
    if (!school?.id) return;
    try {
      const { data, error } = await supabase
        .from("behavior_logs")
        .select("*, students(first_name, last_name), users(full_name)")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "42P01" || error.code === "PGRST116") {
          setLogs([]);
          return;
        }
        throw error;
      }
      setLogs(data || []);
    } catch (err) {
      console.error("Error fetching behavior logs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [school?.id]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id) return;

    setSubmitting(true);
    try {
      const payload = {
        school_id: school.id,
        student_id: formData.student_id,
        description: formData.description,
        type: formData.type,
        severity: formData.severity,
        incident_date: formData.incident_date,
        action_taken: formData.action_taken,
        recorded_by: user?.id,
      };

      let error;
      if (editingLog) {
        ({ error } = await supabase
          .from("behavior_logs")
          .update(payload)
          .eq("id", editingLog.id));
      } else {
        ({ error } = await supabase.from("behavior_logs").insert(payload));
      }

      if (error) throw error;

      toast.success(editingLog ? "Log updated" : "Log added");
      closeModal();
      fetchLogs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save log");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("behavior_logs")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Log deleted");
      setDeleteId(null);
      fetchLogs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete log");
    }
  };

  const openModal = (log?: BehaviorLog) => {
    if (log) {
      setEditingLog(log);
      setFormData({
        student_id: log.student_id,
        description: log.description || "",
        type: log.type,
        severity: log.severity,
        incident_date:
          log.incident_date || new Date().toISOString().split("T")[0],
        action_taken: log.action_taken || "",
      });
    } else {
      setEditingLog(null);
      setFormData({
        student_id: "",
        description: "",
        type: "",
        severity: "",
        incident_date: new Date().toISOString().split("T")[0],
        action_taken: "",
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingLog(null);
    setFormData({
      student_id: "",
      description: "",
      type: "",
      severity: "",
      incident_date: new Date().toISOString().split("T")[0],
      action_taken: "",
    });
  };

  const getSeverityClass = (severity: string) => {
    if (severity === "Positive") return "bg-green-100 text-green-800";
    if (severity === "Minor") return "bg-blue-100 text-blue-800";
    if (severity === "Moderate") return "bg-yellow-100 text-yellow-800";
    if (severity === "Serious") return "bg-orange-100 text-orange-800";
    if (severity === "Critical") return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  const filteredLogs = logs.filter((log) => {
    if (filterSeverity === "all") return true;
    return log.severity === filterSeverity;
  });

  const tabs = [
    { id: "all", label: "All", count: logs.length },
    {
      id: "Positive",
      label: "Positive",
      count: logs.filter((l) => l.severity === "Positive").length,
    },
    {
      id: "Minor",
      label: "Minor",
      count: logs.filter((l) => l.severity === "Minor").length,
    },
    {
      id: "Moderate",
      label: "Moderate",
      count: logs.filter((l) => l.severity === "Moderate").length,
    },
    {
      id: "Serious",
      label: "Serious",
      count: logs.filter((l) => l.severity === "Serious").length,
    },
    {
      id: "Critical",
      label: "Critical",
      count: logs.filter((l) => l.severity === "Critical").length,
    },
  ];

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Behavior Log"
        subtitle="Track student behavior and incidents"
        actions={
          <Button
            onClick={() => openModal()}
            icon={<MaterialIcon icon="add" className="text-lg" />}
          >
            Add Log
          </Button>
        }
      />

      <Tabs
        tabs={tabs}
        activeTab={filterSeverity}
        onChange={setFilterSeverity}
        className="mb-6"
      />

      {loading ? (
        <Card>
          <CardBody className="p-0">
            <TableSkeleton rows={5} />
          </CardBody>
        </Card>
      ) : logs.length === 0 ? (
        <EmptyState
          icon="policy"
          title="No behavior logs"
          description="Add your first behavior log to get started"
          action={{ label: "Add Log", onClick: () => openModal() }}
        />
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Incident</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Date</th>
                    <th>Action Taken</th>
                    <th>Recorded By</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="font-medium">
                        {log.students?.first_name} {log.students?.last_name}
                      </td>
                      <td className="max-w-xs truncate">{log.description}</td>
                      <td>
                        <span
                          className={`badge ${log.severity === "Positive" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                        >
                          {log.type}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${getSeverityClass(log.severity)}`}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td>
                        {log.incident_date
                          ? new Date(log.incident_date).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="max-w-xs truncate">
                        {log.action_taken || "-"}
                      </td>
                      <td>{log.users?.full_name || "-"}</td>
                      <td>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => openModal(log)}
                            size="sm"
                            variant="ghost"
                            icon={
                              <MaterialIcon icon="edit" className="text-lg" />
                            }
                          />
                          <Button
                            onClick={() => setDeleteId(log.id)}
                            size="sm"
                            variant="ghost"
                            icon={
                              <MaterialIcon icon="delete" className="text-lg" />
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--t1)]">
                  {editingLog ? "Edit Log" : "Add Log"}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 text-[var(--t3)] hover:text-[var(--t1)]"
                >
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">
                  Student
                </label>
                {students.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                    No students available
                  </div>
                ) : (
                  <select
                    value={formData.student_id}
                    onChange={(e) =>
                      setFormData({ ...formData, student_id: e.target.value })
                    }
                    className="input"
                    required
                  >
                    <option value="">Select student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.first_name} {student.last_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">
                  Incident Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="input"
                  required
                >
                  <option value="">Select type</option>
                  {INCIDENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">
                  Severity
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) =>
                    setFormData({ ...formData, severity: e.target.value })
                  }
                  className="input"
                  required
                >
                  <option value="">Select severity</option>
                  {SEVERITY_LEVELS.map((sev) => (
                    <option key={sev} value={sev}>
                      {sev}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">
                  Incident Date
                </label>
                <input
                  type="date"
                  value={formData.incident_date}
                  onChange={(e) =>
                    setFormData({ ...formData, incident_date: e.target.value })
                  }
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="input"
                  placeholder="Describe the incident"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--t1)] mb-2 block">
                  Action Taken
                </label>
                <textarea
                  value={formData.action_taken}
                  onChange={(e) =>
                    setFormData({ ...formData, action_taken: e.target.value })
                  }
                  className="input"
                  placeholder="Action taken or planned"
                  rows={2}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={closeModal}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Saving..." : editingLog ? "Update" : "Add Log"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MaterialIcon icon="delete" className="text-2xl text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--t1)] mb-2">
                Delete Log?
              </h3>
              <p className="text-[var(--t3)]">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setDeleteId(null)}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleDelete(deleteId)}
                variant="danger"
                className="flex-1"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
