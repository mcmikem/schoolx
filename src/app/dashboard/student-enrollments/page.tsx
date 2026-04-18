"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, Badge, Select } from "@/components/ui/index";
import { Modal } from "@/components/ui/Modal";

interface StudentEnrollment {
  id: string;
  student_id: string;
  class_id: string;
  academic_year: string;
  roll_number: string;
  enrollment_date: string;
  state: string;
  completion_date: string;
  notes: string;
  student?: {
    first_name: string;
    last_name: string;
    student_number: string;
  };
  class?: {
    name: string;
    level: string;
  };
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  student_number: string;
}

interface Class {
  id: string;
  name: string;
  level: string;
}

export default function StudentEnrollmentsPage() {
  const { school } = useAuth();
  const toast = useToast();
  const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterYear, setFilterYear] = useState(
    new Date().getFullYear().toString(),
  );
  const [filterClass, setFilterClass] = useState("");

  const [formData, setFormData] = useState({
    student_id: "",
    class_id: "",
    academic_year: new Date().getFullYear().toString(),
    roll_number: "",
    state: "running",
  });

  const fetchEnrollments = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);

    let query = supabase
      .from("student_enrollments")
      .select(
        "*, student:students(first_name, last_name, student_number), class:classes(name, level)",
      )
      .eq("school_id", school.id)
      .eq("academic_year", filterYear);

    if (filterClass) {
      query = query.eq("class_id", filterClass);
    }

    const { data, error } = await query.order("enrollment_date", {
      ascending: false,
    });

    if (error) {
      toast.error("Failed to load enrollments");
    } else {
      setEnrollments(data || []);
    }
    setLoading(false);
  }, [school?.id, filterYear, filterClass, toast]);

  const fetchOptions = useCallback(async () => {
    if (!school?.id) return;

    const [studentsRes, classesRes] = await Promise.all([
      supabase
        .from("students")
        .select("id, first_name, last_name, student_number")
        .eq("school_id", school.id)
        .eq("status", "active")
        .order("first_name"),
      supabase
        .from("classes")
        .select("id, name, level")
        .eq("school_id", school.id)
        .order("name"),
    ]);

    setStudents(studentsRes.data || []);
    setClasses(classesRes.data || []);
  }, [school?.id]);

  useEffect(() => {
    if (school?.id) {
      fetchEnrollments();
      fetchOptions();
    }
  }, [school?.id, fetchEnrollments, fetchOptions]);

  const handleSubmit = async () => {
    if (!school?.id) return;

    const { error } = await supabase.from("student_enrollments").insert({
      school_id: school.id,
      ...formData,
    });

    if (error) {
      toast.error("Failed to create enrollment");
    } else {
      toast.success("Enrollment created");
      setShowModal(false);
      fetchEnrollments();
    }
  };

  const updateState = async (id: string, newState: string) => {
    const updates: any = { state: newState };
    if (
      newState === "completed" ||
      newState === "transferred" ||
      newState === "dropped"
    ) {
      updates.completion_date = new Date().toISOString();
    }

    const { error } = await supabase
      .from("student_enrollments")
      .update(updates)
      .eq("id", id);
    if (error) {
      toast.error("Failed to update enrollment");
    } else {
      toast.success("Status updated");
      fetchEnrollments();
    }
  };

  const deleteEnrollment = async (id: string) => {
    if (!confirm("Delete this enrollment?")) return;
    const { error } = await supabase
      .from("student_enrollments")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success("Enrollment deleted");
      fetchEnrollments();
    }
  };

  const stateColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    running: "bg-green-100 text-green-700",
    completed: "bg-blue-100 text-blue-700",
    transferred: "bg-amber-100 text-amber-700",
    dropped: "bg-red-100 text-red-700",
  };

  return (
    <PageErrorBoundary>
    <>
      <PageHeader
        title="Student Enrollments"
        subtitle="Track student course enrollments and status"
        actions={
          <Button
            onClick={() => setShowModal(true)}
            icon={<MaterialIcon icon="add" />}
          >
            Add Enrollment
          </Button>
        }
      />

      <div className="flex gap-4 mb-6">
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-xl"
        >
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y.toString()}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-xl"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : enrollments.length === 0 ? (
        <div className="text-center py-12">
          <MaterialIcon
            icon="school"
            className="text-5xl text-gray-300 mx-auto mb-4"
          />
          <h3 className="text-lg font-medium text-gray-700">
            No enrollments found
          </h3>
          <p className="text-gray-500 mt-1">
            Add student enrollments to track course registrations
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Class
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Roll No.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enrollments.map((enrollment) => (
                <tr key={enrollment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {enrollment.student?.first_name}{" "}
                      {enrollment.student?.last_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {enrollment.student?.student_number}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900">
                      {enrollment.class?.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {enrollment.class?.level}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {enrollment.roll_number || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${stateColors[enrollment.state]}`}
                    >
                      {enrollment.state}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    {new Date(enrollment.enrollment_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <select
                      value={enrollment.state}
                      onChange={(e) =>
                        updateState(enrollment.id, e.target.value)
                      }
                      className="text-sm border border-gray-200 rounded px-2 py-1 mr-2"
                    >
                      <option value="draft">Draft</option>
                      <option value="running">Running</option>
                      <option value="completed">Completed</option>
                      <option value="transferred">Transferred</option>
                      <option value="dropped">Dropped</option>
                    </select>
                    <button
                      onClick={() => deleteEnrollment(enrollment.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <MaterialIcon icon="delete" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Enrollment"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Student
            </label>
            <select
              value={formData.student_id}
              onChange={(e) =>
                setFormData({ ...formData, student_id: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-xl"
            >
              <option value="">Select Student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name} ({s.student_number})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Class
            </label>
            <select
              value={formData.class_id}
              onChange={(e) =>
                setFormData({ ...formData, class_id: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-xl"
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Academic Year
              </label>
              <select
                value={formData.academic_year}
                onChange={(e) =>
                  setFormData({ ...formData, academic_year: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y.toString()}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Roll Number
              </label>
              <input
                type="text"
                value={formData.roll_number}
                onChange={(e) =>
                  setFormData({ ...formData, roll_number: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.student_id || !formData.class_id}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </>
    </PageErrorBoundary>
  );
}
