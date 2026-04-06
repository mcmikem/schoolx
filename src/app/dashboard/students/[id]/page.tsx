"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  User,
  Droplets,
  IdCard,
  GraduationCap,
  ClipboardCheck,
  FileText,
  CreditCard,
  MoreHorizontal,
  TrendingUp,
  Edit,
  Printer,
  Home,
  Moon,
  Trophy,
  School,
  Star,
  Award,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

import { useStudent } from "@/lib/hooks";

const gradeHistory = [
  { term: "Term 1 2024", average: 72 },
  { term: "Term 2 2024", average: 75 },
  { term: "Term 3 2024", average: 78 },
  { term: "Term 1 2025", average: 82 },
  { term: "Term 2 2025", average: 80 },
  { term: "Term 1 2026", average: 85 },
];

const subjectScores = [
  { subject: "Math", score: 85 },
  { subject: "English", score: 90 },
  { subject: "Science", score: 78 },
  { subject: "SST", score: 72 },
  { subject: "RE", score: 88 },
  { subject: "Kiswahili", score: 65 },
  { subject: "CAPE", score: 92 },
];

export default function StudentProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const { student, loading, error } = useStudent(params.id);
  const [activeTab, setActiveTab] = useState("overview");

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-800"></div>
      </div>
    );

  if (error || !student)
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 dark:text-red-400 mb-4">
          Student not found
        </div>
        <Link href="/dashboard/students" className="btn btn-primary">
          Back to Students
        </Link>
      </div>
    );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/students"
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Student Profile</h1>
          <p className="text-gray-500 text-sm">
            View and manage student details
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Edit className="w-4 h-4" />
          Edit
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          <Printer className="w-4 h-4" />
          Print Report
        </button>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        {/* Cover */}
        <div className="h-32 bg-gradient-to-r from-primary-700 to-primary-500" />

        {/* Profile Info */}
        <div className="px-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-12">
            {/* Photo */}
            <div className="w-24 h-24 bg-primary-100 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center">
              <span className="text-3xl font-bold text-primary-700">
                {student.first_name?.[0] || "?"}
                {student.last_name?.[0] || "?"}
              </span>
            </div>

            {/* Name & Details */}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">
                {student.first_name || "Unknown"}{" "}
                {student.last_name || "Student"}
              </h2>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <IdCard className="w-4 h-4" /> {student.student_number}
                </span>
                <span className="flex items-center gap-1">
                  <GraduationCap className="w-4 h-4" />{" "}
                  {student.classes?.name || "N/A"}
                </span>
                <span className="flex items-center gap-1 uppercase tracking-widest font-black text-[10px]">
                  <Droplets className="w-4 h-4" /> Blood:{" "}
                  {student.blood_type || "N/A"}
                </span>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100/50">
                  {student.status}
                </span>
                {(student as any).boarding_status && (student as any).boarding_status !== 'day' && (
                  <span className="px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-teal-100/50">
                    {(student as any).boarding_status}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4">
              {[
                {
                  label: "Status",
                  value: student.status || "Active",
                  color: "text-green-600",
                },
                {
                  label: "Class",
                  value: student.classes?.name ? `${student.classes.name}${student.classes?.stream ? ` ${student.classes.stream}` : ""}` : "N/A",
                  color: "text-blue-600",
                },
                {
                  label: "Student #",
                  value: student.student_number || "N/A",
                  color: "text-primary-600",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="text-center px-4 py-2 bg-gray-50 rounded-lg"
                >
                  <div className={`text-xl font-bold ${stat.color}`}>
                    {stat.value}
                  </div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              {
                icon: Calendar,
                label: "Schedule",
                color: "bg-blue-50 text-blue-600",
              },
              {
                icon: ClipboardCheck,
                label: "Attendance",
                color: "bg-green-50 text-green-600",
              },
              {
                icon: FileText,
                label: "Evaluations",
                color: "bg-teal-50 text-primary-600",
              },
              {
                icon: CreditCard,
                label: "Fees",
                color: "bg-yellow-50 text-yellow-600",
              },
              {
                icon: MoreHorizontal,
                label: "More",
                color: "bg-gray-50 text-gray-600",
              },
            ].map((action) => (
              <button
                key={action.label}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${action.color}`}
              >
                <action.icon className="w-4 h-4" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contact & Parents Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Contact */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            Contact Information
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Phone className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Parent Phone</div>
                <div className="text-sm font-medium text-gray-900">
                  {student.parent_phone || "N/A"}
                </div>
              </div>
            </div>
            {student.parent_phone2 && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Parent Phone 2</div>
                  <div className="text-sm font-medium text-gray-900">
                    {student.parent_phone2}
                  </div>
                </div>
              </div>
            )}
            {student.parent_email && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Email</div>
                  <div className="text-sm font-medium text-gray-900">
                    {student.parent_email}
                  </div>
                </div>
              </div>
            )}
            {student.address && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-yellow-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Address</div>
                  <div className="text-sm font-medium text-gray-900">
                    {student.address}
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Date of Birth</div>
                <div className="text-sm font-medium text-gray-900">
                  {student.date_of_birth
                    ? new Date(student.date_of_birth).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Admission Date</div>
                <div className="text-sm font-medium text-gray-900">
                  {student.admission_date
                    ? new Date(student.admission_date).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Parents */}
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Parent/Guardian</h3>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">
                  {student.parent_name || "N/A"}
                </div>
                <div className="text-sm text-gray-500">Primary Guardian</div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <span>{student.parent_phone || "N/A"}</span>
              </div>
              {student.parent_phone2 && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{student.parent_phone2}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Info - House, Origin, Leadership */}
      {((student as any).house_id || (student as any).previous_school || (student as any).district_origin || (student as any).prefect_role || (student as any).student_council_role) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {(student as any).house_id && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">House & Boarding</h3>
              <div className="space-y-3">
                {(student as any).house_id && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center">
                      <Home className="w-4 h-4 text-teal-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">House</div>
                      <div className="text-sm font-medium text-gray-900">{(student as any).house?.name || "Assigned"}</div>
                    </div>
                  </div>
                )}
                {(student as any).boarding_status && (student as any).boarding_status !== "day" && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                      <Moon className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Boarding</div>
                      <div className="text-sm font-medium text-gray-900 capitalize">{(student as any).boarding_status}</div>
                    </div>
                  </div>
                )}
                {(student as any).games_house && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Games House</div>
                      <div className="text-sm font-medium text-gray-900">{(student as any).games_house?.name || "Assigned"}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {((student as any).previous_school || (student as any).district_origin) && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Origin</h3>
              <div className="space-y-3">
                {(student as any).previous_school && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                      <School className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Previous School</div>
                      <div className="text-sm font-medium text-gray-900">{(student as any).previous_school}</div>
                    </div>
                  </div>
                )}
                {(student as any).district_origin && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">District</div>
                      <div className="text-sm font-medium text-gray-900">{(student as any).district_origin}</div>
                    </div>
                  </div>
                )}
                {(student as any).sub_county && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-yellow-50 rounded-lg flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-yellow-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Sub-county</div>
                      <div className="text-sm font-medium text-gray-900">{(student as any).sub_county}</div>
                    </div>
                  </div>
                )}
                {(student as any).village && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                      <Home className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Village</div>
                      <div className="text-sm font-medium text-gray-900">{(student as any).village}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {((student as any).prefect_role || (student as any).student_council_role || (student as any).is_class_monitor) && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Leadership</h3>
              <div className="space-y-3">
                {(student as any).is_class_monitor && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <Star className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Role</div>
                      <div className="text-sm font-medium text-gray-900">Class Monitor</div>
                    </div>
                  </div>
                )}
                {(student as any).prefect_role && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                      <Award className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Prefect Role</div>
                      <div className="text-sm font-medium text-gray-900 capitalize">{(student as any).prefect_role.replace(/_/g, " ")}</div>
                    </div>
                  </div>
                )}
                {(student as any).student_council_role && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center">
                      <User className="w-4 h-4 text-cyan-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Council Role</div>
                      <div className="text-sm font-medium text-gray-900 capitalize">{(student as any).student_council_role.replace(/_/g, " ")}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Grade Progress */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Grade Progress</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={gradeHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="term" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="average"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ fill: "#2563eb" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Subject Scores */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Subject Scores</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={subjectScores}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="subject" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Student Number",
            value: student.student_number || "N/A",
            icon: IdCard,
            color: "bg-blue-500",
          },
          {
            label: "Gender",
            value: student.gender === "M" ? "Male" : "Female",
            icon: User,
            color: "bg-green-500",
          },
          {
            label: "Class",
            value: student.classes?.name ? `${student.classes.name}${student.classes?.stream ? ` ${student.classes.stream}` : ""}` : "N/A",
            icon: GraduationCap,
            color: "bg-primary-500",
          },
          {
            label: "Status",
            value: student.status || "Active",
            icon: TrendingUp,
            color: "bg-yellow-500",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`${stat.color} p-2 rounded-lg`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xl font-bold text-gray-900">
                  {stat.value}
                </div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
