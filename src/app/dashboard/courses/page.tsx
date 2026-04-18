"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/index";
import { Modal } from "@/components/ui/Modal";

interface Course {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  is_active: boolean;
  is_elective: boolean;
  is_laboratory: boolean;
  credit_hours: number;
  max_score: number;
  passing_score: number;
  color: string;
  icon: string;
}

const COURSE_CATEGORIES = [
  { value: "core", label: "Core", color: "bg-blue-100 text-blue-700" },
  {
    value: "elective",
    label: "Elective",
    color: "bg-green-100 text-green-700",
  },
  {
    value: "language",
    label: "Language",
    color: "bg-purple-100 text-purple-700",
  },
  { value: "science", label: "Science", color: "bg-cyan-100 text-cyan-700" },
  { value: "arts", label: "Arts", color: "bg-pink-100 text-pink-700" },
  {
    value: "technical",
    label: "Technical",
    color: "bg-amber-100 text-amber-700",
  },
];

const COURSE_ICONS = [
  "menu_book",
  "science",
  "calculate",
  "language",
  "history",
  "psychology",
  "music_note",
  "brush",
  "sports_soccer",
  "computer",
  "engineering",
  "biotech",
];

export default function CoursesPage() {
  const { school } = useAuth();
  const toast = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [filterCategory, setFilterCategory] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    category: "core",
    is_elective: false,
    is_laboratory: false,
    credit_hours: 0,
    max_score: 100,
    passing_score: 50,
    color: "#3b82f6",
    icon: "menu_book",
  });

  const fetchCourses = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);

    let query = supabase
      .from("courses")
      .select("*")
      .eq("school_id", school.id)
      .order("name");

    if (filterCategory) {
      query = query.eq("category", filterCategory);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Failed to load courses");
    } else {
      setCourses(data || []);
    }
    setLoading(false);
  }, [school?.id, filterCategory, toast]);

  useEffect(() => {
    if (school?.id) fetchCourses();
  }, [school?.id, fetchCourses]);

  const handleSubmit = async () => {
    if (!school?.id) return;

    const payload = {
      school_id: school.id,
      ...formData,
    };

    if (editingCourse) {
      const { error } = await supabase
        .from("courses")
        .update(payload)
        .eq("id", editingCourse.id);

      if (error) {
        toast.error("Failed to update course");
      } else {
        toast.success("Course updated");
        setShowModal(false);
        fetchCourses();
      }
    } else {
      const { error } = await supabase.from("courses").insert(payload);

      if (error) {
        toast.error("Failed to create course");
      } else {
        toast.success("Course created");
        setShowModal(false);
        fetchCourses();
      }
    }
  };

  const deleteCourse = async (id: string) => {
    if (!confirm("Delete this course?")) return;

    const { error } = await supabase.from("courses").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete course");
    } else {
      toast.success("Course deleted");
      fetchCourses();
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("courses")
      .update({ is_active: !isActive })
      .eq("id", id);

    if (!error) {
      fetchCourses();
    }
  };

  const getCategoryStyle = (category: string) => {
    return (
      COURSE_CATEGORIES.find((c) => c.value === category)?.color ||
      "bg-gray-100 text-gray-700"
    );
  };

  return (
    <PageErrorBoundary>
    <>
      <PageHeader
        title="Courses"
        subtitle="Manage subjects and courses offered"
        actions={
          <Button
            onClick={() => {
              setEditingCourse(null);
              setFormData({
                name: "",
                code: "",
                description: "",
                category: "core",
                is_elective: false,
                is_laboratory: false,
                credit_hours: 0,
                max_score: 100,
                passing_score: 50,
                color: "#3b82f6",
                icon: "menu_book",
              });
              setShowModal(true);
            }}
            icon={<MaterialIcon icon="add" />}
          >
            Add Course
          </Button>
        }
      />

      <div className="flex gap-4 mb-6">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-xl"
        >
          <option value="">All Categories</option>
          {COURSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-12">
          <MaterialIcon
            icon="menu_book"
            className="text-5xl text-gray-300 mx-auto mb-4"
          />
          <h3 className="text-lg font-medium text-gray-700">
            No courses found
          </h3>
          <p className="text-gray-500 mt-1">Add courses to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className={`bg-white rounded-2xl border p-4 ${
                course.is_active
                  ? "border-gray-200"
                  : "border-gray-100 bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: course.color + "20" }}
                >
                  <MaterialIcon
                    icon={course.icon || "menu_book"}
                    className="text-xl"
                    style={{ color: course.color }}
                  />
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryStyle(
                    course.category,
                  )}`}
                >
                  {course.category}
                </span>
              </div>

              <h3 className="font-semibold text-gray-900 mb-1">
                {course.name}
              </h3>
              <p className="text-sm text-gray-500 mb-2">{course.code}</p>

              {course.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {course.description}
                </p>
              )}

              <div className="flex flex-wrap gap-2 mb-3">
                {course.is_elective && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    Elective
                  </span>
                )}
                {course.is_laboratory && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    Lab
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <button
                  onClick={() => toggleActive(course.id, course.is_active)}
                  className={`text-sm ${
                    course.is_active ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {course.is_active ? "Active" : "Inactive"}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingCourse(course);
                      setFormData(course);
                      setShowModal(true);
                    }}
                    className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    <MaterialIcon icon="edit" />
                  </button>
                  <button
                    onClick={() => deleteCourse(course.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <MaterialIcon icon="delete" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCourse ? "Edit Course" : "Add Course"}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                placeholder="e.g., Mathematics"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    code: e.target.value.toUpperCase(),
                  })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                placeholder="e.g., MATH"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              rows={2}
              placeholder="Course description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              >
                {COURSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Icon
              </label>
              <select
                value={formData.icon}
                onChange={(e) =>
                  setFormData({ ...formData, icon: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              >
                {COURSE_ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color
              </label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                className="w-full h-10 border border-gray-200 rounded-xl cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Credit Hours
              </label>
              <input
                type="number"
                value={formData.credit_hours}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    credit_hours: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Score
              </label>
              <input
                type="number"
                value={formData.max_score}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    max_score: parseInt(e.target.value) || 100,
                  })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pass Score
              </label>
              <input
                type="number"
                value={formData.passing_score}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    passing_score: parseInt(e.target.value) || 50,
                  })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              />
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_elective}
                onChange={(e) =>
                  setFormData({ ...formData, is_elective: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Is Elective</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_laboratory}
                onChange={(e) =>
                  setFormData({ ...formData, is_laboratory: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Requires Lab</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || !formData.code}
            >
              {editingCourse ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
    </PageErrorBoundary>
  );
}
