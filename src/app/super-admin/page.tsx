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

interface SchoolFeatures {
  sms: boolean;
  attendance: boolean;
  fees: boolean;
  grades: boolean;
  reports: boolean;
  parents: boolean;
  canteen: boolean;
  library: boolean;
  transport: boolean;
  health: boolean;
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
  primary_color: string;
  features: SchoolFeatures;
  monthly_fee: number;
}

const DEFAULT_FEATURES: SchoolFeatures = {
  sms: true,
  attendance: true,
  fees: true,
  grades: true,
  reports: true,
  parents: true,
  canteen: false,
  library: false,
  transport: false,
  health: false,
};

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
    "overview" | "schools" | "features" | "settings"
  >("overview");
  const [selectedSchool, setSelectedSchool] = useState<SchoolInfo | null>(null);

  useEffect(() => {
    loadSystemData();
  }, []);

  const loadSystemData = async () => {
    if (isDemo) {
      setStats({
        totalSchools: 12,
        totalStudents: 8547,
        totalStaff: 456,
        activeSubscriptions: 9,
        trialSchools: 3,
        expiredSchools: 0,
      });
      setSchools([
        {
          id: "1",
          name: "St. Mary's Primary School",
          district: "Kampala",
          ownership: "private",
          subscription_plan: "premium",
          subscription_status: "active",
          created_at: "2024-01-15",
          student_count: 850,
          staff_count: 45,
          primary_color: "#001F3F",
          features: { ...DEFAULT_FEATURES, canteen: true, library: true },
          monthly_fee: 350000,
        },
        {
          id: "2",
          name: "Kampala Junior School",
          district: "Kampala",
          ownership: "private",
          subscription_plan: "basic",
          subscription_status: "active",
          created_at: "2024-03-20",
          student_count: 420,
          staff_count: 22,
          primary_color: "#1a5f3c",
          features: { ...DEFAULT_FEATURES },
          monthly_fee: 280000,
        },
        {
          id: "3",
          name: "Mbarara High School",
          district: "Mbarara",
          ownership: "government",
          subscription_plan: "trial",
          subscription_status: "trial",
          created_at: "2025-01-10",
          student_count: 1200,
          staff_count: 65,
          primary_color: "#7c1d05",
          features: { ...DEFAULT_FEATURES, transport: true, health: true },
          monthly_fee: 150000,
        },
        {
          id: "4",
          name: "Jinja College",
          district: "Jinja",
          ownership: "private",
          subscription_plan: "premium",
          subscription_status: "active",
          created_at: "2023-08-01",
          student_count: 980,
          staff_count: 52,
          primary_color: "#0f3460",
          features: {
            ...DEFAULT_FEATURES,
            canteen: true,
            library: true,
            transport: true,
          },
          monthly_fee: 420000,
        },
        {
          id: "5",
          name: "Soroti Primary School",
          district: "Soroti",
          ownership: "government",
          subscription_plan: "basic",
          subscription_status: "active",
          created_at: "2023-05-15",
          student_count: 560,
          staff_count: 28,
          primary_color: "#1e3a5f",
          features: { ...DEFAULT_FEATURES },
          monthly_fee: 120000,
        },
        {
          id: "6",
          name: "Ntungamo Mixed School",
          district: "Ntungamo",
          ownership: "private",
          subscription_plan: "trial",
          subscription_status: "trial",
          created_at: "2025-02-01",
          student_count: 380,
          staff_count: 18,
          primary_color: "#2d4a3e",
          features: { ...DEFAULT_FEATURES },
          monthly_fee: 200000,
        },
        {
          id: "7",
          name: "Masaka Academy",
          district: "Masaka",
          ownership: "private",
          subscription_plan: "premium",
          subscription_status: "active",
          created_at: "2023-11-20",
          student_count: 720,
          staff_count: 38,
          primary_color: "#3d1f5c",
          features: { ...DEFAULT_FEATURES, canteen: true, health: true },
          monthly_fee: 380000,
        },
        {
          id: "8",
          name: "Kabale Regional School",
          district: "Kabale",
          ownership: "government",
          subscription_plan: "basic",
          subscription_status: "active",
          created_at: "2024-02-10",
          student_count: 890,
          staff_count: 42,
          primary_color: "#5c1f1f",
          features: { ...DEFAULT_FEATURES },
          monthly_fee: 100000,
        },
        {
          id: "9",
          name: "Entebbe Light School",
          district: "Wakiso",
          ownership: "private",
          subscription_plan: "trial",
          subscription_status: "trial",
          created_at: "2025-03-15",
          student_count: 250,
          staff_count: 15,
          primary_color: "#1f3d5c",
          features: { ...DEFAULT_FEATURES, parents: true },
          monthly_fee: 300000,
        },
        {
          id: "10",
          name: "Gulu High School",
          district: "Gulu",
          ownership: "private",
          subscription_plan: "premium",
          subscription_status: "active",
          created_at: "2023-06-05",
          student_count: 1100,
          staff_count: 58,
          primary_color: "#4a1942",
          features: {
            ...DEFAULT_FEATURES,
            canteen: true,
            library: true,
            transport: true,
          },
          monthly_fee: 450000,
        },
        {
          id: "11",
          name: "Mubende Modern P/S",
          district: "Mubende",
          ownership: "private",
          subscription_plan: "basic",
          subscription_status: "active",
          created_at: "2024-08-01",
          student_count: 340,
          staff_count: 16,
          primary_color: "#1f4a3d",
          features: { ...DEFAULT_FEATURES },
          monthly_fee: 180000,
        },
        {
          id: "12",
          name: "Lira Town School",
          district: "Lira",
          ownership: "government",
          subscription_plan: "basic",
          subscription_status: "active",
          created_at: "2024-04-20",
          student_count: 657,
          staff_count: 32,
          primary_color: "#3a1f5c",
          features: { ...DEFAULT_FEATURES, health: true },
          monthly_fee: 90000,
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const { data: schoolsData } = await supabase
        .from("schools")
        .select(
          "id, name, district, ownership, subscription_plan, subscription_status, created_at, primary_color",
        )
        .order("created_at", { ascending: false })
        .limit(50);

      const { count: studentCount } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true });
      const { count: staffCount } = await supabase
        .from("staff")
        .select("*", { count: "exact", head: true });

      const activeSchools =
        schoolsData?.filter((s) => s.subscription_status === "active").length ||
        0;
      const trialSchools =
        schoolsData?.filter((s) => s.subscription_status === "trial").length ||
        0;

      setStats({
        totalSchools: schoolsData?.length || 0,
        totalStudents: studentCount || 0,
        totalStaff: staffCount || 0,
        activeSubscriptions: activeSchools,
        trialSchools,
        expiredSchools: 0,
      });

      setSchools(
        (schoolsData || []).map((s) => ({
          ...s,
          student_count: 0,
          staff_count: 0,
          features: DEFAULT_FEATURES,
          monthly_fee: 0,
        })),
      );
    } catch (err) {
      console.error("Error loading system data:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (
    schoolId: string,
    feature: keyof SchoolFeatures,
  ) => {
    setSchools(
      schools.map((s) => {
        if (s.id === schoolId) {
          return {
            ...s,
            features: { ...s.features, [feature]: !s.features[feature] },
          };
        }
        return s;
      }),
    );
  };

  const totalRevenue = schools.reduce(
    (sum, s) =>
      sum +
      (s.subscription_plan === "premium"
        ? s.monthly_fee * 2
        : s.subscription_plan === "basic"
          ? s.monthly_fee
          : 0),
    0,
  );

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
        subtitle="System-wide control center for SkoolMate OS"
      />

      <div className="flex gap-2 mb-6 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab("overview");
            setSelectedSchool(null);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
            activeTab === "overview"
              ? "bg-[var(--primary)] text-white"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-bright"
          }`}
        >
          <MaterialIcon icon="dashboard" className="inline mr-2" />
          Overview
        </button>
        <button
          onClick={() => {
            setActiveTab("schools");
            setSelectedSchool(null);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
            activeTab === "schools"
              ? "bg-[var(--primary)] text-white"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-bright"
          }`}
        >
          <MaterialIcon icon="school" className="inline mr-2" />
          Schools
        </button>
        <button
          onClick={() => {
            setActiveTab("features");
            setSelectedSchool(null);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
            activeTab === "features"
              ? "bg-[var(--primary)] text-white"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-bright"
          }`}
        >
          <MaterialIcon icon="toggle_on" className="inline mr-2" />
          Feature Toggles
        </button>
        <button
          onClick={() => {
            setActiveTab("settings");
            setSelectedSchool(null);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
            activeTab === "settings"
              ? "bg-[var(--primary)] text-white"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-bright"
          }`}
        >
          <MaterialIcon icon="settings" className="inline mr-2" />
          Global Settings
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
                <div className="text-3xl font-bold text-green-600">
                  {(totalRevenue / 1000000).toFixed(1)}M
                </div>
                <div className="text-xs text-on-surface-variant">
                  Est. Monthly
                </div>
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
                  <MaterialIcon icon="sms" />
                  Broadcast SMS
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
                    New school "Lira Town School" registered
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
                    3 schools trial expiring in 7 days
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
                    St. Mary's renewed premium - UGX 4,200,000
                  </span>
                  <span className="text-on-surface-variant ml-auto text-xs">
                    1d ago
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MaterialIcon className="text-teal-500">person</MaterialIcon>
                  <span className="text-on-surface">
                    New teacher added at Jinja College
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
            <h3 className="font-semibold text-on-surface">
              All Schools ({schools.length})
            </h3>
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
                    <th className="px-4 py-3 text-center text-xs font-medium text-on-surface-variant">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {schools.map((school) => (
                    <tr key={school.id} className="hover:bg-surface-bright">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: school.primary_color }}
                          />
                          <span className="font-medium text-on-surface">
                            {school.name}
                          </span>
                        </div>
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
                      <td className="px-4 py-3 text-center">
                        <button
                          className="p-1 hover:bg-surface-container rounded"
                          onClick={() => {
                            setSelectedSchool(school);
                            setActiveTab("features");
                          }}
                        >
                          <MaterialIcon className="text-lg">
                            settings
                          </MaterialIcon>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {(activeTab === "features" || selectedSchool) && (
        <div className="space-y-6">
          {selectedSchool && (
            <Card>
              <CardHeader className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: selectedSchool.primary_color }}
                  />
                  <h3 className="font-semibold text-on-surface">
                    {selectedSchool.name}
                  </h3>
                  <span className="text-sm text-on-surface-variant">
                    ({selectedSchool.district})
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedSchool(null)}
                >
                  Close
                </Button>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(selectedSchool.features).map(
                    ([feature, enabled]) => (
                      <button
                        key={feature}
                        onClick={() =>
                          toggleFeature(
                            selectedSchool.id,
                            feature as keyof SchoolFeatures,
                          )
                        }
                        className={`p-4 rounded-xl text-center transition-all ${
                          enabled
                            ? "bg-green-50 border-2 border-green-500"
                            : "bg-surface-container border-2 border-transparent"
                        }`}
                      >
                        <MaterialIcon
                          className={`text-2xl mb-2 ${enabled ? "text-green-600" : "text-gray-400"}`}
                        >
                          {feature === "sms"
                            ? "sms"
                            : feature === "attendance"
                              ? "how_to_reg"
                              : feature === "fees"
                                ? "payments"
                                : feature === "grades"
                                  ? "menu_book"
                                  : feature === "reports"
                                    ? "description"
                                    : feature === "parents"
                                      ? "family_restroom"
                                      : feature === "canteen"
                                        ? "restaurant"
                                        : feature === "library"
                                          ? "local_library"
                                          : feature === "transport"
                                            ? "directions_bus"
                                            : feature === "health"
                                              ? "local_hospital"
                                              : "check_circle"}
                        </MaterialIcon>
                        <div
                          className={`text-sm font-medium ${enabled ? "text-green-700" : "text-gray-500"}`}
                        >
                          {feature.charAt(0).toUpperCase() + feature.slice(1)}
                        </div>
                        <div
                          className={`text-xs mt-1 ${enabled ? "text-green-600" : "text-gray-400"}`}
                        >
                          {enabled ? "Enabled" : "Disabled"}
                        </div>
                      </button>
                    ),
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {!selectedSchool && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schools.map((school) => (
                <Card
                  key={school.id}
                  className="hover:shadow-lg transition-shadow"
                >
                  <CardHeader className="flex justify-between items-center pb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: school.primary_color }}
                      />
                      <span className="font-medium text-on-surface truncate">
                        {school.name}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        school.subscription_status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {school.subscription_status}
                    </span>
                  </CardHeader>
                  <CardBody>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {Object.entries(school.features)
                        .filter(([, v]) => v)
                        .map(([f]) => (
                          <span
                            key={f}
                            className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs"
                          >
                            {f}
                          </span>
                        ))}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-on-surface-variant">
                        {school.student_count} students
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedSchool(school)}
                      >
                        Configure
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-on-surface">
                Platform Configuration
              </h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-on-surface">Demo Mode</div>
                  <div className="text-sm text-on-surface-variant">
                    Allow demo accounts
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
                    Enable bulk SMS
                  </div>
                </div>
                <button className="w-12 h-6 bg-primary rounded-full relative">
                  <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                </button>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-on-surface">
                    Mobile Money
                  </div>
                  <div className="text-sm text-on-surface-variant">
                    Enable payments
                  </div>
                </div>
                <button className="w-12 h-6 bg-primary rounded-full relative">
                  <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                </button>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-on-surface">
                    Parent Portal
                  </div>
                  <div className="text-sm text-on-surface-variant">
                    Public access
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
              <h3 className="font-semibold text-on-surface">
                Default School Settings
              </h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  Default Primary Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value="#001F3F"
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <span className="text-sm text-on-surface-variant">
                    #001F3F (Navy)
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  Default Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value="#D4AF37"
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <span className="text-sm text-on-surface-variant">
                    #D4AF37 (Gold)
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  Support Email
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                  placeholder="support@skulmate.os"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  WhatsApp Support
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                  placeholder="+25670028703"
                />
              </div>
              <Button className="w-full">Save Global Settings</Button>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
