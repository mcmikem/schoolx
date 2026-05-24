"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { loadSchoolSettings, saveSchoolSetting } from "@/lib/school-settings";
import { type UserRole } from "@/lib/roles";
import { DEFAULT_FEATURE_STAGE, type FeatureStage } from "@/lib/featureStages";
import { logger } from "@/lib/logger";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import { useClasses } from "@/lib/hooks";
import SetupChecklist from "@/components/onboarding/SetupChecklist";
import { buildDefaultClasses, inferClassLevel } from "@/lib/school-setup";
import { getErrorMessage } from "@/lib/validation";
import MaterialIcon from "@/components/MaterialIcon";
import GeneralSettings from "@/components/settings/GeneralSettings";
import AcademicSettings from "@/components/settings/AcademicSettings";
import ClassManager from "@/components/settings/ClassManager";
import UserManager from "@/components/settings/UserManager";
import SystemPreferences from "@/components/settings/SystemPreferences";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { type ModuleKey } from "@/lib/modules/catalog";

interface SchoolSettings {
  sms_notifications: boolean;
  attendance_alerts: boolean;
  fee_reminders: boolean;
  attendance_threshold: number;
  grade_threshold: number;
  fee_threshold: number;
}

interface ModuleCatalogItem {
  module_key: ModuleKey;
  display_name: string;
  description: string;
  annual_price_ugx: number;
  is_active: boolean;
  sort_order: number;
}

interface ModuleEntitlement {
  module_key: ModuleKey;
  status: "active" | "trial" | "expired" | "canceled" | "pending";
  starts_at: string;
  ends_at: string;
  auto_renew: boolean;
}

const ALL_SETTINGS_TABS = [
  { id: "general", label: "School Details" },
  { id: "config", label: "School Config", badge: "New" },
  { id: "users", label: "Staff & Users" },
  { id: "notifications", label: "Notifications" },
  { id: "checklist", label: "Setup Checklist", badge: "Important" },
  { id: "backup", label: "Backup & Export" },
  { id: "subscription", label: "Billing & Plans", badge: "Active" },
];

const ANDROID_APP_URL = process.env.NEXT_PUBLIC_ANDROID_APP_URL || "";
const WINDOWS_APP_URL = process.env.NEXT_PUBLIC_WINDOWS_APP_URL || "";
const MAC_APP_URL = process.env.NEXT_PUBLIC_MAC_APP_URL || "";

const ROLE_TAB_ACCESS: Record<string, string[]> = {
  school_admin: ["general", "config", "users", "notifications", "checklist", "backup", "subscription"],
  admin: ["general", "config", "users", "notifications", "checklist", "backup", "subscription"],
  headmaster: ["general", "config", "users", "notifications", "checklist", "backup", "subscription"],
  super_admin: ["general", "config", "users", "notifications", "checklist", "backup", "subscription"],
  bursar: ["general", "notifications", "subscription"],
  dean_of_studies: ["general", "config", "notifications"],
  teacher: ["general", "notifications"],
  secretary: ["general", "notifications"],
  dorm_master: ["general", "notifications"],
};

export default function SettingsPage() {
  const { school, user, refreshSchool } = useAuth();
  const allowedTabIds = ROLE_TAB_ACCESS[user?.role || "teacher"] || ROLE_TAB_ACCESS.teacher;
  const tabs = ALL_SETTINGS_TABS.filter((t) => allowedTabIds.includes(t.id));
  const toast = useToast();
  const { classes, loading: loadingClasses, refetch: refetchClasses } = useClasses(school?.id);
  const [activeTab, setActiveTab] = useState("general");
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; phone: string; role: string; is_active: boolean }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [settings, setSettings] = useState<SchoolSettings>({ sms_notifications: true, attendance_alerts: true, fee_reminders: false, attendance_threshold: 80, grade_threshold: 50, fee_threshold: 50000 });
  const [schoolData, setSchoolData] = useState({ name: school?.name || "", district: school?.district || "", subcounty: "", phone: "", email: "" });
  const [logoUrl, setLogoUrl] = useState(school?.logo_url || "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [storageStatus, setStorageStatus] = useState<"unknown" | "ok" | "error">("unknown");
  const [selectedPlan, setSelectedPlan] = useState<string>(school?.subscription_plan || "starter");
  const [upgradingPlan, setUpgradingPlan] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<string>("");
  const [paymentPhone, setPaymentPhone] = useState("");
  const searchParams = useSearchParams();
  const [selectedStage, setSelectedStage] = useState<FeatureStage>((school?.feature_stage as FeatureStage) || DEFAULT_FEATURE_STAGE);
  const [savingStage, setSavingStage] = useState(false);
  const [schoolConfig, setSchoolConfig] = useState({ student_id_format: school?.student_id_format ?? "STU{YYYY}{####}", has_boarding: school?.has_boarding ?? false, has_houses: school?.has_houses ?? false, has_student_council: school?.has_student_council ?? false, has_prefects: school?.has_prefects ?? false, location_type: school?.location_type ?? "urban" });
  const [savingConfig, setSavingConfig] = useState(false);
  const [houses, setHouses] = useState<{ id: string; name: string; color: string; motto?: string | null }[]>([]);
  const [loadingHouses, setLoadingHouses] = useState(false);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("Updates are checked automatically when the app opens.");
  const [billingMode, setBillingMode] = useState<"full_suite" | "modular">("full_suite");
  const [schoolSizeBand, setSchoolSizeBand] = useState<"small" | "medium" | "large">("small");
  const [moduleCatalog, setModuleCatalog] = useState<ModuleCatalogItem[]>([]);
  const [moduleEntitlements, setModuleEntitlements] = useState<ModuleEntitlement[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [activatingModule, setActivatingModule] = useState<ModuleKey | null>(null);
  const [switchingBillingMode, setSwitchingBillingMode] = useState(false);
  const schoolType = school?.school_type || "primary";

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && allowedTabIds.includes(tab)) setActiveTab(tab);
  }, [searchParams, allowedTabIds]);

  const fetchSettings = useCallback(async () => {
    if (!school?.id) return;
    try {
      const settingsMap = await loadSchoolSettings(school.id);
      setSettings((prev) => ({
        ...prev,
        sms_notifications: settingsMap.sms_notifications !== "false",
        attendance_alerts: settingsMap.attendance_alerts !== "false",
        fee_reminders: settingsMap.fee_reminders === "true",
        attendance_threshold: parseInt(settingsMap.attendance_threshold) || 80,
        grade_threshold: parseInt(settingsMap.grade_threshold) || 50,
        fee_threshold: parseInt(settingsMap.fee_threshold) || 50000,
      }));
      const { data: schoolData } = await supabase.from("schools").select("logo_url").eq("id", school.id).single();
      if (schoolData?.logo_url) setLogoUrl(schoolData.logo_url);
    } catch (err) { logger.error("Error:", err); }
  }, [school?.id]);

  useEffect(() => { if (school?.feature_stage) setSelectedStage(school.feature_stage as FeatureStage); }, [school?.feature_stage]);
  useEffect(() => { if (school?.id) fetchSettings(); }, [school?.id, fetchSettings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const nativeApp = Boolean((window as Window & { Capacitor?: { isNative?: boolean } }).Capacitor?.isNative);

    setIsStandaloneApp(standalone);
    setIsNativeApp(nativeApp);

    const handleSwUpdate = () => {
      setUpdateAvailable(true);
      setUpdateMessage("A newer version is ready. Click Update now to refresh.");
    };

    window.addEventListener("sw-update-available", handleSwUpdate);
    return () => window.removeEventListener("sw-update-available", handleSwUpdate);
  }, []);

  useEffect(() => {
    const plan = searchParams?.get("plan");
    const error = searchParams?.get("error");
    const success = searchParams?.get("success");
    const provider = searchParams?.get("provider");
    if (plan) { setSelectedPaymentPlan(plan); setShowPaymentModal(true); }
    if (success === "true") { toast.success(provider ? `Payment flow returned from ${provider.toUpperCase()}. We are confirming your upgrade.` : "Payment flow returned. We are confirming your upgrade."); setShowPaymentModal(false); setPaymentPhone(""); }
    if (error === "no_plan") toast.error("Please select a plan to upgrade");
  }, [searchParams, toast]);

  useEffect(() => { if (school) setSchoolData((prev) => ({ ...prev, name: school.name || "", district: school.district || "" })); }, [school]);
  const fetchUsers = useCallback(async () => {
    if (!school?.id) return;
    try {
      setLoadingUsers(true);
      const { data, error } = await supabase.from("users").select("*").eq("school_id", school.id).order("created_at", { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (err) { logger.error("Error:", err); }
    finally { setLoadingUsers(false); }
  }, [school?.id]);

  const fetchHouses = useCallback(async () => {
    if (!school?.id) return;
    try {
      setLoadingHouses(true);
      const { data } = await supabase.from("houses").select("*").eq("school_id", school.id).order("name");
      setHouses(data || []);
    } catch { setHouses([]); }
    finally { setLoadingHouses(false); }
  }, [school?.id]);

  useEffect(() => { if (activeTab === "config" && school?.id) fetchHouses(); }, [activeTab, school?.id, fetchHouses]);
  useEffect(() => { if (activeTab === "users" && school?.id) fetchUsers(); }, [activeTab, school?.id, fetchUsers]);
  useEffect(() => { if (tabs.length > 0 && !tabs.some((t) => t.id === activeTab)) setActiveTab(tabs[0].id); }, [tabs, activeTab]);

  const fetchModuleData = useCallback(async () => {
    if (!school?.id) return;
    setLoadingModules(true);
    try {
      const response = await fetch("/api/modules/entitlements/");
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load modules");
      }

      const payload = result.data || {};
      setBillingMode(payload.school?.billing_mode || "full_suite");
      setSchoolSizeBand(payload.school?.school_size_band || "small");
      setModuleCatalog(payload.catalog || []);
      setModuleEntitlements(payload.entitlements || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load module billing");
    } finally {
      setLoadingModules(false);
    }
  }, [school?.id, toast]);

  useEffect(() => {
    if (activeTab === "subscription" && school?.id) {
      fetchModuleData();
    }
  }, [activeTab, school?.id, fetchModuleData]);

  const saveSettings = async (key: string, value: string) => {
    if (!school?.id) return;
    try { await saveSchoolSetting(school.id, key, value); }
    catch (err) { logger.error("Error:", err); }
  };

  const handleSettingChange = async (key: keyof SchoolSettings, value: boolean | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    await saveSettings(key, String(value));
  };



  const saveSchoolConfig = async () => {
    if (!school?.id) return;
    try {
      setSavingConfig(true);
      const { error } = await supabase.from("schools").update({ student_id_format: schoolConfig.student_id_format, has_boarding: schoolConfig.has_boarding, has_houses: schoolConfig.has_houses, has_student_council: schoolConfig.has_student_council, has_prefects: schoolConfig.has_prefects, location_type: schoolConfig.location_type }).eq("id", school.id);
      if (error) throw error;
      toast.success("School configuration saved");
      await refreshSchool();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed to save"); }
    finally { setSavingConfig(false); }
  };

  const addHouse = async (name: string, color: string, motto: string) => {
    if (!school?.id || !name.trim()) { toast.error("House name is required"); return; }
    try {
      const { withTimeout } = await import('@/lib/hooks/utils');
      const houseResult = await withTimeout(supabase.from("houses").insert({ school_id: school.id, name: name.trim(), color, motto: motto.trim() || null }), 15000, null as any);
      if (houseResult?.error) throw houseResult.error;
      toast.success("House added");
      await fetchHouses();
    } catch (err: unknown) { toast.error(getErrorMessage(err, "Failed to add house")); }
  };

  const deleteHouse = async (id: string) => {
    try {
      const { withTimeout } = await import('@/lib/hooks/utils');
      const houseDelResult = await withTimeout(supabase.from("houses").delete().eq("id", id), 15000, null as any);
      if (houseDelResult?.error) throw houseDelResult.error;
      toast.success("House deleted");
      await fetchHouses();
    } catch (err: unknown) { toast.error(getErrorMessage(err, "Failed to delete house")); }
  };

  const addClass = async (name: string, stream: string) => {
    if (!school?.id || !name.trim()) { toast.error("Class name is required"); return; }
    try {
      const { withTimeout } = await import('@/lib/hooks/utils');
      const classResult = await withTimeout(supabase.from("classes").upsert({ school_id: school.id, name: name.trim(), stream: stream.trim() || null, level: inferClassLevel(name, schoolType), academic_year: new Date().getFullYear().toString() }, { onConflict: "school_id,name,academic_year" }), 15000, null as any);
      if (classResult?.error) throw classResult.error;
      await refetchClasses();
      toast.success("Class added");
    } catch (err: unknown) { toast.error(getErrorMessage(err, "Failed to add class")); }
  };

  const deleteClass = async (id: string) => {
    try {
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) throw error;
      await refetchClasses();
      toast.success("Class deleted");
    } catch (err: unknown) { toast.error(getErrorMessage(err, "Failed to delete class")); }
  };

  const seedDefaultClasses = async () => {
    if (!school?.id) return;
    try {
      const { error } = await supabase.from("classes").upsert(buildDefaultClasses(school.id, schoolType, new Date().getFullYear().toString()), { onConflict: "school_id,name,academic_year" });
      if (error) throw error;
      await refetchClasses();
      toast.success("Standard class structure loaded");
    } catch (err: unknown) { toast.error(getErrorMessage(err, "Failed to load classes")); }
  };

  const assignClassTeacher = async (classId: string, teacherId: string) => {
    try {
      const { error } = await supabase.from("classes").update({ class_teacher_id: teacherId || null }).eq("id", classId);
      if (error) throw error;
      toast.success("Class teacher updated");
    } catch (err) { logger.error("Failed to update class teacher:", err); toast.error("Failed to update class teacher"); }
  };

  const handlePlanUpgrade = async (plan: string) => {
    if (!school?.id) return;
    if (plan === "starter" || plan === "free_trial") {
      setUpgradingPlan(true);
      try {
        const { error } = await supabase.from("schools").update({ subscription_plan: plan, subscription_status: "trial" }).eq("id", school.id);
        if (error) throw error;
        await refreshSchool();
        toast.success(`Successfully switched to ${plan.toUpperCase()} plan!`);
      } catch (err: unknown) { logger.error("Plan upgrade error:", err); toast.error(err instanceof Error ? err.message : "Failed to update plan. Please try again."); }
      finally { setUpgradingPlan(false); }
      return;
    }
    setSelectedPaymentPlan(plan);
    setShowPaymentModal(true);
  };

  const initiatePayment = async (provider: "mtn" | "airtel" | "paypal") => {
    if (!school?.id || !selectedPaymentPlan) return;
    setUpgradingPlan(true);
    try {
      if (provider === "mtn" || provider === "airtel") {
        const phone = paymentPhone.trim();
        if (!phone) { toast.error("Enter your mobile money phone number"); setUpgradingPlan(false); return; }
        const response = await fetch("/api/payment/mobile-money/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, plan: selectedPaymentPlan, phoneNumber: phone }) });
        const result = await response.json();
        if (!response.ok || result.error) throw new Error(result.error || "Payment failed");
        if (result.paymentLink) { toast.success(result.instructions || "A payment prompt has been sent to your phone. Enter your PIN to complete."); setShowPaymentModal(false); setPaymentPhone(""); }
        else throw new Error("Payment request failed. Please try again.");
      } else {
        const response = await fetch("/api/payment/checkout/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "paypal", plan: selectedPaymentPlan }) });
        const result = await response.json();
        if (!response.ok || result.error) throw new Error(result.error || "Payment failed");
        if (result.url) { const target = result.url?.trim(); if (!target || target === "about:blank") throw new Error("PayPal returned an invalid payment link."); const newTab = window.open(target, "_blank", "noopener,noreferrer"); if (!newTab) window.location.assign(target); }
        else throw new Error("PayPal approval link missing. Please try again.");
      }
      toast.success("Redirecting to payment...");
    } catch (err: unknown) { logger.error("Payment error:", err); toast.error(err instanceof Error ? err.message : "Failed to initiate payment"); }
    finally { setUpgradingPlan(false); }
  };

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from("users").update({ is_active: !currentStatus }).eq("id", id);
      if (error) throw error;
      setUsers(users.map((u) => u.id === id ? { ...u, is_active: !currentStatus } : u));
      toast.success(currentStatus ? "User deactivated" : "User activated");
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed to update"); }
  };

  const handleAddUser = (data: { full_name: string; phone: string; role: UserRole; password: string }) => {
    if (!school?.id) return;
    fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schoolId: school.id, fullName: data.full_name, phone: data.phone.replace(/[^0-9]/g, ""), password: data.password, role: data.role }) })
      .then((res) => res.json())
      .then((result) => {
        if (!result.success) throw new Error(result.error || "Failed to add user");
        toast.success("User added successfully");
        fetchUsers();
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to add user"));
  };

  const exportAllData = async () => {
    if (!school?.id) return;
    try {
      toast.success("Preparing export...");
      const tables = ["students", "classes", "subjects", "attendance", "grades", "fee_structure", "fee_payments", "users"];
      const allData: Record<string, unknown[]> = {};
      for (const table of tables) { const { data } = await supabase.from(table).select("*").eq("school_id", school.id); if (data) allData[table] = data; }
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `skoolmate_backup_${school.name}_${new Date().toISOString().split("T")[0]}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully");
    } catch (err) { toast.error("Export failed"); }
  };

  const exportStudentPhotos = async () => {
    if (!school?.id) return;
    try {
      toast.success("Preparing student photo backup...");
      const { data, error } = await supabase.from("students").select("*").eq("school_id", school.id);
      if (error) throw error;
      const photoManifest = (data || []).map((student: Record<string, unknown>) => ({ id: student.id, student_number: student.student_number, first_name: student.first_name, last_name: student.last_name, photo_url: student.photo_url || null })).filter((s) => Boolean(s.photo_url));
      const blob = new Blob([JSON.stringify(photoManifest, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `skoolmate_photos_${school.name}_${new Date().toISOString().split("T")[0]}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success(photoManifest.length > 0 ? `Exported photo manifest for ${photoManifest.length} student(s)` : "No student photos were found, but an empty manifest was exported");
    } catch (err) { logger.error(err); toast.error("Photo export failed"); }
  };

  const checkForAppUpdates = async () => {
    if (typeof window === "undefined") return;
    if (isNativeApp) {
      setUpdateMessage("Native app updates use store/build installers. Download and reinstall the latest build below.");
      return;
    }
    if (!("serviceWorker" in navigator)) {
      setUpdateMessage("This browser does not support service worker updates.");
      return;
    }

    setCheckingUpdates(true);
    try {
      const registration =
        (await navigator.serviceWorker.getRegistration()) ||
        (await navigator.serviceWorker.getRegistration("/"));

      if (!registration) {
        setUpdateMessage("Update service is not ready yet. Reload this page and try again.");
        return;
      }

      await registration.update();

      if (registration.waiting) {
        setUpdateAvailable(true);
        setUpdateMessage("A newer version is ready. Click Update now to apply.");
        return;
      }

      setUpdateAvailable(false);
      setUpdateMessage("You are already on the latest version.");
    } catch (err: unknown) {
      logger.error("Failed to check app updates:", err);
      setUpdateMessage("Could not check for updates. Please try again in a moment.");
    } finally {
      setCheckingUpdates(false);
    }
  };

  const applyAppUpdateNow = async () => {
    if (isNativeApp) {
      setUpdateMessage("For native app installs, use the latest installer link below.");
      return;
    }
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    try {
      const registration =
        (await navigator.serviceWorker.getRegistration()) ||
        (await navigator.serviceWorker.getRegistration("/"));

      if (!registration?.waiting) {
        setUpdateAvailable(false);
        setUpdateMessage("No pending update found. You are on the latest version.");
        return;
      }

      let refreshed = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshed) return;
        refreshed = true;
        window.location.reload();
      });

      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      setUpdateMessage("Applying update...");

      // Fallback refresh in case controllerchange is delayed.
      setTimeout(() => {
        if (!refreshed) window.location.reload();
      }, 1500);
    } catch (err: unknown) {
      logger.error("Failed to apply app update:", err);
      setUpdateMessage("Update failed to apply. Please reload and try again.");
    }
  };

  const switchBillingMode = async (nextMode: "full_suite" | "modular") => {
    if (nextMode === billingMode) return;
    setSwitchingBillingMode(true);
    try {
      const response = await fetch("/api/modules/mode/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingMode: nextMode }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to switch billing mode");
      }

      setBillingMode(nextMode);
      await refreshSchool();
      await fetchModuleData();
      toast.success(
        nextMode === "modular"
          ? "Switched to modular mode. You can now activate modules as needed."
          : "Switched back to full suite mode.",
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to switch billing mode");
    } finally {
      setSwitchingBillingMode(false);
    }
  };

  const activateModule = async (moduleKey: ModuleKey) => {
    setActivatingModule(moduleKey);
    try {
      const response = await fetch("/api/modules/entitlements/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey, autoRenew: true }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to activate module");
      }

      toast.success("Module activated successfully");
      await fetchModuleData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to activate module");
    } finally {
      setActivatingModule(null);
    }
  };

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Settings" subtitle="Manage your school settings" />
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

      <TabPanel activeTab={activeTab} tabId="general">
        <div className="space-y-6">
          <GeneralSettings
            schoolData={schoolData} setSchoolData={setSchoolData}
            logoUrl={logoUrl} setLogoUrl={setLogoUrl}
            uploadingLogo={uploadingLogo} setUploadingLogo={setUploadingLogo}
            storageStatus={storageStatus} setStorageStatus={setStorageStatus}
            saving={saving} selectedStage={selectedStage} setSelectedStage={setSelectedStage}
            savingStage={savingStage} refreshSchool={refreshSchool}
          />
          <AcademicSettings />
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="config">
        <ClassManager
          schoolConfig={schoolConfig}
          onSchoolConfigChange={(config: any) => setSchoolConfig(config)}
          classes={classes}
          loadingClasses={loadingClasses}
          schoolType={schoolType}
          houses={houses}
          loadingHouses={loadingHouses}
          users={users}
          savingConfig={savingConfig}
          onSaveConfig={saveSchoolConfig}
          onAddHouse={addHouse}
          onDeleteHouse={deleteHouse}
          onAddClass={addClass}
          onDeleteClass={deleteClass}
          onSeedDefaultClasses={seedDefaultClasses}
          onAssignClassTeacher={assignClassTeacher}
        />
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="users">
        <UserManager
          users={users}
          loadingUsers={loadingUsers}
          onToggleUserStatus={toggleUserStatus}
          onAddUser={handleAddUser}
          selectedStage={selectedStage}
        />
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="notifications">
        <SystemPreferences
          settings={settings}
          onSettingChange={handleSettingChange}
        />
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="checklist">
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <MaterialIcon icon="info" className="text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-800">Complete Your School Setup</h4>
                <p className="text-sm text-blue-700 mt-1">Use this checklist to ensure your school is fully configured. Items can be completed now or skipped for later. We'll remind you to complete them.</p>
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
              <h2 className="text-lg font-semibold text-[var(--on-surface)] mb-4">App Updates</h2>
              <div className="space-y-4">
                <div className="p-4 bg-[var(--surface-container-low)] rounded-xl border border-[var(--border)]">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-medium text-[var(--on-surface)]">
                        {isStandaloneApp || isNativeApp ? "Installed App Update" : "Web App Update"}
                      </div>
                      <div className="text-sm text-[var(--t3)]">{updateMessage}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" loading={checkingUpdates} onClick={checkForAppUpdates}>
                        <MaterialIcon icon="refresh" className="text-lg" />
                        Check for updates
                      </Button>
                      <Button onClick={applyAppUpdateNow} disabled={isNativeApp || !updateAvailable}>
                        <MaterialIcon icon="system_update" className="text-lg" />
                        Update now
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[var(--blue-soft)] rounded-xl border border-blue-200">
                  <div className="flex items-start gap-3">
                    <MaterialIcon icon="info" className="text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-semibold">Using installed desktop/mobile builds?</p>
                      <p className="mt-1">If your installed app does not auto-update, download the latest build below and reinstall. Your cloud data remains intact.</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ANDROID_APP_URL && (
                      <a className="btn btn-secondary btn-sm" href={ANDROID_APP_URL} target="_blank" rel="noopener noreferrer">Android latest build</a>
                    )}
                    {WINDOWS_APP_URL && (
                      <a className="btn btn-secondary btn-sm" href={WINDOWS_APP_URL} target="_blank" rel="noopener noreferrer">Windows latest build</a>
                    )}
                    {MAC_APP_URL && (
                      <a className="btn btn-secondary btn-sm" href={MAC_APP_URL} target="_blank" rel="noopener noreferrer">macOS latest build</a>
                    )}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="text-lg font-semibold text-[var(--on-surface)] mb-6">Data Backup</h2>
              <div className="space-y-4">
                <div className="p-4 bg-[var(--surface-container-low)] rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-[var(--on-surface)]">Export All Data</div>
                      <div className="text-sm text-[var(--t3)]">Download all school data as JSON</div>
                    </div>
                    <Button onClick={exportAllData}><MaterialIcon icon="download" className="text-lg" /> Export</Button>
                  </div>
                </div>
                <div className="p-4 bg-[var(--surface-container-low)] rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-[var(--on-surface)]">Student Photos Backup</div>
                      <div className="text-sm text-[var(--t3)]">Export student photos and documents</div>
                    </div>
                    <Button variant="secondary" onClick={exportStudentPhotos}>Export Photos</Button>
                  </div>
                </div>
                <div className="p-4 bg-[var(--amber-soft)] rounded-xl border border-[var(--amber)]/20">
                  <div className="flex items-center gap-3">
                    <MaterialIcon icon="info" className="text-[var(--amber)]" />
                    <div>
                      <div className="font-medium text-[var(--on-surface)]">Important</div>
                      <div className="text-sm text-[var(--t3)]">Regular backups are recommended. Cloud backup is available on Premium plans.</div>
                    </div>
                  </div>
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
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--on-surface)]">Modular Access</h2>
                  <p className="text-sm text-[var(--t3)]">Choose full suite or modular mode, then activate only what your school needs.</p>
                </div>
                <div className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--surface-container-low)] text-[var(--t2)]">
                  {billingMode === "modular" ? `Modular (${schoolSizeBand})` : "Full Suite"}
                </div>
              </div>

              {searchParams?.get("reason") === "module_locked" && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  This feature is locked for your current modular setup. Activate the needed module below.
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-5">
                <Button
                  variant={billingMode === "full_suite" ? "primary" : "secondary"}
                  loading={switchingBillingMode && billingMode !== "full_suite"}
                  onClick={() => switchBillingMode("full_suite")}
                >
                  Full Suite Mode
                </Button>
                <Button
                  variant={billingMode === "modular" ? "primary" : "secondary"}
                  loading={switchingBillingMode && billingMode !== "modular"}
                  onClick={() => switchBillingMode("modular")}
                >
                  Modular Mode
                </Button>
              </div>

              {loadingModules ? (
                <div className="text-sm text-[var(--t3)]">Loading module catalog...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {moduleCatalog.map((module) => {
                    const entitlement = moduleEntitlements.find((e) => e.module_key === module.module_key);
                    const isEntitled =
                      billingMode === "full_suite" ||
                      Boolean(
                        entitlement &&
                        ["active", "trial"].includes(entitlement.status) &&
                        new Date(entitlement.ends_at).getTime() > Date.now(),
                      );
                    const isRequestedModule = searchParams?.get("module") === module.module_key;

                    return (
                      <div
                        key={module.module_key}
                        className={`rounded-2xl border p-4 ${
                          isRequestedModule
                            ? "border-amber-400 bg-amber-50"
                            : "border-[var(--border)] bg-[var(--surface-container-low)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-[var(--on-surface)]">{module.display_name}</h3>
                            <p className="text-xs text-[var(--t3)] mt-1">{module.description}</p>
                          </div>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                              isEntitled
                                ? "bg-[var(--green-soft)] text-[var(--green)]"
                                : "bg-[var(--amber-soft)] text-[var(--amber)]"
                            }`}
                          >
                            {isEntitled ? "Active" : "Locked"}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--t1)]">
                              UGX {Number(module.annual_price_ugx || 0).toLocaleString()} / year
                            </p>
                            <p className="text-[11px] text-[var(--t3)]">
                              {entitlement?.ends_at
                                ? `Valid until ${new Date(entitlement.ends_at).toLocaleDateString()}`
                                : "Annual license"}
                            </p>
                          </div>

                          {billingMode === "modular" && !isEntitled ? (
                            <Button
                              onClick={() => activateModule(module.module_key)}
                              loading={activatingModule === module.module_key}
                            >
                              Add Module
                            </Button>
                          ) : (
                            <Button variant="secondary" disabled>
                              {isEntitled ? "Enabled" : "Switch to modular"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--on-surface)]">SkoolMate Subscription</h2>
                  <p className="text-sm text-[var(--t3)]">Your account is currently active</p>
                </div>
                <div className="px-4 py-2 bg-[var(--green-soft)] text-[var(--green)] rounded-full text-sm font-semibold">PREMIUM PLAN</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-container-low)]">
                  <div className="text-sm font-bold text-[var(--t3)] uppercase tracking-wider mb-2">Starter</div>
                  <div className="text-2xl font-bold mb-4">UGX 250k <span className="text-sm font-normal text-[var(--t3)]">/ term</span></div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-2 text-sm"><MaterialIcon icon="check_circle" className="text-[var(--green)] text-base" /> Up to 100 Students</li>
                    <li className="flex items-center gap-2 text-sm"><MaterialIcon icon="check_circle" className="text-[var(--green)] text-base" /> Basic Attendance</li>
                    <li className="flex items-center gap-2 text-sm"><MaterialIcon icon="check_circle" className="text-[var(--green)] text-base" /> Fee Management</li>
                  </ul>
                  <Button variant="secondary" className="w-full" loading={upgradingPlan && selectedPlan === "starter"} onClick={() => handlePlanUpgrade("starter")}>Active</Button>
                </div>
                <div className="p-6 rounded-2xl border-2 border-[var(--primary)] bg-[var(--primary-soft)] relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[var(--primary)] text-white text-[10px] font-bold rounded-full uppercase">Most Popular</div>
                  <div className="text-sm font-bold text-[var(--primary)] uppercase tracking-wider mb-2">Growth</div>
                  <div className="text-2xl font-bold mb-4">UGX 3,500 <span className="text-sm font-normal text-[var(--t3)]">/ month</span></div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-2 text-sm"><MaterialIcon icon="check_circle" className="text-[var(--green)] text-base" /> Up to 500 Students</li>
                    <li className="flex items-center gap-2 text-sm"><MaterialIcon icon="check_circle" className="text-[var(--green)] text-base" /> SMS Notifications</li>
                    <li className="flex items-center gap-2 text-sm"><MaterialIcon icon="check_circle" className="text-[var(--green)] text-base" /> Report Card Printing</li>
                  </ul>
                  <Button className="w-full" loading={upgradingPlan && selectedPlan === "growth"} onClick={() => handlePlanUpgrade("growth")}>{school?.subscription_plan === "growth" ? "Current Plan" : "Select"}</Button>
                </div>
                <div className="p-6 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-container-low)]">
                  <div className="text-sm font-bold text-[var(--t3)] uppercase tracking-wider mb-2">Enterprise</div>
                  <div className="text-2xl font-bold mb-4">UGX 5,500 <span className="text-sm font-normal text-[var(--t3)]">/ month</span></div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-2 text-sm"><MaterialIcon icon="check_circle" className="text-[var(--green)] text-base" /> Unlimited Students</li>
                    <li className="flex items-center gap-2 text-sm"><MaterialIcon icon="check_circle" className="text-[var(--green)] text-base" /> AI Smart Advisor</li>
                    <li className="flex items-center gap-2 text-sm"><MaterialIcon icon="check_circle" className="text-[var(--green)] text-base" /> Full Payroll & Assets</li>
                  </ul>
                  <Button variant="secondary" className="w-full" loading={upgradingPlan && selectedPlan === "enterprise"} onClick={() => handlePlanUpgrade("enterprise")}>{school?.subscription_plan === "enterprise" ? "Current Plan" : "Upgrade"}</Button>
                </div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold mb-4 text-[var(--on-surface)]">Why Upgrade to Premium?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex gap-4 p-4 rounded-xl bg-[var(--surface-container)]">
                  <div className="w-10 h-10 rounded-full bg-[var(--primary-soft)] flex items-center justify-center shrink-0"><MaterialIcon icon="smart_toy" className="text-[var(--primary)]" /></div>
                  <div><div className="font-semibold text-sm">AI Smart Advisor</div><div className="text-xs text-[var(--t3)]">Get proactive alerts about performance drops, fee deficits, and staff workload optimization.</div></div>
                </div>
                <div className="flex gap-4 p-4 rounded-xl bg-[var(--surface-container)]">
                  <div className="w-10 h-10 rounded-full bg-[var(--primary-soft)] flex items-center justify-center shrink-0"><MaterialIcon icon="notifications_active" className="text-[var(--primary)]" /></div>
                  <div><div className="font-semibold text-sm">Auto-SMS Reminders</div><div className="text-xs text-[var(--t3)]">Recover fees 3.5x faster with automatic, personalized SMS nudges to parents.</div></div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--on-surface)]">Complete Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-[var(--t3)] hover:text-[var(--on-surface)]"><MaterialIcon icon="close" /></button>
            </div>
            <div className="mb-6">
              <p className="text-[var(--t3)] mb-2">You selected <strong>{selectedPaymentPlan?.toUpperCase()}</strong> plan</p>
              <p className="text-sm text-[var(--t3)]">Choose your payment method:</p>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <label className="block text-xs font-semibold text-[var(--t2)] mb-1">Mobile Money Phone Number</label>
                <input type="tel" value={paymentPhone} onChange={(e) => setPaymentPhone(e.target.value)} placeholder="e.g. 0772000000" className="input w-full" />
                <p className="mt-1 text-[11px] text-[var(--t3)]">Enter your MTN MoMo or Airtel Money registered number.</p>
              </div>
              <button onClick={() => initiatePayment("mtn")} disabled={upgradingPlan} className="w-full p-4 rounded-xl border-2 border-yellow-400 bg-yellow-50 hover:bg-yellow-100 flex items-center gap-3 transition-colors">
                <span className="text-2xl">🟡</span>
                <div className="text-left"><div className="font-semibold text-[var(--on-surface)]">MTN Mobile Money</div><div className="text-xs text-[var(--t3)]">Instant prompt on your phone</div></div>
              </button>
              <button onClick={() => initiatePayment("airtel")} disabled={upgradingPlan} className="w-full p-4 rounded-xl border-2 border-red-400 bg-red-50 hover:bg-red-100 flex items-center gap-3 transition-colors">
                <span className="text-2xl">🔴</span>
                <div className="text-left"><div className="font-semibold text-[var(--on-surface)]">Airtel Money</div><div className="text-xs text-[var(--t3)]">Instant prompt on your phone</div></div>
              </button>
              <button onClick={() => initiatePayment("paypal")} disabled={upgradingPlan} className="w-full p-4 rounded-xl border-2 border-blue-500 bg-blue-50 hover:bg-blue-100 flex items-center gap-3 transition-colors">
                <span className="text-2xl">💳</span>
                <div className="text-left"><div className="font-semibold text-[var(--on-surface)]">PayPal</div><div className="text-xs text-[var(--t3)]">International cards accepted</div></div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
