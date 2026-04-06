"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

interface SystemStats {
  totalSchools: number;
  totalStudents: number;
  totalStaff: number;
  activeSubscriptions: number;
  trialSchools: number;
  expiredSchools: number;
}

interface SchoolInfo {
  id: string;
  name: string;
  district: string;
  ownership: string;
  subscription_plan: string;
  subscription_status: string;
  created_at: string;
  student_count: number;
  staff_count: number;
}

export default function SuperAdminDashboard() {
  const { user, isDemo } = useAuth();
  const [stats, setStats] = useState<SystemStats>({
    totalSchools: 0,
    totalStudents: 0,
    totalStaff: 0,
    activeSubscriptions: 0,
    trialSchools: 0,
    expiredSchools: 0,
  });
  const [schools, setSchools] = useState<SchoolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "schools" | "users" | "settings"
  >("overview");

  useEffect(() => {
    loadSystemData();
  }, []);

  const loadSystemData = async () => {
    if (isDemo) {
      setStats({
        totalSchools: 5,
        totalStudents: 1247,
        totalStaff: 89,
        activeSubscriptions: 4,
        trialSchools: 1,
        expiredSchools: 0,
      });
      setSchools([
        {
          id: "1",
          name: "St. Mary's Primary",
          district: "Kampala",
          ownership: "private",
          subscription_plan: "premium",
          subscription_status: "active",
          created_at: "2024-01-15",
          student_count: 450,
          staff_count: 32,
        },
        {
          id: "2",
          name: "Kampala Junior School",
          district: "Kampala",
          ownership: "private",
          subscription_plan: "basic",
          subscription_status: "active",
          created_at: "2024-03-20",
          student_count: 280,
          staff_count: 18,
        },
        {
          id: "3",
          name: "Mbarara High School",
          district: "Mbarara",
          ownership: "government",
          subscription_plan: "trial",
          subscription_status: "trial",
          created_at: "2025-01-10",
          student_count: 520,
          staff_count: 40,
        },
        {
          id: "4",
          name: "Jinja College",
          district: "Jinja",
          ownership: "private",
          subscription_plan: "premium",
          subscription_status: "active",
          created_at: "2023-08-01",
          student_count: 680,
          staff_count: 45,
        },
        {
          id: "5",
          name: "Soroti Primary",
          district: "Soroti",
          ownership: "government",
          subscription_plan: "basic",
          subscription_status: "expired",
          created_at: "2023-05-15",
          student_count: 310,
          staff_count: 22,
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      // Get all schools with counts
      const { data: schoolsData } = await supabase
        .from("schools")
        .select(
          "id, name, district, ownership, subscription_plan, subscription_status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(50);

      // Get student count
      const { count: studentCount } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true });

      // Get staff count
      const { count: staffCount } = await supabase
        .from("staff")
        .select("*", { count: "exact", head: true });

      const activeSchools =
        schoolsData?.filter((s) => s.subscription_status === "active").length ||
        0;
      const trialSchools =
        schoolsData?.filter((s) => s.subscription_status === "trial").length ||
        0;
      const expiredSchools =
        schoolsData?.filter((s) => s.subscription_status === "expired")
          .length || 0;

      setStats({
        totalSchools: schoolsData?.length || 0,
        totalStudents: studentCount || 0,
        totalStaff: staffCount || 0,
        activeSubscriptions: activeSchools,
        trialSchools,
        expiredSchools,
      });

      setSchools(
        (schoolsData || []).map((s) => ({
          ...s,
          student_count: 0,
          staff_count: 0,
        })),
      );
    } catch (err) {
      console.error("Error loading system data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="content">
        <PageHeader title="Super Admin" subtitle="System Control Center" />
        <div className="flex items-center justify-center py-20">
          <MaterialIcon className="text-4xl text-primary animate-spin">
            sync
          </MaterialIcon>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <PageHeader
        title="Super Admin Dashboard"
        subtitle="System-wide control center for SkulMate OS"
      />

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "overview"
              ? "bg-[var(--primary)] text-white"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-bright"
          }`}
        >
          <MaterialIcon icon="dashboard" className="inline mr-2" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab("schools")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "schools"
              ? "bg-[var(--primary)] text-white"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-bright"
          }`}
        >
          <MaterialIcon icon="school" className="inline mr-2" />
          Schools
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "users"
              ? "bg-[var(--primary)] text-white"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-bright"
          }`}
        >
          <MaterialIcon icon="people" className="inline mr-2" />
          Users
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "settings"
              ? "bg-[var(--primary)] text-white"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-bright"
          }`}
        >
          <MaterialIcon icon="settings" className="inline mr-2" />
          Settings
        </button>
      </div>

      {activeTab === "overview" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <Card>
              <CardBody className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {stats.totalSchools}
                </div>
                <div className="text-xs text-on-surface-variant">
                  Total Schools
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {stats.totalStudents.toLocaleString()}
                </div>
                <div className="text-xs text-on-surface-variant">
                  Total Students
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {stats.totalStaff}
                </div>
                <div className="text-xs text-on-surface-variant">
                  Total Staff
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-3xl font-bold text-emerald-600">
                  {stats.activeSubscriptions}
                </div>
                <div className="text-xs text-on-surface-variant">Active</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-3xl font-bold text-amber-600">
                  {stats.trialSchools}
                </div>
                <div className="text-xs text-on-surface-variant">Trial</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-3xl font-bold text-red-500">
                  {stats.expiredSchools}
                </div>
                <div className="text-xs text-on-surface-variant">Expired</div>
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-on-surface">Quick Actions</h3>
              </CardHeader>
              <CardBody className="grid grid-cols-2 gap-3">
                <Button className="justify-start">
                  <MaterialIcon icon="add_business" />
                  Add New School
                </Button>
                <Button variant="secondary" className="justify-start">
                  <MaterialIcon icon="person_add" />
                  Create User
                </Button>
                <Button variant="secondary" className="justify-start">
                  <MaterialIcon icon="analytics" />
                  View Reports
                </Button>
                <Button variant="secondary" className="justify-start">
                  <MaterialIcon icon="settings" />
                  System Config
                </Button>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-semibold text-on-surface">
                  Recent Activity
                </h3>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <MaterialIcon className="text-green-500">
                    check_circle
                  </MaterialIcon>
                  <span className="text-on-surface">
                    New school "Jinja Primary" registered
                  </span>
                  <span className="text-on-surface-variant ml-auto text-xs">
                    2h ago
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MaterialIcon className="text-amber-500">
                    warning
                  </MaterialIcon>
                  <span className="text-on-surface">
                    3 schools trial expiring soon
                  </span>
                  <span className="text-on-surface-variant ml-auto text-xs">
                    5h ago
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MaterialIcon className="text-blue-500">
                    payments
                  </MaterialIcon>
                  <span className="text-on-surface">
                    Payment received from St. Mary's
                  </span>
                  <span className="text-on-surface-variant ml-auto text-xs">
                    1d ago
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MaterialIcon className="text-teal-500">person</MaterialIcon>
                  <span className="text-on-surface">
                    New super admin user added
                  </span>
                  <span className="text-on-surface-variant ml-auto text-xs">
                    2d ago
                  </span>
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}

      {activeTab === "schools" && (
        <Card>
          <CardHeader className="flex justify-between items-center">
            <h3 className="font-semibold text-on-surface">All Schools</h3>
            <Button size="sm">
              <MaterialIcon icon="add" />
              Add School
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-container">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant">
                      School
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant">
                      District
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant">
                      Ownership
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant">
                      Plan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant">
                      Students
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant">
                      Staff
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {schools.map((school) => (
                    <tr key={school.id} className="hover:bg-surface-bright">
                      <td className="px-4 py-3 font-medium text-on-surface">
                        {school.name}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {school.district}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-surface-container rounded text-xs capitalize">
                          {school.ownership}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant uppercase text-xs">
                        {school.subscription_plan}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            school.subscription_status === "active"
                              ? "bg-green-100 text-green-800"
                              : school.subscription_status === "trial"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {school.subscription_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {school.student_count}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {school.staff_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {activeTab === "users" && (
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-on-surface">System Users</h3>
          </CardHeader>
          <CardBody className="p-8 text-center text-on-surface-variant">
            <MaterialIcon className="text-4xl mb-2">people</MaterialIcon>
            <p>User management coming soon</p>
          </CardBody>
        </Card>
      )}

      {activeTab === "settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-on-surface">
                System Configuration
              </h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-on-surface">Demo Mode</div>
                  <div className="text-sm text-on-surface-variant">
                    Enable demo accounts for testing
                  </div>
                </div>
                <button className="w-12 h-6 bg-primary rounded-full relative">
                  <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                </button>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-on-surface">SMS Gateway</div>
                  <div className="text-sm text-on-surface-variant">
                    Enable bulk SMS services
                  </div>
                </div>
                <button className="w-12 h-6 bg-primary rounded-full relative">
                  <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                </button>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-on-surface">
                    Payment Gateway
                  </div>
                  <div className="text-sm text-on-surface-variant">
                    Enable mobile money payments
                  </div>
                </div>
                <button className="w-12 h-6 bg-primary rounded-full relative">
                  <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                </button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-semibold text-on-surface">Email Settings</h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  From Email
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                  placeholder="noreply@omuto.org"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  Support Email
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                  placeholder="support@omuto.org"
                />
              </div>
              <Button className="w-full">Save Settings</Button>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
