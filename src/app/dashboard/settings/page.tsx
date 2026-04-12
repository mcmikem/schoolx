"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";
import {
  FEATURE_STAGES,
  FeatureStage,
  DEFAULT_FEATURE_STAGE,
  canUseModule,
  ModuleKey,
} from "@/lib/featureStages";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { useClasses } from "@/lib/hooks";
import SetupChecklist from "@/components/onboarding/SetupChecklist";

const ROLE_OPTIONS: {
  value: UserRole;
  description: string;
  modules: ModuleKey[];
}[] = [
  {
    value: "teacher",
    description:
      "Attendance, grades, homework, lesson plans and classroom communication.",
    modules: ["attendance", "marks", "communications"],
  },
  {
    value: "school_admin",
    description:
      "Oversee operations, exports, dashboards, and general settings.",
    modules: ["operations", "exports", "reports"],
  },
  {
    value: "dean_of_studies",
    description: "Academic oversight, grading, exams, and report card views.",
    modules: ["marks", "exam", "reports"],
  },
  {
    value: "bursar",
    description:
      "Finance, invoicing, payroll, budgeting, and payment tracking.",
    modules: ["finance", "exports"],
  },
  {
    value: "secretary",
    description: "Communications, visits, notices and calendar management.",
    modules: ["communications", "operations"],
  },
];

const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  attendance: "Attendance",
  marks: "Marks & Exams",
  exam: "Exams",
  communications: "Communication",
  finance: "Finance",
  reports: "Reports",
  exports: "Exports",
  staff: "Staff",
  operations: "Operations",
  parentPortal: "Parent Portal",
  dorm: "Dorm",
  health: "Health",
  analytics: "Analytics",
};

import MaterialIcon from "@/components/MaterialIcon";
import GeneralSettings from "@/components/settings/GeneralSettings";
import AcademicSettings from "@/components/settings/AcademicSettings";

interface SchoolSettings {
  sms_notifications: boolean;
  attendance_alerts: boolean;
  fee_reminders: boolean;
  attendance_threshold: number;
  grade_threshold: number;
  fee_threshold: number;
}

export default function SettingsPage() {
  const { school, user, refreshSchool } = useAuth();
  const toast = useToast();
  const { classes, loading: loadingClasses } = useClasses(school?.id);
  const [activeTab, setActiveTab] = useState("general");
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<
    Array<{
      id: string;
      full_name: string;
      phone: string;
      role: string;
      is_active: boolean;
    }>
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: "",
    phone: "",
    role: "teacher" as UserRole,
    password: "",
  });
  const [settings, setSettings] = useState<SchoolSettings>({
    sms_notifications: true,
    attendance_alerts: true,
    fee_reminders: false,
    attendance_threshold: 80,
    grade_threshold: 50,
    fee_threshold: 50000,
  });
  const [schoolData, setSchoolData] = useState({
    name: school?.name || "",
    district: school?.district || "",
    subcounty: "",
    phone: "",
    email: "",
  });
  const [logoUrl, setLogoUrl] = useState(school?.logo_url || "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [storageStatus, setStorageStatus] = useState<
    "unknown" | "ok" | "error"
  >("unknown");
  const [selectedPlan, setSelectedPlan] = useState<string>(
    school?.subscription_plan || "starter",
  );
  const [upgradingPlan, setUpgradingPlan] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<string>("");
  const searchParams = useSearchParams();
  const [selectedStage, setSelectedStage] = useState<FeatureStage>(
    (school?.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE,
  );
  const [savingStage, setSavingStage] = useState(false);
  const [schoolConfig, setSchoolConfig] = useState({
    student_id_format: (school as any)?.student_id_format || "STU{YYYY}{####}",
    has_boarding: (school as any)?.has_boarding || false,
    has_houses: (school as any)?.has_houses || false,
    has_student_council: (school as any)?.has_student_council || false,
    has_prefects: (school as any)?.has_prefects || false,
    location_type: (school as any)?.location_type || "urban",
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [houses, setHouses] = useState<any[]>([]);
  const [loadingHouses, setLoadingHouses] = useState(false);
  const [showAddHouse, setShowAddHouse] = useState(false);
  const [showAddClass, setShowAddClass] = useState(false);
  const [newHouse, setNewHouse] = useState({
    name: "",
    color: "#3b82f6",
    motto: "",
  });
  const [newClass, setNewClass] = useState({ name: "", stream: "" });
  const sc = school as any;
  const selectedRoleOption = ROLE_OPTIONS.find(
    (option) => option.value === newUser.role,
  );
  const missingModules =
    selectedRoleOption?.modules.filter(
      (module) => !canUseModule(selectedStage, module),
    ) || [];
  const missingModuleLabels = missingModules.map(
    (module) => MODULE_LABELS[module],
  );

  const fetchSettings = useCallback(async () => {
    if (!school?.id) return;
    try {
      const { data } = await supabase
        .from("school_settings")
        .select("key, value")
        .eq("school_id", school.id);

      if (data) {
        const settingsMap: Record<string, string> = {};
        data.forEach((s: { key: string; value: string }) => {
          settingsMap[s.key] = s.value;
        });
        setSettings((prev) => ({
          ...prev,
          sms_notifications: settingsMap.sms_notifications !== "false",
          attendance_alerts: settingsMap.attendance_alerts !== "false",
          fee_reminders: settingsMap.fee_reminders === "true",
          attendance_threshold:
            parseInt(settingsMap.attendance_threshold) || 80,
          grade_threshold: parseInt(settingsMap.grade_threshold) || 50,
          fee_threshold: parseInt(settingsMap.fee_threshold) || 50000,
        }));
      }

      // Fetch school logo
      const { data: schoolData } = await supabase
        .from("schools")
        .select("logo_url")
        .eq("id", school.id)
        .single();

      if (schoolData?.logo_url) {
        setLogoUrl(schoolData.logo_url);
      }
    } catch (err) {
      console.error("Error:", err);
    }
  }, [school?.id]);

  useEffect(() => {
    if (school?.feature_stage) {
      setSelectedStage(school.feature_stage as FeatureStage);
    }
  }, [school?.feature_stage]);

  useEffect(() => {
    if (school?.id) {
      fetchSettings();
    }
  }, [school?.id, fetchSettings]);

  useEffect(() => {
    const plan = searchParams?.get("plan");
    const error = searchParams?.get("error");
    if (plan) {
      setSelectedPaymentPlan(plan);
      setShowPaymentModal(true);
    }
    if (error === "no_plan") {
      toast.error("Please select a plan to upgrade");
    }
  }, [searchParams, toast]);

  const saveSettings = async (key: string, value: string) => {
    if (!school?.id) return;
    try {
      await supabase
        .from("school_settings")
        .upsert(
          { school_id: school.id, key, value },
          { onConflict: "school_id,key" },
        );
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const handleSettingChange = async (
    key: keyof SchoolSettings,
    value: boolean | number,
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    await saveSettings(key, String(value));
  };

  const handlePlanUpgrade = async (plan: string) => {
    if (!school?.id) return;

    // For free plans, just switch directly
    if (plan === "starter" || plan === "free_trial") {
      setUpgradingPlan(true);
      try {
        const { error } = await supabase
          .from("schools")
          .update({
            subscription_plan: plan,
            subscription_status: "trial",
          })
          .eq("id", school.id);

        if (error) throw error;

        await refreshSchool();
        toast.success(`Successfully switched to ${plan.toUpperCase()} plan!`);
      } catch (err: any) {
        console.error("Plan upgrade error:", err);
        toast.error(err.message || "Failed to update plan. Please try again.");
      } finally {
        setUpgradingPlan(false);
      }
      return;
    }

    // For paid plans, show payment modal
    setSelectedPaymentPlan(plan);
    setShowPaymentModal(true);
  };

  const initiatePayment = async (provider: "mtn" | "airtel" | "paypal") => {
    if (!school?.id || !selectedPaymentPlan) return;

    setUpgradingPlan(true);
    try {
      let paymentData: {
        url?: string;
        link?: string;
        txRef?: string;
        error?: string;
      };

      if (provider === "mtn" || provider === "airtel") {
        const phone = prompt(
          `Enter your ${provider === "mtn" ? "MTN" : "Airtel"} phone number (e.g., 0772000000):`,
        );
        if (!phone) {
          setUpgradingPlan(false);
          return;
        }

        const response = await fetch("/api/payment/mobile-money", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider,
            plan: selectedPaymentPlan,
            phoneNumber: phone,
          }),
        });

        const result = await response.json();
        if (!response.ok || result.error) {
          throw new Error(result.error || "Payment failed");
        }

        paymentData = result;

        if (result.paymentLink) {
          window.location.href = result.paymentLink;
        }
      } else {
        // PayPal
        const response = await fetch("/api/payment/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "paypal",
            plan: selectedPaymentPlan,
          }),
        });

        const result = await response.json();
        if (!response.ok || result.error) {
          throw new Error(result.error || "Payment failed");
        }

        paymentData = result;

        if (result.url) {
          window.location.href = result.url;
        }
      }

      setShowPaymentModal(false);
      toast.success("Redirecting to payment...");
    } catch (err: any) {
      console.error("Payment error:", err);
      toast.error(err.message || "Failed to initiate payment");
    } finally {
      setUpgradingPlan(false);
    }
  };

  const exportAllData = async () => {
    if (!school?.id) return;
    try {
      toast.success("Preparing export...");

      const tables = [
        "students",
        "classes",
        "subjects",
        "attendance",
        "grades",
        "fee_structure",
        "fee_payments",
        "users",
      ];
      const allData: Record<string, unknown[]> = {};

      for (const table of tables) {
        const { data } = await supabase
          .from(table)
          .select("*")
          .eq("school_id", school.id);
        if (data) allData[table] = data;
      }

      const blob = new Blob([JSON.stringify(allData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skoolmate_backup_${school.name}_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully");
    } catch (err) {
      toast.error("Export failed");
    }
  };

  const exportStudentPhotos = async () => {
    if (!school?.id) return;

    try {
      toast.success("Preparing student photo backup...");
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("school_id", school.id);

      if (error) throw error;

      const photoManifest = (data || [])
        .map((student: Record<string, unknown>) => ({
          id: student.id,
          student_number: student.student_number,
          first_name: student.first_name,
          last_name: student.last_name,
          photo_url: student.photo_url || null,
        }))
        .filter((student) => Boolean(student.photo_url));

      const blob = new Blob([JSON.stringify(photoManifest, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skoolmate_photos_${school.name}_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(
        photoManifest.length > 0
          ? `Exported photo manifest for ${photoManifest.length} student(s)`
          : "No student photos were found, but an empty manifest was exported",
      );
    } catch (err) {
      console.error(err);
      toast.error("Photo export failed");
    }
  };

  useEffect(() => {
    if (school) {
      setSchoolData((prev) => ({
        ...prev,
        name: school.name || "",
        district: school.district || "",
      }));
    }
  }, [school]);

  const fetchUsers = useCallback(async () => {
    if (!school?.id) return;
    try {
      setLoadingUsers(true);
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoadingUsers(false);
    }
  }, [school?.id]);

  const fetchHouses = useCallback(async () => {
    if (!school?.id) return;
    try {
      setLoadingHouses(true);
      const { data } = await supabase
        .from("houses")
        .select("*")
        .eq("school_id", school.id)
        .order("name");
      setHouses(data || []);
    } catch {
      setHouses([]);
    } finally {
      setLoadingHouses(false);
    }
  }, [school?.id]);

  useEffect(() => {
    if (activeTab === "config" && school?.id) {
      fetchHouses();
    }
  }, [activeTab, school?.id, fetchHouses]);

  const saveSchoolConfig = async () => {
    if (!school?.id) return;
    try {
      setSavingConfig(true);
      const { error } = await supabase
        .from("schools")
        .update({
          student_id_format: schoolConfig.student_id_format,
          has_boarding: schoolConfig.has_boarding,
          has_houses: schoolConfig.has_houses,
          has_student_council: schoolConfig.has_student_council,
          has_prefects: schoolConfig.has_prefects,
          location_type: schoolConfig.location_type,
        })
        .eq("id", school.id);
      if (error) throw error;
      toast.success("School configuration saved");
      await refreshSchool();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSavingConfig(false);
    }
  };

  const addHouse = async () => {
    if (!school?.id || !newHouse.name) return;
    try {
      const { error } = await supabase.from("houses").insert({
        school_id: school.id,
        name: newHouse.name,
        color: newHouse.color,
        motto: newHouse.motto || null,
      });
      if (error) throw error;
      toast.success("House added");
      setShowAddHouse(false);
      setNewHouse({ name: "", color: "#3b82f6", motto: "" });
      fetchHouses();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    }
  };

  const deleteHouse = async (id: string) => {
    try {
      await supabase.from("houses").delete().eq("id", id);
      toast.success("House deleted");
      fetchHouses();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleAddClass = async () => {
    if (!school?.id || !newClass.name) return;
    try {
      const { error } = await supabase.from("classes").insert({
        school_id: school.id,
        name: newClass.name,
        stream: newClass.stream || null,
        level: parseInt(newClass.name.replace(/[^0-9]/g, "")) || 1,
        academic_year: new Date().getFullYear().toString(),
      });
      if (error) throw error;
      toast.success("Class added");
      setShowAddClass(false);
      setNewClass({ name: "", stream: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to add class");
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (
      !confirm(
        "Delete this class? All students in this class will need to be reassigned.",
      )
    )
      return;
    try {
      await supabase.from("classes").delete().eq("id", id);
      toast.success("Class deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete class");
    }
  };

  useEffect(() => {
    if (activeTab === "users" && school?.id) {
      fetchUsers();
    }
  }, [activeTab, school?.id, fetchUsers]);

  const saveSchoolSettings = async () => {
    if (!school?.id) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("schools")
        .update({
          name: schoolData.name,
          district: schoolData.district,
          phone: schoolData.phone || null,
          email: schoolData.email || null,
        })
        .eq("id", school.id);
      if (error) throw error;
      toast.success("Settings saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ is_active: !currentStatus })
        .eq("id", id);
      if (error) throw error;
      setUsers(
        users.map((u) =>
          u.id === id ? { ...u, is_active: !currentStatus } : u,
        ),
      );
      toast.success(currentStatus ? "User deactivated" : "User activated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id) return;
    try {
      const normalizedPhone = newUser.phone.replace(/[^0-9]/g, "");

      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: school.id,
          fullName: newUser.full_name,
          phone: normalizedPhone,
          password: newUser.password,
          role: newUser.role,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to add user");
      }

      toast.success("User added successfully");
      setShowAddUser(false);
      setNewUser({ full_name: "", phone: "", role: "teacher", password: "" });
      fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add user");
    }
  };

  const tabs = [
    { id: "general", label: "School Details" },
    { id: "config", label: "School Config", badge: "New" },
    { id: "users", label: "Staff & Users" },
    { id: "notifications", label: "Notifications" },
    { id: "checklist", label: "Setup Checklist", badge: "Important" },
    { id: "backup", label: "Backup & Export" },
    { id: "subscription", label: "Billing & Plans", badge: "Active" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Settings" subtitle="Manage your school settings" />

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      <TabPanel activeTab={activeTab} tabId="general">
        <div className="space-y-6">
          <GeneralSettings
            schoolData={schoolData}
            setSchoolData={setSchoolData}
            logoUrl={logoUrl}
            setLogoUrl={setLogoUrl}
            uploadingLogo={uploadingLogo}
            setUploadingLogo={setUploadingLogo}
            storageStatus={storageStatus}
            setStorageStatus={setStorageStatus}
            saving={saving}
            selectedStage={selectedStage}
            setSelectedStage={setSelectedStage}
            savingStage={savingStage}
            refreshSchool={refreshSchool}
          />
          <AcademicSettings />
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="config">
        <div className="space-y-6">
          {/* School Type */}
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-[var(--on-surface)] mb-4">
                School Type
              </h2>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {(["urban", "peri_urban", "rural"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() =>
                      setSchoolConfig({ ...schoolConfig, location_type: type })
                    }
                    className={`p-4 rounded-xl border-2 text-center transition-all ${schoolConfig.location_type === type ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div className="font-medium capitalize">
                      {type.replace("_", " ")}
                    </div>
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {[
                  {
                    key: "has_boarding",
                    label: "Boarding School",
                    desc: "Students stay overnight",
                  },
                  {
                    key: "has_houses",
                    label: "House System",
                    desc: "Students belong to colored houses (e.g., Nile, Victoria)",
                  },
                  {
                    key: "has_student_council",
                    label: "Student Council",
                    desc: "President, VP, Secretary, etc.",
                  },
                  {
                    key: "has_prefects",
                    label: "Prefects",
                    desc: "Head Boy, Head Girl, Sports Prefect, etc.",
                  },
                ].map(({ key, label, desc }) => (
                  <label
                    key={key}
                    className="flex items-center justify-between p-3 bg-[var(--surface-container)] rounded-xl cursor-pointer"
                  >
                    <div>
                      <div className="font-medium text-[var(--on-surface)]">
                        {label}
                      </div>
                      <div className="text-xs text-[var(--t3)]">{desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={(schoolConfig as any)[key]}
                      onChange={(e) =>
                        setSchoolConfig({
                          ...schoolConfig,
                          [key]: e.target.checked,
                        })
                      }
                      className="w-5 h-5 rounded border-[var(--border)] text-[var(--primary)]"
                    />
                  </label>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Student ID Format */}
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-[var(--on-surface)] mb-2">
                Student ID Format
              </h2>
              <p className="text-sm text-[var(--t3)] mb-4">
                Customize how student numbers are generated. Tokens:{" "}
                <code className="bg-[var(--surface-container)] px-1.5 py-0.5 rounded text-xs">{`{YYYY}`}</code>{" "}
                = year,{" "}
                <code className="bg-[var(--surface-container)] px-1.5 py-0.5 rounded text-xs">{`{####}`}</code>{" "}
                = sequential number,{" "}
                <code className="bg-[var(--surface-container)] px-1.5 py-0.5 rounded text-xs">{`{CLASS}`}</code>{" "}
                = class code,{" "}
                <code className="bg-[var(--surface-container)] px-1.5 py-0.5 rounded text-xs">{`{GENDER}`}</code>{" "}
                = M/F
              </p>
              <input
                type="text"
                value={schoolConfig.student_id_format}
                onChange={(e) =>
                  setSchoolConfig({
                    ...schoolConfig,
                    student_id_format: e.target.value,
                  })
                }
                className="input mb-2"
                placeholder="STU{YYYY}{####}"
              />
              <div className="text-xs text-[var(--t3)]">
                Example:{" "}
                <code className="bg-[var(--surface-container)] px-1.5 py-0.5 rounded">
                  {schoolConfig.student_id_format
                    .replace("{YYYY}", "2026")
                    .replace("{####}", "0001")
                    .replace("{CLASS}", "P7")
                    .replace("{GENDER}", "M")}
                </code>
              </div>
            </CardBody>
          </Card>

          {/* Houses */}
          {schoolConfig.has_houses && (
            <Card>
              <CardBody>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                    Houses
                  </h2>
                  <Button size="sm" onClick={() => setShowAddHouse(true)}>
                    <MaterialIcon icon="add" className="text-sm" /> Add House
                  </Button>
                </div>
                {loadingHouses ? (
                  <div className="text-sm text-[var(--t3)]">
                    Loading houses...
                  </div>
                ) : houses.length === 0 ? (
                  <div className="text-sm text-[var(--t3)]">
                    No houses configured yet
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {houses.map((house) => (
                      <div
                        key={house.id}
                        className="p-4 rounded-xl border-2 text-center"
                        style={{ borderColor: house.color }}
                      >
                        <div
                          className="w-10 h-10 rounded-full mx-auto mb-2"
                          style={{ backgroundColor: house.color }}
                        />
                        <div className="font-semibold text-sm">
                          {house.name}
                        </div>
                        {house.motto && (
                          <div className="text-xs text-[var(--t3)] italic mt-0.5">
                            {house.motto}
                          </div>
                        )}
                        <button
                          onClick={() => deleteHouse(house.id)}
                          className="text-xs text-red-500 mt-2 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          <div className="flex justify-end">
            <Button
              onClick={saveSchoolConfig}
              disabled={savingConfig}
              variant="primary"
            >
              <MaterialIcon icon="save" className="text-sm" />
              {savingConfig ? "Saving..." : "Save Configuration"}
            </Button>
          </div>

          {/* Class Management */}
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-[var(--on-surface)] mb-4">
                Class Teachers
              </h2>
              <p className="text-sm text-[var(--t3)] mb-4">
                Assign class teachers to each class. Class teachers manage
                attendance, behavior, and communicate with parents.
              </p>
              {loadingClasses ? (
                <div className="text-sm text-[var(--t3)]">
                  Loading classes...
                </div>
              ) : (
                <div className="space-y-2">
                  {classes.slice(0, 10).map((cls: any) => (
                    <div
                      key={cls.id}
                      className="flex items-center justify-between p-3 bg-[var(--surface-container)] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-[var(--on-surface)]">
                          {cls.name}
                          {cls.stream ? ` ${cls.stream}` : ""}
                        </span>
                        {cls.class_teacher_id && (
                          <span className="text-xs text-[var(--t3)]">
                            Teacher assigned
                          </span>
                        )}
                      </div>
                      <select
                        value={cls.class_teacher_id || ""}
                        onChange={async (e) => {
                          try {
                            await supabase
                              .from("classes")
                              .update({
                                class_teacher_id: e.target.value || null,
                              })
                              .eq("id", cls.id);
                          } catch (err) {
                            console.error(
                              "Failed to update class teacher:",
                              err,
                            );
                          }
                        }}
                        className="input text-sm"
                        style={{ width: "auto", minWidth: "150px" }}
                      >
                        <option value="">No teacher</option>
                        {users
                          .filter((s: any) => s.role === "teacher")
                          .map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.full_name}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                  {classes.length > 10 && (
                    <div className="text-sm text-[var(--t3)]">
                      + {classes.length - 10} more classes
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Class List Management */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                  Manage Classes
                </h2>
                <Button size="sm" onClick={() => setShowAddClass(true)}>
                  <MaterialIcon icon="add" className="text-sm" />
                  Add Class
                </Button>
              </div>
              <p className="text-sm text-[var(--t3)] mb-4">
                Add or remove classes. Use streams (A, B, C) if your school has
                multiple classes per level.
              </p>
              {loadingClasses ? (
                <div className="text-sm text-[var(--t3)]">Loading...</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {classes.map((cls: any) => (
                    <div
                      key={cls.id}
                      className="flex items-center justify-between p-3 bg-[var(--surface-container)] rounded-lg border border-[var(--border)]"
                    >
                      <span className="font-medium text-[var(--on-surface)]">
                        {cls.name}
                        {cls.stream ? ` ${cls.stream}` : ""}
                      </span>
                      <button
                        onClick={() => handleDeleteClass(cls.id)}
                        className="text-[var(--t3)] hover:text-red-500 p-1"
                        title="Delete class"
                      >
                        <MaterialIcon icon="delete" className="text-sm" />
                      </button>
                    </div>
                  ))}
                  {classes.length === 0 && (
                    <div className="col-span-full text-sm text-[var(--t3)] text-center py-4">
                      No classes yet. Add your first class above.
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="users">
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddUser(true)}>
              <MaterialIcon icon="person_add" className="text-lg" />
              Add User
            </Button>
          </div>

          {loadingUsers ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardBody>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[var(--surface-container)] rounded-full" />
                      <div className="flex-1">
                        <div className="w-32 h-4 bg-[var(--border)] rounded mb-2" />
                        <div className="w-24 h-3 bg-[var(--border)] rounded" />
                      </div>
                    </div>

                    {/* Payment Modal */}
                    {showPaymentModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-[var(--on-surface)]">
                              Complete Payment
                            </h3>
                            <button
                              onClick={() => setShowPaymentModal(false)}
                              className="text-[var(--t3)] hover:text-[var(--on-surface)]"
                            >
                              <MaterialIcon icon="close" />
                            </button>
                          </div>

                          <div className="mb-6">
                            <p className="text-[var(--t3)] mb-2">
                              You selected{" "}
                              <strong>
                                {selectedPaymentPlan?.toUpperCase()}
                              </strong>{" "}
                              plan
                            </p>
                            <p className="text-sm text-[var(--t3)]">
                              Choose your payment method:
                            </p>
                          </div>

                          <div className="space-y-3">
                            <button
                              onClick={() => initiatePayment("mtn")}
                              disabled={upgradingPlan}
                              className="w-full p-4 rounded-xl border-2 border-yellow-400 bg-yellow-50 hover:bg-yellow-100 flex items-center gap-3 transition-colors"
                            >
                              <span className="text-2xl">🟡</span>
                              <div className="text-left">
                                <div className="font-semibold text-[var(--on-surface)]">
                                  MTN Mobile Money
                                </div>
                                <div className="text-xs text-[var(--t3)]">
                                  Instant payment via MoMo
                                </div>
                              </div>
                            </button>

                            <button
                              onClick={() => initiatePayment("airtel")}
                              disabled={upgradingPlan}
                              className="w-full p-4 rounded-xl border-2 border-red-400 bg-red-50 hover:bg-red-100 flex items-center gap-3 transition-colors"
                            >
                              <span className="text-2xl">🔴</span>
                              <div className="text-left">
                                <div className="font-semibold text-[var(--on-surface)]">
                                  Airtel Money
                                </div>
                                <div className="text-xs text-[var(--t3)]">
                                  Instant payment via Airtel
                                </div>
                              </div>
                            </button>

                            <button
                              onClick={() => initiatePayment("paypal")}
                              disabled={upgradingPlan}
                              className="w-full p-4 rounded-xl border-2 border-blue-500 bg-blue-50 hover:bg-blue-100 flex items-center gap-3 transition-colors"
                            >
                              <span className="text-2xl">💳</span>
                              <div className="text-left">
                                <div className="font-semibold text-[var(--on-surface)]">
                                  PayPal
                                </div>
                                <div className="text-xs text-[var(--t3)]">
                                  International cards accepted
                                </div>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <Card key={u.id}>
                  <CardBody>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[var(--surface-container)] rounded-full flex items-center justify-center">
                          <span className="text-[var(--primary)] font-semibold">
                            {u.full_name?.charAt(0) || "U"}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-[var(--on-surface)]">
                            {u.full_name}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-1 rounded-lg text-xs font-medium bg-[var(--green-soft)] text-[var(--green)]">
                              {u.role === "dos"
                                ? "Director of Studies"
                                : u.role === "school_admin"
                                  ? "Administrator"
                                  : u.role === "bursar"
                                    ? "Bursar"
                                    : u.role.charAt(0).toUpperCase() +
                                      u.role.slice(1)}
                            </span>
                            <span
                              className={`px-2 py-1 rounded-lg text-xs font-medium ${u.is_active ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[var(--red-soft)] text-[var(--red)]"}`}
                            >
                              {u.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={u.is_active ? "secondary" : "primary"}
                        onClick={() => toggleUserStatus(u.id, u.is_active)}
                      >
                        {u.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="notifications">
        <div className="space-y-6">
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-[var(--on-surface)] mb-6">
                Notification Settings
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-[var(--border)]">
                  <div>
                    <div className="font-medium text-[var(--on-surface)]">
                      SMS Notifications
                    </div>
                    <div className="text-sm text-[var(--t3)]">
                      Send SMS to parents for fee reminders
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.sms_notifications}
                      onChange={(e) =>
                        handleSettingChange(
                          "sms_notifications",
                          e.target.checked,
                        )
                      }
                    />
                    <div className="w-11 h-6 bg-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-[var(--border)]">
                  <div>
                    <div className="font-medium text-[var(--on-surface)]">
                      Attendance Alerts
                    </div>
                    <div className="text-sm text-[var(--t3)]">
                      Notify when student is absent
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.attendance_alerts}
                      onChange={(e) =>
                        handleSettingChange(
                          "attendance_alerts",
                          e.target.checked,
                        )
                      }
                    />
                    <div className="w-11 h-6 bg-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium text-[var(--on-surface)]">
                      Fee Reminders
                    </div>
                    <div className="text-sm text-[var(--t3)]">
                      Send automatic fee balance reminders
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.fee_reminders}
                      onChange={(e) =>
                        handleSettingChange("fee_reminders", e.target.checked)
                      }
                    />
                    <div className="w-11 h-6 bg-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary)]"></div>
                  </label>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-[var(--on-surface)] mb-6">
                Warning Thresholds
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    Attendance Rate Threshold (%)
                  </label>
                  <p className="text-sm text-[var(--t3)] mb-2">
                    Students below this attendance rate will be flagged
                  </p>
                  <input
                    type="number"
                    value={settings.attendance_threshold}
                    onChange={(e) =>
                      handleSettingChange(
                        "attendance_threshold",
                        parseInt(e.target.value) || 80,
                      )
                    }
                    className="w-32 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                    min={0}
                    max={100}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    Grade Threshold (%)
                  </label>
                  <p className="text-sm text-[var(--t3)] mb-2">
                    Students scoring below this in 2+ subjects will be flagged
                  </p>
                  <input
                    type="number"
                    value={settings.grade_threshold}
                    onChange={(e) =>
                      handleSettingChange(
                        "grade_threshold",
                        parseInt(e.target.value) || 50,
                      )
                    }
                    className="w-32 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                    min={0}
                    max={100}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    Fee Threshold (UGX)
                  </label>
                  <p className="text-sm text-[var(--t3)] mb-2">
                    Students with payments below this amount will be flagged
                  </p>
                  <input
                    type="number"
                    value={settings.fee_threshold}
                    onChange={(e) =>
                      handleSettingChange(
                        "fee_threshold",
                        parseInt(e.target.value) || 50000,
                      )
                    }
                    className="w-32 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                    min={0}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="subscription">
        <div className="space-y-6">
          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                    SkoolMate Subscription
                  </h2>
                  <p className="text-sm text-[var(--t3)]">
                    Your account is currently active
                  </p>
                </div>
                <div className="px-4 py-2 bg-[var(--green-soft)] text-[var(--green)] rounded-full text-sm font-semibold">
                  PREMIUM PLAN
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-container-low)]">
                  <div className="text-sm font-bold text-[var(--t3)] uppercase tracking-wider mb-2">
                    Starter
                  </div>
                  <div className="text-2xl font-bold mb-4">
                    UGX 250k{" "}
                    <span className="text-sm font-normal text-[var(--t3)]">
                      / term
                    </span>
                  </div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-2 text-sm">
                      <MaterialIcon
                        icon="check_circle"
                        className="text-[var(--green)] text-base"
                      />{" "}
                      Up to 100 Students
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <MaterialIcon
                        icon="check_circle"
                        className="text-[var(--green)] text-base"
                      />{" "}
                      Basic Attendance
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <MaterialIcon
                        icon="check_circle"
                        className="text-[var(--green)] text-base"
                      />{" "}
                      Fee Management
                    </li>
                  </ul>
                  <Button
                    variant="secondary"
                    className="w-full"
                    loading={upgradingPlan && selectedPlan === "starter"}
                    onClick={() => handlePlanUpgrade("starter")}
                  >
                    Active
                  </Button>
                </div>

                <div className="p-6 rounded-2xl border-2 border-[var(--primary)] bg-[var(--primary-soft)] relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[var(--primary)] text-white text-[10px] font-bold rounded-full uppercase">
                    Most Popular
                  </div>
                  <div className="text-sm font-bold text-[var(--primary)] uppercase tracking-wider mb-2">
                    Growth
                  </div>
                  <div className="text-2xl font-bold mb-4">
                    UGX 3,500{" "}
                    <span className="text-sm font-normal text-[var(--t3)]">
                      / month
                    </span>
                  </div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-2 text-sm">
                      <MaterialIcon
                        icon="check_circle"
                        className="text-[var(--green)] text-base"
                      />{" "}
                      Up to 500 Students
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <MaterialIcon
                        icon="check_circle"
                        className="text-[var(--green)] text-base"
                      />{" "}
                      SMS Notifications
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <MaterialIcon
                        icon="check_circle"
                        className="text-[var(--green)] text-base"
                      />{" "}
                      Report Card Printing
                    </li>
                  </ul>
                  <Button
                    className="w-full"
                    loading={upgradingPlan && selectedPlan === "growth"}
                    onClick={() => handlePlanUpgrade("growth")}
                  >
                    {school?.subscription_plan === "growth"
                      ? "Current Plan"
                      : "Select"}
                  </Button>
                </div>

                <div className="p-6 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-container-low)]">
                  <div className="text-sm font-bold text-[var(--t3)] uppercase tracking-wider mb-2">
                    Enterprise
                  </div>
                  <div className="text-2xl font-bold mb-4">
                    UGX 5,500{" "}
                    <span className="text-sm font-normal text-[var(--t3)]">
                      / month
                    </span>
                  </div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-2 text-sm">
                      <MaterialIcon
                        icon="check_circle"
                        className="text-[var(--green)] text-base"
                      />{" "}
                      Unlimited Students
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <MaterialIcon
                        icon="check_circle"
                        className="text-[var(--green)] text-base"
                      />{" "}
                      AI Smart Advisor
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <MaterialIcon
                        icon="check_circle"
                        className="text-[var(--green)] text-base"
                      />{" "}
                      Full Payroll & Assets
                    </li>
                  </ul>
                  <Button
                    variant="secondary"
                    className="w-full"
                    loading={upgradingPlan && selectedPlan === "enterprise"}
                    onClick={() => handlePlanUpgrade("enterprise")}
                  >
                    {school?.subscription_plan === "enterprise"
                      ? "Current Plan"
                      : "Upgrade"}
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold mb-4 text-[var(--on-surface)]">
                Why Upgrade to Premium?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex gap-4 p-4 rounded-xl bg-[var(--surface-container)]">
                  <div className="w-10 h-10 rounded-full bg-[var(--primary-soft)] flex items-center justify-center shrink-0">
                    <MaterialIcon
                      icon="smart_toy"
                      className="text-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">
                      AI Smart Advisor
                    </div>
                    <div className="text-xs text-[var(--t3)]">
                      Get proactive alerts about performance drops, fee
                      deficits, and staff workload optimization.
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 p-4 rounded-xl bg-[var(--surface-container)]">
                  <div className="w-10 h-10 rounded-full bg-[var(--primary-soft)] flex items-center justify-center shrink-0">
                    <MaterialIcon
                      icon="notifications_active"
                      className="text-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">
                      Auto-SMS Reminders
                    </div>
                    <div className="text-xs text-[var(--t3)]">
                      Recover fees 3.5x faster with automatic, personalized SMS
                      nudges to parents.
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="checklist">
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <MaterialIcon icon="info" className="text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-800">
                  Complete Your School Setup
                </h4>
                <p className="text-sm text-blue-700 mt-1">
                  Use this checklist to ensure your school is fully configured.
                  Items can be completed now or skipped for later. We'll remind
                  you to complete them.
                </p>
              </div>
            </div>
          </div>
          <SetupChecklist showAll={true} />
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="backup">
        <div className="space-y-6">
          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-[var(--on-surface)] mb-6">
                Data Backup
              </h2>
              <div className="space-y-4">
                <div className="p-4 bg-[var(--surface-container-low)] rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-[var(--on-surface)]">
                        Export All Data
                      </div>
                      <div className="text-sm text-[var(--t3)]">
                        Download all school data as JSON
                      </div>
                    </div>
                    <Button onClick={exportAllData}>
                      <MaterialIcon icon="download" className="text-lg" />
                      Export
                    </Button>
                  </div>
                </div>
                <div className="p-4 bg-[var(--surface-container-low)] rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-[var(--on-surface)]">
                        Student Photos Backup
                      </div>
                      <div className="text-sm text-[var(--t3)]">
                        Export student photos and documents
                      </div>
                    </div>
                    <Button variant="secondary" onClick={exportStudentPhotos}>
                      Export Photos
                    </Button>
                  </div>
                </div>
                <div className="p-4 bg-[var(--amber-soft)] rounded-xl border border-[var(--amber)]/20">
                  <div className="flex items-center gap-3">
                    <MaterialIcon icon="info" className="text-[var(--amber)]" />
                    <div>
                      <div className="font-medium text-[var(--on-surface)]">
                        Important
                      </div>
                      <div className="text-sm text-[var(--t3)]">
                        Regular backups are recommended. Cloud backup is
                        available on Premium plans.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      {showAddUser && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddUser(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                  Add Staff Member
                </h2>
                <button
                  onClick={() => setShowAddUser(false)}
                  className="p-2 text-[var(--t3)] hover:text-[var(--on-surface)]"
                >
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={newUser.full_name}
                    onChange={(e) =>
                      setNewUser({ ...newUser, full_name: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="0700000000"
                    value={newUser.phone}
                    onChange={(e) =>
                      setNewUser({ ...newUser, phone: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    Role
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        role: e.target.value as UserRole,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {ROLE_LABELS[option.value] || option.value}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-container-low)] p-4 text-sm space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--t3)]">
                    Access summary
                  </div>
                  <div className="text-sm text-[var(--on-surface)]">
                    {selectedRoleOption?.description ||
                      "This role inherits the default access for the selected profile."}
                  </div>
                  <div className="text-xs text-[var(--t3)]">
                    Current stage: {FEATURE_STAGES[selectedStage].label}
                  </div>
                  {missingModuleLabels.length > 0 && (
                    <div className="text-xs text-[var(--amber)]">
                      Stage {FEATURE_STAGES[selectedStage].label} does not
                      include {missingModuleLabels.join(", ")}. Upgrade or
                      choose a broader stage before assigning this role.
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Min 6 characters"
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                    required
                    minLength={6}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowAddUser(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1">
                    Add User
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAddHouse && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddHouse(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                  Add House
                </h2>
                <button
                  onClick={() => setShowAddHouse(false)}
                  className="p-2 text-[var(--t3)] hover:text-[var(--on-surface)]"
                >
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                  House Name
                </label>
                <input
                  type="text"
                  value={newHouse.name}
                  onChange={(e) =>
                    setNewHouse({ ...newHouse, name: e.target.value })
                  }
                  className="input"
                  placeholder="e.g., Nile"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                  Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newHouse.color}
                    onChange={(e) =>
                      setNewHouse({ ...newHouse, color: e.target.value })
                    }
                    className="w-12 h-10 rounded border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newHouse.color}
                    onChange={(e) =>
                      setNewHouse({ ...newHouse, color: e.target.value })
                    }
                    className="input flex-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                  Motto (optional)
                </label>
                <input
                  type="text"
                  value={newHouse.motto}
                  onChange={(e) =>
                    setNewHouse({ ...newHouse, motto: e.target.value })
                  }
                  className="input"
                  placeholder="e.g., Flowing Forward"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowAddHouse(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={addHouse}>
                  Add House
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddClass && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddClass(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--on-surface)]">
                  Add Class
                </h2>
                <button
                  onClick={() => setShowAddClass(false)}
                  className="p-2 text-[var(--t3)] hover:text-[var(--on-surface)]"
                >
                  <MaterialIcon icon="close" className="text-xl" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                  Class Name
                </label>
                <input
                  type="text"
                  value={newClass.name}
                  onChange={(e) =>
                    setNewClass({ ...newClass, name: e.target.value })
                  }
                  className="input"
                  placeholder="e.g., P.5 or S.1"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--on-surface)] mb-2 block">
                  Stream (Optional)
                </label>
                <input
                  type="text"
                  value={newClass.stream}
                  onChange={(e) =>
                    setNewClass({ ...newClass, stream: e.target.value })
                  }
                  className="input"
                  placeholder="e.g., A, B, or C (leave empty if none)"
                />
                <p className="text-xs text-[var(--t3)] mt-1">
                  Only use streams if you have multiple classes at the same
                  level
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowAddClass(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleAddClass}>
                  Add Class
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
