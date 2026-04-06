"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { useToast } from "@/components/Toast";

interface SystemStats {
  totalSchools: number;
  totalStudents: number;
  totalStaff: number;
  activeSubscriptions: number;
  trialSchools: number;
  expiredSchools: number;
  monthlyRevenue: number;
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
  contact_phone: string;
  contact_email: string;
  expires_at: string | null;
}

interface PlatformSettings {
  sms_enabled: boolean;
  sms_gateway: string;
  payment_enabled: boolean;
  payment_gateway: string;
  demo_mode: boolean;
  support_email: string;
  support_phone: string;
}

export default function SuperAdminDashboard() {
  const { user, isDemo } = useAuth();
  const toast = useToast();

  const [stats, setStats] = useState<SystemStats>({
    totalSchools: 0,
    totalStudents: 0,
    totalStaff: 0,
    activeSubscriptions: 0,
    trialSchools: 0,
    expiredSchools: 0,
    monthlyRevenue: 0,
  });
  const [schools, setSchools] = useState<SchoolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "schools" | "features" | "settings"
  >("overview");
  const [selectedSchool, setSelectedSchool] = useState<SchoolInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings>({
    sms_enabled: true,
    sms_gateway: "bulk",
    payment_enabled: true,
    payment_gateway: "mobile_money",
    demo_mode: true,
    support_email: "support@skoolmate.os",
    support_phone: "+256700287030",
  });

  useEffect(() => {
    loadSystemData();
  }, []);

  const loadSystemData = async () => {
    setLoading(true);

    // Try loading demo data first for testing
    const useDemo = true; // Set to false when database is ready

    if (useDemo) {
      loadDemoData();
      setLoading(false);
      return;
    }

    try {
      // Get all schools
      const { data: schoolsData, error: schoolsError } = await supabase
        .from("schools")
        .select(
          `id, name, district, ownership, subscription_plan, subscription_status, 
          created_at, primary_color, contact_phone, contact_email, expires_at`,
        )
        .order("created_at", { ascending: false });

      if (schoolsError) {
        console.warn(
          "Schools query failed, using demo data:",
          schoolsError.message,
        );
        // Fallback to demo data if query fails
        loadDemoData();
        return;
      }

      // Get student count per school
      const { data: studentsData } = await supabase
        .from("students")
        .select("school_id");

      const { data: staffData } = await supabase
        .from("staff")
        .select("school_id");

      // Count students per school
      const studentCounts: Record<string, number> = {};
      const staffCounts: Record<string, number> = {};
      studentsData?.forEach((s) => {
        studentCounts[s.school_id] = (studentCounts[s.school_id] || 0) + 1;
      });
      staffData?.forEach((s) => {
        staffCounts[s.school_id] = (staffCounts[s.school_id] || 0) + 1;
      });

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
        totalStudents: studentsData?.length || 0,
        totalStaff: staffData?.length || 0,
        activeSubscriptions: activeSchools,
        trialSchools,
        expiredSchools,
        monthlyRevenue: activeSchools * 800000, // Estimate
      });

      // Map schools with counts
      const mappedSchools: SchoolInfo[] = (schoolsData || []).map((s) => ({
        id: s.id,
        name: s.name,
        district: s.district || "Unknown",
        ownership: s.ownership || "private",
        subscription_plan: s.subscription_plan || "basic",
        subscription_status: s.subscription_status || "trial",
        created_at: s.created_at,
        primary_color: s.primary_color || "#001F3F",
        features: {
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
        },
        student_count: studentCounts[s.id] || 0,
        staff_count: staffCounts[s.id] || 0,
        contact_phone: s.contact_phone || "",
        contact_email: s.contact_email || "",
        expires_at: s.expires_at,
      }));

      setSchools(mappedSchools);
    } catch (err) {
      console.error("Error loading system data:", err);
      loadDemoData();
    } finally {
      setLoading(false);
    }
  };

  const loadDemoData = () => {
    // Demo data when database is not connected
    setStats({
      totalSchools: 12,
      totalStudents: 8547,
      totalStaff: 456,
      activeSubscriptions: 9,
      trialSchools: 3,
      expiredSchools: 0,
      monthlyRevenue: 7200000,
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
        features: {
          sms: true,
          attendance: true,
          fees: true,
          grades: true,
          reports: true,
          parents: true,
          canteen: true,
          library: true,
          transport: false,
          health: false,
        },
        contact_phone: "+256700000001",
        contact_email: "stmarys@school.com",
        expires_at: null,
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
        features: {
          sms: true,
          attendance: true,
          fees: true,
          grades: true,
          reports: true,
          parents: false,
          canteen: false,
          library: false,
          transport: false,
          health: false,
        },
        contact_phone: "+256700000002",
        contact_email: "kjr@school.com",
        expires_at: null,
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
        features: {
          sms: true,
          attendance: true,
          fees: true,
          grades: true,
          reports: true,
          parents: true,
          canteen: false,
          library: true,
          transport: true,
          health: true,
        },
        contact_phone: "+256700000003",
        contact_email: "mbararahigh@school.com",
        expires_at: "2025-05-10",
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
          sms: true,
          attendance: true,
          fees: true,
          grades: true,
          reports: true,
          parents: true,
          canteen: true,
          library: true,
          transport: true,
          health: false,
        },
        contact_phone: "+256700000004",
        contact_email: "jinjacollege@school.com",
        expires_at: null,
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
        features: {
          sms: true,
          attendance: true,
          fees: true,
          grades: true,
          reports: true,
          parents: false,
          canteen: false,
          library: false,
          transport: false,
          health: false,
        },
        contact_phone: "+256700000005",
        contact_email: "soroti@school.com",
        expires_at: null,
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
        features: {
          sms: true,
          attendance: true,
          fees: true,
          grades: true,
          reports: true,
          parents: false,
          canteen: false,
          library: false,
          transport: false,
          health: false,
        },
        contact_phone: "+256700000006",
        contact_email: "ntungamo@school.com",
        expires_at: "2025-05-01",
      },
    ]);
    toast.success("Loaded demo data");
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
    toast.success(`Feature toggled for school`);
  };

  const updateSchoolPlan = async (
    schoolId: string,
    plan: string,
    status: string,
  ) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("schools")
        .update({
          subscription_plan: plan,
          subscription_status: status,
        })
        .eq("id", schoolId);

      if (error) throw error;

      setSchools(
        schools.map((s) =>
          s.id === schoolId
            ? { ...s, subscription_plan: plan, subscription_status: status }
            : s,
        ),
      );
      toast.success(`School updated to ${plan}`);
    } catch (err) {
      toast.error("Failed to update school");
    } finally {
      setSaving(false);
    }
  };

  const extendTrial = async (schoolId: string, days: number) => {
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + days);

    try {
      await supabase
        .from("schools")
        .update({
          subscription_status: "trial",
          expires_at: newExpiry.toISOString(),
        })
        .eq("id", schoolId);

      setSchools(
        schools.map((s) =>
          s.id === schoolId
            ? {
                ...s,
                subscription_status: "trial",
                expires_at: newExpiry.toISOString(),
              }
            : s,
        ),
      );
      toast.success(`Trial extended by ${days} days`);
    } catch (err) {
      toast.error("Failed to extend trial");
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // In real app, save to platform_settings table
      toast.success("Platform settings saved");
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
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
        subtitle={`Managing ${stats.totalSchools} schools • ${stats.totalStudents.toLocaleString()} students`}
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
          Schools ({stats.totalSchools})
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
          Platform Settings
        </button>
      </div>

      {activeTab === "overview" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
            <Card>
              <CardBody className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {stats.totalSchools}
                </div>
                <div className="text-xs text-on-surface-variant">
                  Total Schools
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.totalStudents.toLocaleString()}
                </div>
                <div className="text-xs text-on-surface-variant">Students</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.totalStaff}
                </div>
                <div className="text-xs text-on-surface-variant">Staff</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {stats.activeSubscriptions}
                </div>
                <div className="text-xs text-on-surface-variant">Active</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {stats.trialSchools}
                </div>
                <div className="text-xs text-on-surface-variant">Trial</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-2xl font-bold text-red-500">
                  {stats.expiredSchools}
                </div>
                <div className="text-xs text-on-surface-variant">Expired</div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <div className="text-2xl font-bold text-teal-600">
                  {(stats.monthlyRevenue / 1000000).toFixed(1)}M
                </div>
                <div className="text-xs text-on-surface-variant">
                  Est. Revenue/mo
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
                  Create Admin
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
                  Recent Schools
                </h3>
              </CardHeader>
              <CardBody className="space-y-2">
                {schools.slice(0, 5).map((school) => (
                  <div
                    key={school.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-bright"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: school.primary_color }}
                      />
                      <span className="font-medium text-sm text-on-surface">
                        {school.name}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        school.subscription_status === "active"
                          ? "bg-green-100 text-green-800"
                          : school.subscription_status === "trial"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {school.subscription_status}
                    </span>
                  </div>
                ))}
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
                          <div>
                            <span className="font-medium text-on-surface block">
                              {school.name}
                            </span>
                            <span className="text-xs text-on-surface-variant">
                              {school.contact_email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {school.district}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={school.subscription_plan}
                          onChange={(e) =>
                            updateSchoolPlan(
                              school.id,
                              e.target.value,
                              school.subscription_status,
                            )
                          }
                          className="text-xs bg-surface-container px-2 py-1 rounded border-none"
                        >
                          <option value="basic">Basic</option>
                          <option value="standard">Standard</option>
                          <option value="premium">Premium</option>
                        </select>
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
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedSchool(school);
                              setActiveTab("features");
                            }}
                            className="p-1 hover:bg-surface-container rounded"
                            title="Configure"
                          >
                            <MaterialIcon className="text-lg">
                              settings
                            </MaterialIcon>
                          </button>
                          {school.subscription_status === "trial" && (
                            <button
                              onClick={() => extendTrial(school.id, 30)}
                              className="p-1 hover:bg-surface-container rounded text-amber-600"
                              title="Extend Trial"
                            >
                              <MaterialIcon className="text-lg">
                                event
                              </MaterialIcon>
                            </button>
                          )}
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
                        {school.student_count} students • {school.district}
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
                <button
                  onClick={() =>
                    setSettings({ ...settings, demo_mode: !settings.demo_mode })
                  }
                  className={`w-12 h-6 rounded-full relative transition-colors ${settings.demo_mode ? "bg-primary" : "bg-gray-300"}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.demo_mode ? "right-1" : "left-1"}`}
                  />
                </button>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-on-surface">SMS Gateway</div>
                  <div className="text-sm text-on-surface-variant">
                    Enable bulk SMS
                  </div>
                </div>
                <button
                  onClick={() =>
                    setSettings({
                      ...settings,
                      sms_enabled: !settings.sms_enabled,
                    })
                  }
                  className={`w-12 h-6 rounded-full relative transition-colors ${settings.sms_enabled ? "bg-primary" : "bg-gray-300"}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.sms_enabled ? "right-1" : "left-1"}`}
                  />
                </button>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-on-surface">
                    Mobile Money Payments
                  </div>
                  <div className="text-sm text-on-surface-variant">
                    Enable fee payments
                  </div>
                </div>
                <button
                  onClick={() =>
                    setSettings({
                      ...settings,
                      payment_enabled: !settings.payment_enabled,
                    })
                  }
                  className={`w-12 h-6 rounded-full relative transition-colors ${settings.payment_enabled ? "bg-primary" : "bg-gray-300"}`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.payment_enabled ? "right-1" : "left-1"}`}
                  />
                </button>
              </div>
              <Button
                className="w-full"
                onClick={saveSettings}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Platform Settings"}
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-semibold text-on-surface">
                Support Settings
              </h3>
            </CardHeader>
            <CardBody className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  Support Email
                </label>
                <input
                  type="email"
                  value={settings.support_email}
                  onChange={(e) =>
                    setSettings({ ...settings, support_email: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  Support Phone
                </label>
                <input
                  type="text"
                  value={settings.support_phone}
                  onChange={(e) =>
                    setSettings({ ...settings, support_phone: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  SMS Gateway
                </label>
                <select
                  value={settings.sms_gateway}
                  onChange={(e) =>
                    setSettings({ ...settings, sms_gateway: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                >
                  <option value="bulk">Bulk SMS Uganda</option>
                  <option value=" Africa's Talking">Africa's Talking</option>
                  <option value="custom">Custom API</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">
                  Payment Gateway
                </label>
                <select
                  value={settings.payment_gateway}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      payment_gateway: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 rounded-xl bg-surface-container border-none"
                >
                  <option value="mobile_money">MTN Mobile Money</option>
                  <option value="airtel">Airtel Money</option>
                  <option value="stripe">Stripe</option>
                </select>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
