"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { useDormManager } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { logger } from "@/lib/logger";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/EmptyState";

export default function DormitoryPage() {
  const { school, user } = useAuth();
  const toast = useToast();
  const [dorms, setDorms] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedDormId, setSelectedDormId] = useState("");
  const { rooms, incidents, residents, loading, refetch } = useDormManager(school?.id, selectedDormId);

  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showDormModal, setShowDormModal] = useState(false);
  const [activeTab, setActiveTab] = useState("rooms");

  const fetchDorms = useCallback(async () => {
    if (!school?.id) return;
    const { data } = await supabase.from("dorms").select("*").eq("school_id", school.id);
    setDorms(data || []);
    if (data && data.length > 0 && !selectedDormId) setSelectedDormId(data[0].id);
  }, [school?.id, selectedDormId]);

  useEffect(() => {
    fetchDorms();
  }, [fetchDorms]);

  useEffect(() => {
    let cancelled = false;
    async function fetchStudents() {
      if (!school?.id) return;
      const { data } = await supabase
        .from("students")
        .select("id, first_name, last_name, student_number")
        .eq("school_id", school.id)
        .order("first_name");
      if (!cancelled) setStudents(data || []);
    }
    fetchStudents();
    return () => {
      cancelled = true;
    };
  }, [school?.id]);

  const residentIds = useMemo(() => new Set(residents.map((r) => r.student_id)), [residents]);
  const assignableStudents = useMemo(() => students.filter((s) => !residentIds.has(s.id)), [students, residentIds]);

  const handleAddDorm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!school?.id) return;
    const formData = new FormData(e.currentTarget);
    const result = await withTimeout(
      supabase
        .from("dorms")
        .insert([
          {
            school_id: school.id,
            name: formData.get("name"),
            type: formData.get("type"),
          },
        ])
        .select("id"),
      15000,
      timeoutFallback(),
    );
    if (result?.error) {
      logger.error("Failed to add dorm:", result.error);
      toast.error("Failed to add dorm");
      return;
    }
    toast.success("Dorm added");
    setShowDormModal(false);
    await fetchDorms();
  };

  const handleAddRoom = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDormId) {
      toast.error("Select a dorm first");
      return;
    }
    const formData = new FormData(e.currentTarget);
    const capacity = Number(formData.get("capacity"));
    const result = await withTimeout(
      supabase.from("dorm_rooms").insert([
        {
          dorm_id: selectedDormId,
          room_number: formData.get("room_number"),
          capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : 0,
          current_occupancy: 0,
        },
      ]),
      15000,
      timeoutFallback(),
    );
    if (result?.error) {
      logger.error("Failed to add room:", result.error);
      toast.error(
        result.error.code === "23505" ? "That room number already exists in this dorm" : "Failed to add room",
      );
      return;
    }
    toast.success("Room added");
    setShowRoomModal(false);
    refetch();
  };

  const handleAddIncident = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const incident = {
      school_id: school!.id,
      dorm_id: selectedDormId,
      student_id: formData.get("student_id"),
      incident_type: formData.get("incident_type"),
      description: formData.get("description"),
      incident_date: new Date().toISOString().split("T")[0],
      reported_by: user!.id,
    };

    const dormResult = await withTimeout(supabase.from("dorm_incidents").insert([incident]), 15000, timeoutFallback());
    const error = dormResult?.error;
    if (error) {
      logger.error("Failed to record incident:", error);
      toast.error("Failed to record incident");
    } else {
      toast.success("Incident recorded");
      setShowIncidentModal(false);
      refetch();
    }
  };

  const handleAssignResident = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDormId) return;
    const formData = new FormData(e.currentTarget);
    const studentId = formData.get("student_id");
    if (!studentId) {
      toast.error("Select a student");
      return;
    }
    const result = await withTimeout(
      supabase.from("dorm_students").insert([
        {
          dorm_id: selectedDormId,
          student_id: studentId,
          bed_number: formData.get("bed_number") || null,
        },
      ]),
      15000,
      timeoutFallback(),
    );
    if (result?.error) {
      logger.error("Failed to assign student:", result.error);
      toast.error(result.error.code === "23505" ? "That student is already in this dorm" : "Failed to assign student");
      return;
    }
    toast.success("Student assigned");
    refetch();
  };

  const handleRemoveResident = async (rowId: string) => {
    const result = await withTimeout(supabase.from("dorm_students").delete().eq("id", rowId), 15000, timeoutFallback());
    if (result?.error) {
      toast.error("Failed to remove student");
      return;
    }
    toast.success("Student removed");
    refetch();
  };

  const tabs = [
    { id: "rooms", label: "Rooms", count: rooms.length },
    { id: "residents", label: "Residents", count: residents.length },
    { id: "incidents", label: "Incidents", count: incidents.length },
  ];

  return (
    <PageErrorBoundary>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Dormitory Management"
          subtitle="Monitor student welfare and hostel occupancy"
          actions={
            <div className="flex items-center gap-3 flex-wrap">
              {dorms.length === 0 ? (
                <Button size="sm" onClick={() => setShowDormModal(true)}>
                  <MaterialIcon icon="add_business" />
                  Add Dorm
                </Button>
              ) : (
                <>
                  <select
                    value={selectedDormId}
                    onChange={(e) => setSelectedDormId(e.target.value)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  >
                    {dorms.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.type})
                      </option>
                    ))}
                  </select>
                  <Button variant="secondary" size="sm" onClick={() => setShowDormModal(true)}>
                    <MaterialIcon icon="add_business" />
                    Add Dorm
                  </Button>
                </>
              )}
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowIncidentModal(true)}
                disabled={dorms.length === 0}
              >
                <MaterialIcon icon="report_problem" />
                Report Incident
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Rooms", value: rooms.length, tone: "text-slate-700 bg-slate-50" },
            { label: "Residents", value: residents.length, tone: "text-blue-700 bg-blue-50" },
            {
              label: "Selected dorm",
              value: dorms.find((d) => d.id === selectedDormId)?.name || "None",
              tone: "text-blue-700 bg-blue-50",
            },
            { label: "Incidents", value: incidents.length, tone: "text-red-700 bg-red-50" },
          ].map((item) => (
            <div key={item.label} className={`rounded-2xl border border-[var(--border)] p-3 ${item.tone}`}>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] opacity-80">{item.label}</div>
              <div className="mt-1 text-sm font-bold truncate">{item.value as any}</div>
            </div>
          ))}
        </div>

        {dorms.length === 0 && !loading && (
          <Card className="p-12 text-center">
            <MaterialIcon className="text-5xl text-[var(--t3)] opacity-50 mx-auto">hotel</MaterialIcon>
            <p className="mt-2 text-[var(--t3)]">
              No dorms yet. Add a dorm to start tracking rooms, residents and incidents.
            </p>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                <h2 className="text-lg font-semibold text-[var(--on-surface)] flex items-center gap-2">
                  <MaterialIcon icon="bed" className="text-[var(--primary)]" />
                  Visual Room Map
                </h2>
                <button
                  onClick={() => setShowRoomModal(true)}
                  disabled={!selectedDormId}
                  className="text-sm font-semibold text-[var(--primary)] hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + Add Room
                </button>
              </div>
              <CardBody>
                <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-4" />
                <TabPanel activeTab={activeTab} tabId="rooms">
                  {rooms.length === 0 ? (
                    <EmptyState
                      icon="meeting_room"
                      title="No rooms"
                      description="Add a room to build the visual map for this dorm"
                    />
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                      {rooms.map((room) => {
                        const ratio = room.capacity > 0 ? room.current_occupancy / room.capacity : 0;
                        return (
                          <div
                            key={room.id}
                            className="p-4 rounded-xl bg-[var(--surface-container)] border border-[var(--border)] hover:border-[var(--primary)]/30 transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-semibold text-[var(--on-surface)]">{room.room_number}</p>
                              <MaterialIcon icon="meeting_room" className="text-[var(--t4)]" />
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs text-[var(--t3)] font-medium">
                                <span>Occupancy</span>
                                <span>
                                  {room.current_occupancy}/{room.capacity}
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-[var(--surface-container)] rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-500 ${
                                    ratio > 0.9 ? "bg-[var(--error)]" : "bg-[var(--primary)]"
                                  }`}
                                  style={{ width: `${Math.min(100, ratio * 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabPanel>
                <TabPanel activeTab={activeTab} tabId="residents">
                  {residents.length === 0 ? (
                    <EmptyState
                      icon="groups"
                      title="No residents"
                      description="Assign students to this dorm to enable roll call"
                    />
                  ) : (
                    <div className="space-y-2">
                      {residents.map((resident) => (
                        <div
                          key={resident.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]"
                        >
                          <div>
                            <p className="text-sm font-medium text-[var(--on-surface)]">
                              {resident.students?.first_name} {resident.students?.last_name}
                            </p>
                            {resident.bed_number && (
                              <p className="text-xs text-[var(--t3)]">Bed {resident.bed_number}</p>
                            )}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveResident(resident.id)}>
                            <MaterialIcon icon="person_remove" />
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <form
                    onSubmit={handleAssignResident}
                    className="mt-4 pt-4 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-3 gap-3"
                  >
                    <select
                      name="student_id"
                      required
                      className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--on-surface)]"
                    >
                      <option value="">Select student...</option>
                      {assignableStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.first_name} {s.last_name}
                          {s.student_number ? ` (${s.student_number})` : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      name="bed_number"
                      placeholder="Bed number (optional)"
                      className="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--on-surface)] placeholder-[var(--t4)]"
                    />
                    <Button type="submit" size="sm" disabled={assignableStudents.length === 0}>
                      <MaterialIcon icon="person_add" />
                      Assign
                    </Button>
                  </form>
                </TabPanel>
                <TabPanel activeTab={activeTab} tabId="incidents">
                  {incidents.length === 0 ? (
                    <EmptyState
                      icon="check_circle"
                      title="No incidents"
                      description="No incidents recorded for this dorm"
                    />
                  ) : (
                    <div className="space-y-3">
                      {incidents.map((incident) => (
                        <div
                          key={incident.id}
                          className="p-4 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                incident.incident_type === "health"
                                  ? "bg-[var(--red-soft)] text-[var(--red)]"
                                  : "bg-[var(--amber-soft)] text-[var(--amber)]"
                              }`}
                            >
                              {incident.incident_type}
                            </span>
                            <p className="text-xs text-[var(--t4)]">{incident.incident_date}</p>
                          </div>
                          <p className="text-sm font-medium text-[var(--on-surface)]">
                            Student: {incident.students?.first_name || "Unknown"} {incident.students?.last_name || ""}
                          </p>
                          <p className="text-xs text-[var(--t3)] line-clamp-2 mt-1">{incident.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabPanel>
              </CardBody>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <div className="p-4 border-b border-[var(--border)]">
                <h2 className="text-lg font-semibold text-[var(--on-surface)] flex items-center gap-2">
                  <MaterialIcon icon="history" className="text-[var(--amber)]" />
                  Recent Incidents
                </h2>
              </div>
              <CardBody>
                {incidents.length === 0 ? (
                  <EmptyState icon="check_circle" title="All clear" description="No incidents recorded for this dorm" />
                ) : (
                  <div className="space-y-3">
                    {incidents.slice(0, 5).map((incident) => (
                      <div
                        key={incident.id}
                        className="p-4 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              incident.incident_type === "health"
                                ? "bg-[var(--red-soft)] text-[var(--red)]"
                                : "bg-[var(--amber-soft)] text-[var(--amber)]"
                            }`}
                          >
                            {incident.incident_type}
                          </span>
                          <p className="text-xs text-[var(--t4)]">{incident.incident_date}</p>
                        </div>
                        <p className="text-sm font-medium text-[var(--on-surface)] mt-2">
                          Student: {incident.students?.first_name || "Unknown"} {incident.students?.last_name || ""}
                        </p>
                        <p className="text-xs text-[var(--t3)] line-clamp-2 mt-1">{incident.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>

        {showDormModal && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
            <Card className="relative w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto">
              <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">Add Dorm</h2>
                <button
                  onClick={() => setShowDormModal(false)}
                  className="text-[var(--t4)] hover:text-[var(--on-surface)]"
                >
                  <MaterialIcon icon="close" />
                </button>
              </div>
              <form onSubmit={handleAddDorm} className="p-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Dorm Name</label>
                  <input
                    name="name"
                    required
                    placeholder="e.g. Boys Block A"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Type</label>
                  <select
                    name="type"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  >
                    <option value="boys">Boys</option>
                    <option value="girls">Girls</option>
                  </select>
                </div>
                <Button type="submit" className="w-full mt-4">
                  Save Dorm
                </Button>
              </form>
            </Card>
          </div>
        )}

        {showRoomModal && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
            <Card className="relative w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto">
              <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">Add Room</h2>
                <button
                  onClick={() => setShowRoomModal(false)}
                  className="text-[var(--t4)] hover:text-[var(--on-surface)]"
                >
                  <MaterialIcon icon="close" />
                </button>
              </div>
              <form onSubmit={handleAddRoom} className="p-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Room Number</label>
                  <input
                    name="room_number"
                    required
                    placeholder="e.g. A1"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Capacity</label>
                  <input
                    name="capacity"
                    type="number"
                    min={1}
                    required
                    placeholder="e.g. 8"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)]"
                  />
                </div>
                <Button type="submit" className="w-full mt-4">
                  Save Room
                </Button>
              </form>
            </Card>
          </div>
        )}

        {showIncidentModal && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
            <Card className="relative w-full max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-auto">
              <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">Report Dorm Incident</h2>
                <button
                  onClick={() => setShowIncidentModal(false)}
                  className="text-[var(--t4)] hover:text-[var(--on-surface)]"
                >
                  <MaterialIcon icon="close" />
                </button>
              </div>
              <form onSubmit={handleAddIncident} className="p-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Student</label>
                  <select
                    name="student_id"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  >
                    <option value="">Select student...</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name}
                        {s.student_number ? ` (${s.student_number})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Type</label>
                  <select
                    name="incident_type"
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  >
                    <option value="misbehavior">Misbehavior</option>
                    <option value="health">Health Issue</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Description</label>
                  <textarea
                    name="description"
                    required
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)]"
                    placeholder="Details of the incident..."
                  ></textarea>
                </div>
                <Button type="submit" variant="danger" className="w-full mt-4">
                  Submit Report
                </Button>
              </form>
            </Card>
          </div>
        )}
      </div>
    </PageErrorBoundary>
  );
}
