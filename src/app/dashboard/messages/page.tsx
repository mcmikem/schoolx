"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { useSMSTriggers } from "@/lib/hooks";
import { useStaff } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import {
  DEMO_CLASSES,
  DEMO_MESSAGES,
  DEMO_STUDENTS,
  DEMO_NOTICES,
  DEMO_STAFF,
} from "@/lib/demo-data";
import { logger } from "@/lib/logger";
import { detectConsecutiveAbsenceAlerts } from "@/lib/operations";
import MaterialIcon from "@/components/MaterialIcon";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, Badge } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import Image from "next/image";
import { PageGuidance } from "@/components/PageGuidance";
import { getErrorMessage } from "@/lib/validation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import MessageComposer from "@/components/messages/MessageComposer";
import MessageHistory from "@/components/messages/MessageHistory";
import MessageRecipients from "@/components/messages/MessageRecipients";
import MessageAutomation from "@/components/messages/MessageAutomation";
import MessageTemplates from "@/components/messages/MessageTemplates";

const communicationTabs = [
  { id: "messages", label: "Messages" },
  { id: "bulk-sms", label: "Bulk SMS" },
  { id: "automation", label: "Automation" },
  { id: "templates", label: "Templates" },
  { id: "notices", label: "Notices" },
];

const MAX_SMS_BODY_LENGTH = 640;
const MAX_TEMPLATE_BODY_LENGTH = 1000;

interface SMSTemplate {
  id: string;
  name: string;
  category: string;
  message: string;
  is_active: boolean;
}

interface Notice {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  image_url?: string;
  send_sms?: boolean;
  users?: { full_name: string };
  acknowledged_by?: string[];
}

const DEFAULT_TEMPLATES = [
  { name: "Fee Reminder", category: "fee_reminder", message: "Dear parent, this is a reminder that school fees for {{student_name}} is due. Please pay UGX {{amount}} to avoid penalties. Thank you." },
  { name: "Fee Payment Received", category: "fee_payment", message: "Dear parent, we have received UGX {{amount}} for {{student_name}} school fees. Balance: UGX {{balance}}. Thank you." },
  { name: "Attendance Alert", category: "attendance", message: "Dear parent, {{student_name}} was marked {{status}} today at school. Please contact us if you have concerns." },
  { name: "Exam Notice", category: "exam", message: "Dear parent, {{exam_name}} for {{student_name}} will be held on {{date}}. Please ensure they are prepared." },
  { name: "Homework Notice", category: "homework", message: "Dear parent, {{student_name}} has homework in {{subject}}. Due date: {{due_date}}. Please support them to complete it." },
  { name: "General Notice", category: "general", message: "Dear parent/guardian, {{message}}. Thank you." },
];

const noticeCategories = ["All", "General", "Academic", "Finance", "Sports", "Emergency"];
const templateCategories = [
  { value: "fee_reminder", label: "Fee Reminder" },
  { value: "fee_payment", label: "Fee Payment" },
  { value: "attendance", label: "Attendance" },
  { value: "exam", label: "Exam" },
  { value: "homework", label: "Homework" },
  { value: "general", label: "General" },
];

export default function CommunicationHubPage() {
  const { user, school, isDemo } = useAuth();
  const toast = useToast();
  const searchParams = useSearchParams();
  const { staff } = useStaff(school?.id);
  const { triggers, loading: triggersLoading, toggleTrigger, runTrigger, createTrigger, updateTrigger } = useSMSTriggers(school?.id);

  const [activeTab, setActiveTab] = useState("messages");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    const requestedTab = searchParams?.get("tab");
    if (requestedTab === "messages" || requestedTab === "bulk-sms" || requestedTab === "automation" || requestedTab === "templates" || requestedTab === "notices") {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  const [messageType, setMessageType] = useState<"individual" | "class" | "all">("individual");
  const [recentTab, setRecentTab] = useState("all");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [messages, setMessages] = useState<Array<{ id: string; message: string; recipient_type: string; status: string; created_at: string }>>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messageLimit, setMessageLimit] = useState(20);

  const [audience, setAudience] = useState<"all" | "class" | "outstanding_fees" | "custom">("all");
  const [bulkSelectedClass, setBulkSelectedClass] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [allStudents, setAllStudents] = useState<Array<{ id: string; first_name: string; last_name: string; parent_phone: string; class_id: string; classes?: { name: string } }>>([]);
  const [bulkSending, setBulkSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(true);

  const [absencePreview, setAbsencePreview] = useState<{ count: number; threshold: number }>({ count: 0, threshold: 3 });
  const [runningTriggerId, setRunningTriggerId] = useState<string | null>(null);
  const [automationLogs, setAutomationLogs] = useState<any[]>([]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<any | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: "", event_type: "student_absent", threshold_days: 3, is_active: true });

  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: "", category: "general", message: "" });

  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [newNotice, setNewNotice] = useState({ title: "", content: "", category: "General", priority: "normal", expires_at: "", image_url: "", send_sms: false });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);

  const fetchMessagesData = useCallback(async () => {
    if (!user?.school_id) return;
    try {
      if (isDemo && school?.id) {
        setClasses(DEMO_CLASSES.filter((c) => c.school_id === school.id).map((c) => ({ id: c.id, name: c.name })));
        setMessages(DEMO_MESSAGES.filter((m) => m.school_id === school.id).map((m) => ({ id: m.id, message: m.message, recipient_type: m.recipient_type, status: m.status, created_at: m.sent_at })));
        return;
      }
      const [classesRes, messagesRes] = await Promise.all([
        supabase.from("classes").select("id, name").eq("school_id", user.school_id),
        supabase.from("messages").select("*").eq("school_id", user.school_id).order("created_at", { ascending: false }).limit(messageLimit),
      ]);
      if (classesRes.data) setClasses(classesRes.data);
      if (messagesRes.data) setMessages(messagesRes.data);
    } catch (err) { logger.error("Error:", err); }
    finally { setLoading(false); }
  }, [user?.school_id, school?.id, isDemo, messageLimit]);

  const fetchBulkData = useCallback(async () => {
    if (!school?.id) return;
    try {
      const [classesRes, studentsRes, templatesRes] = await Promise.all([
        supabase.from("classes").select("id, name").eq("school_id", school.id).order("name"),
        supabase.from("students").select("id, first_name, last_name, parent_phone, class_id, classes(name)").eq("school_id", school.id).eq("status", "active"),
        supabase.from("sms_templates").select("*").eq("school_id", school.id).eq("is_active", true),
      ]);
      if (classesRes.data) setClasses(classesRes.data);
      if (studentsRes.data) setAllStudents(studentsRes.data as unknown as typeof allStudents);
      if (templatesRes.data) setTemplates(templatesRes.data);
    } catch (err) { logger.error("Error:", err); }
    finally { setBulkLoading(false); }
  }, [school?.id]);

  const fetchNotices = useCallback(async () => {
    if (!school?.id) return;
    try {
      if (isDemo) {
        setNotices(DEMO_NOTICES.filter((n) => n.school_id === school.id).map((n) => {
          const author = DEMO_STAFF.find((s) => s.id === n.created_by);
          const lowerTitle = n.title.toLowerCase();
          let category = "General";
          if (lowerTitle.includes("fee")) category = "Finance";
          else if (lowerTitle.includes("uneb") || lowerTitle.includes("term")) category = "Academic";
          else if (lowerTitle.includes("sport")) category = "Sports";
          return { id: n.id, title: n.title, content: n.content, category, priority: n.priority === "urgent" ? "high" : n.priority, created_by: n.created_by, created_at: n.created_at, expires_at: n.expires_at, users: author ? { full_name: author.full_name } : undefined, acknowledged_by: [] };
        }));
        return;
      }
      const { data, error } = await supabase.from("notices").select("*, users(full_name)").eq("school_id", school.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      setNotices(data || []);
    } catch (err) { logger.error("Error:", err); }
    finally { setNoticesLoading(false); }
  }, [school?.id, isDemo]);

  const fetchTemplates = useCallback(async () => {
    if (!school?.id) return;
    const { data } = await supabase.from("sms_templates").select("*").eq("school_id", school.id).order("name");
    setTemplates(data || []);
  }, [school?.id]);

  useEffect(() => {
    if (user?.school_id) fetchMessagesData();
    if (school?.id) { fetchBulkData(); fetchNotices(); fetchTemplates(); }
  }, [user?.school_id, school?.id, fetchMessagesData, fetchBulkData, fetchNotices, fetchTemplates]);

  useEffect(() => {
    async function loadAbsencePreview() {
      if (!school?.id) return;
      const absenceTrigger = triggers.find((t) => t.event_type === "student_absent");
      const threshold = absenceTrigger?.threshold_days || 3;
      setAbsencePreview((current) => ({ ...current, threshold }));
      try {
        const { data: students } = await supabase.from("students").select("id, first_name, last_name, parent_phone").eq("school_id", school.id).eq("status", "active");
        const studentIds = (students || []).map((s) => s.id);
        const { data: attendance } = studentIds.length === 0 ? { data: [] } : await supabase.from("attendance").select("student_id, date, status").in("student_id", studentIds).gte("date", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]).order("date", { ascending: false });
        const alerts = detectConsecutiveAbsenceAlerts({ students: students || [], attendance: attendance || [], trigger: { threshold_days: threshold, is_active: absenceTrigger?.is_active ?? true } });
        setAbsencePreview({ count: alerts.length, threshold });
      } catch (error) { logger.error("Failed to load absence preview", error); }
    }
    if (!triggersLoading) loadAbsencePreview();
  }, [school?.id, triggers, triggersLoading]);

  useEffect(() => {
    async function loadLogs() {
      if (!school?.id) return;
      const { data, error } = await supabase.from("automated_message_logs").select("id, trigger_id, record_id, recipient_id, status, sent_at, created_at, sms_triggers(name)").eq("school_id", school.id).order("sent_at", { ascending: false }).limit(10);
      if (!error) setAutomationLogs(data || []);
    }
    if (!triggersLoading) loadLogs();
  }, [school?.id, triggersLoading, triggers]);

  const handleSendMessage = async () => {
    if (!message.trim() || !user?.school_id) return;
    if (message.trim().length > MAX_SMS_BODY_LENGTH) { toast.error(`Message is too long. Keep it under ${MAX_SMS_BODY_LENGTH} characters.`); return; }
    setSending(true);
    try {
      let phones: string[] = [];
      if (isDemo) {
        if (messageType === "individual") { if (!phone.trim()) { toast.error("Enter a phone number"); return; } phones = [phone]; }
        else if (messageType === "class") { if (!selectedClass) { toast.error("Select a class"); return; } phones = DEMO_STUDENTS.filter((s) => s.class_id === selectedClass && s.status === "active").map((s) => s.parent_phone).filter(Boolean); }
        else { phones = DEMO_STUDENTS.filter((s) => s.school_id === school?.id && s.status === "active").map((s) => s.parent_phone).filter(Boolean); }
      } else if (messageType === "individual") { if (!phone.trim()) { toast.error("Enter a phone number"); return; } phones = [phone]; }
      else if (messageType === "class") { if (!selectedClass) { toast.error("Select a class"); return; } const { data: students } = await supabase.from("students").select("parent_phone").eq("class_id", selectedClass).eq("status", "active"); phones = students?.map((s) => s.parent_phone).filter(Boolean) || []; }
      else { const { data: students } = await supabase.from("students").select("parent_phone").eq("school_id", user.school_id).eq("status", "active"); phones = students?.map((s) => s.parent_phone).filter(Boolean) || []; }
      if (phones.length === 0) { toast.error("No recipients found"); return; }
      if (isDemo && school?.id) {
        setMessages((prev) => [{ id: `demo-message-${Date.now()}`, message, recipient_type: messageType, status: "sent", created_at: new Date().toISOString() }, ...prev]);
        toast.success(`Sent to ${phones.length} recipient${phones.length > 1 ? "s" : ""}`);
        setMessage(""); setPhone(""); setSelectedClass(""); return;
      }
      const response = await fetch("/api/sms", { method: phones.length === 1 ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: phones[0], phones, message, schoolId: user.school_id }) });
      const result = await response.json();
      if (result.success) {
        const { withTimeout } = await import('@/lib/hooks/utils');
        const msgResult = await withTimeout(supabase.from("messages").insert({ school_id: user.school_id, recipient_type: messageType, recipient_id: messageType === "class" ? selectedClass : null, phone: messageType === "individual" ? phone : null, message: message.trim(), status: "sent", sent_by: user.id, sent_at: new Date().toISOString() }), 15000, null as any);
        if (msgResult?.error) throw msgResult.error;
        toast.success(`Sent to ${phones.length} recipient${phones.length > 1 ? "s" : ""}`);
        setMessage(""); setPhone(""); fetchMessagesData();
      } else { toast.error(result.message || "Failed to send"); }
    } catch (err: unknown) { toast.error(getErrorMessage(err, "Failed to send")); }
    finally { setSending(false); }
  };

  const handleToggleTrigger = async (id: string, currentStatus: boolean) => {
    const result = await toggleTrigger(id, !currentStatus);
    if (result.success) toast.success(`Trigger ${!currentStatus ? "activated" : "deactivated"}`);
    else toast.error("Failed to update trigger");
  };

  const handleRunTrigger = async (id: string) => {
    setRunningTriggerId(id);
    const result = await runTrigger(id);
    if (result.success) toast.success(`Trigger run complete: ${result.data?.messagesCreated || 0} message(s) created`);
    else toast.error(result.error || "Failed to run trigger");
    setRunningTriggerId(null);
  };

  const openCreateRule = () => { setEditingTrigger(null); setRuleForm({ name: "", event_type: "student_absent", threshold_days: 3, is_active: true }); setShowRuleModal(true); };
  const openEditRule = (trigger: any) => { setEditingTrigger(trigger); setRuleForm({ name: trigger.name, event_type: trigger.event_type, threshold_days: Number(trigger.threshold_days || 0), is_active: Boolean(trigger.is_active) }); setShowRuleModal(true); };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.name.trim()) { toast.error("Rule name is required"); return; }
    if (Number(ruleForm.threshold_days) < 1 || Number(ruleForm.threshold_days) > 30) { toast.error("Threshold days must be between 1 and 30"); return; }
    setSavingRule(true);
    const result = editingTrigger ? await updateTrigger(editingTrigger.id, { name: ruleForm.name.trim(), threshold_days: Number(ruleForm.threshold_days), is_active: ruleForm.is_active }) : await createTrigger({ name: ruleForm.name.trim(), event_type: ruleForm.event_type, threshold_days: Number(ruleForm.threshold_days), is_active: ruleForm.is_active });
    if (result.success) { toast.success(editingTrigger ? "Rule updated" : "Rule created"); setShowRuleModal(false); setEditingTrigger(null); }
    else toast.error(result.error || "Failed to save rule");
    setSavingRule(false);
  };

  const createTemplate = async () => {
    if (!newTemplate.name || !newTemplate.message) { toast.error("Please fill all fields"); return; }
    if (newTemplate.message.trim().length > MAX_TEMPLATE_BODY_LENGTH) { toast.error(`Template is too long. Keep it under ${MAX_TEMPLATE_BODY_LENGTH} characters.`); return; }
    try {
      const { error } = await supabase.from("sms_templates").insert({ school_id: school?.id, name: newTemplate.name.trim(), category: newTemplate.category, message: newTemplate.message.trim(), is_active: true, created_by: user?.id });
      if (error) throw error;
      toast.success("Template created"); setShowCreateTemplate(false); setNewTemplate({ name: "", category: "general", message: "" }); fetchTemplates();
    } catch (err: unknown) { toast.error(getErrorMessage(err, "Failed to create template")); }
  };

  const updateTemplate = async () => {
    if (!editingTemplate) return;
    if (!editingTemplate.name.trim() || !editingTemplate.message.trim()) { toast.error("Template name and message are required"); return; }
    try {
      const { error } = await supabase.from("sms_templates").update({ name: editingTemplate.name.trim(), category: editingTemplate.category, message: editingTemplate.message.trim(), is_active: editingTemplate.is_active }).eq("id", editingTemplate.id);
      if (error) throw error;
      toast.success("Template updated"); setEditingTemplate(null); fetchTemplates();
    } catch (err: unknown) { toast.error(getErrorMessage(err, "Failed to update template")); }
  };

  const deleteTemplate = async (id: string) => {
    setPendingAction(() => async () => {
      try { const { error } = await supabase.from("sms_templates").delete().eq("id", id); if (error) throw error; toast.success("Template deleted"); fetchTemplates(); }
      catch (err: unknown) { toast.error(getErrorMessage(err, "Failed to delete template")); }
    });
    setConfirmOpen(true);
  };

  const createDefaultTemplates = async () => {
    try {
      const existingNames = new Set(templates.map((t) => t.name));
      const templatesToCreate = DEFAULT_TEMPLATES.filter((t) => !existingNames.has(t.name)).map((t) => ({ school_id: school?.id, ...t, is_active: true, created_by: user?.id }));
      if (templatesToCreate.length === 0) { toast.success("All default templates already exist"); return; }
      const { error } = await supabase.from("sms_templates").insert(templatesToCreate);
      if (error) throw error;
      toast.success(`${templatesToCreate.length} default templates created`); fetchTemplates();
    } catch (err: unknown) { toast.error(getErrorMessage(err, "Failed to create templates")); }
  };

  const handleBulkSend = async () => {
    if (!bulkMessage.trim() || !school?.id || !user?.id) return;
    if (bulkMessage.trim().length > MAX_SMS_BODY_LENGTH) { toast.error(`Message is too long. Keep it under ${MAX_SMS_BODY_LENGTH} characters.`); return; }
    setBulkSending(true);
    try {
      const filtered = allStudents.filter((s) => s.parent_phone);
      const targetStudents = audience === "class" && bulkSelectedClass ? filtered.filter((s) => s.class_id === bulkSelectedClass) : audience === "custom" ? filtered.filter((s) => selectedStudents.includes(s.id)) : filtered;
      const phones = Array.from(new Set(targetStudents.map((s) => s.parent_phone).filter(Boolean)));
      const response = await fetch("/api/sms", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phones, message: bulkMessage.trim(), schoolId: school.id }) });
      const result = await response.json();
      if (result.success) {
        const { error: messageError } = await supabase.from("messages").insert({ school_id: school.id, recipient_type: audience === "all" ? "all" : audience === "class" ? "class" : "bulk", recipient_id: audience === "class" ? bulkSelectedClass : null, message: bulkMessage.trim(), status: "sent", sent_by: user.id, sent_at: new Date().toISOString(), recipient_count: phones.length });
        if (messageError) throw messageError;
        toast.success(`SMS sent to ${phones.length} parent${phones.length > 1 ? "s" : ""}`); setBulkMessage(""); setSelectedTemplateId(""); setShowConfirm(false);
      } else { toast.error(result.message || "Failed to send SMS"); }
    } catch (err: unknown) { toast.error(getErrorMessage(err, "Failed to send SMS")); }
    finally { setBulkSending(false); }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) setBulkMessage(template.message);
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents((prev) => prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]);
  };

  const sendNoticeSMS = async (title: string, content: string, category: string) => {
    if (isDemo || !school?.id || staff.length === 0) return;
    const phones = staff.filter((s: any) => s.phone).map((s: any) => s.phone);
    if (phones.length === 0) return;
    const smsMessage = `[${category}] ${title}: ${content.slice(0, 100)}${content.length > 100 ? "..." : ""}`;
    try {
      await fetch("/api/sms", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phones, message: smsMessage, schoolId: school.id }) });
      await supabase.from("messages").insert({ school_id: school.id, recipient_type: "staff", message: smsMessage, status: "sent", sent_by: user?.id, sent_at: new Date().toISOString(), recipient_count: phones.length });
    } catch (err) { logger.error("Failed to send notice SMS:", err); }
  };

  const handleNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id || !user?.id) return;
    const isEmergency = newNotice.category === "Emergency" || newNotice.priority === "high";
    const shouldSendSMS = newNotice.send_sms || isEmergency;
    try {
      setSendingSMS(true);
      if (isDemo) {
        const author = staff.find((member: any) => member.id === user.id);
        setNotices((prev) => [{ id: `demo-notice-${Date.now()}`, title: newNotice.title, content: newNotice.content, category: newNotice.category, priority: isEmergency && newNotice.category !== "Emergency" ? "high" : newNotice.priority, created_by: user.id, created_at: new Date().toISOString(), expires_at: newNotice.expires_at || null, image_url: newNotice.image_url || undefined, send_sms: shouldSendSMS, users: { full_name: author?.full_name || user.full_name }, acknowledged_by: [] }, ...prev]);
        toast.success(shouldSendSMS ? `Notice posted and SMS sent to ${staff.filter((s: any) => s.phone).length} staff` : "Notice posted");
        setShowNoticeModal(false); setNewNotice({ title: "", content: "", category: "General", priority: "normal", expires_at: "", image_url: "", send_sms: false }); return;
      }
      const { error } = await supabase.from("notices").insert({ school_id: school.id, title: newNotice.title, content: newNotice.content, type: newNotice.category, priority: isEmergency && newNotice.category !== "Emergency" ? "high" : newNotice.priority, created_by: user.id, expiry_date: newNotice.expires_at || null, image_url: newNotice.image_url || null });
      if (error) throw error;
      if (shouldSendSMS) await sendNoticeSMS(newNotice.title, newNotice.content, newNotice.category);
      toast.success(shouldSendSMS ? `Notice posted and SMS sent to ${staff.filter((s: any) => s.phone).length} staff` : "Notice posted");
      setShowNoticeModal(false); setNewNotice({ title: "", content: "", category: "General", priority: "normal", expires_at: "", image_url: "", send_sms: false }); fetchNotices();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed to post notice"); }
    finally { setSendingSMS(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !school?.id) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `notice-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("notices").upload(fileName, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("notices").getPublicUrl(fileName);
      setNewNotice({ ...newNotice, image_url: publicUrl });
      toast.success("Image uploaded");
    } catch (err) { toast.error("Failed to upload image"); }
    finally { setUploadingImage(false); }
  };

  const deleteNotice = async (id: string) => {
    setPendingAction(() => async () => {
      if (isDemo) { setNotices(notices.filter((n) => n.id !== id)); toast.success("Notice deleted"); return; }
      try { const { error } = await supabase.from("notices").delete().eq("id", id); if (error) throw error; setNotices(notices.filter((n) => n.id !== id)); toast.success("Notice deleted"); }
      catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed to delete"); }
    });
    setConfirmOpen(true);
  };

  const acknowledgeNotice = async (noticeId: string) => {
    if (!user?.id) return;
    if (isDemo) {
      setNotices((prev) => prev.map((n) => n.id === noticeId ? { ...n, acknowledged_by: Array.from(new Set([...(n.acknowledged_by || []), user.id])) } : n));
      toast.success("Notice acknowledged"); return;
    }
    try {
      const { error } = await supabase.from("notice_acknowledgments").upsert({ notice_id: noticeId, user_id: user.id, acknowledged_at: new Date().toISOString() }, { onConflict: "notice_id,user_id" });
      if (error) { if (error.code === "42P01") { toast.error("Acknowledgment feature not yet configured"); return; } throw error; }
      toast.success("Notice acknowledged"); fetchNotices();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Failed to acknowledge"); }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Academic": return "school";
      case "Finance": return "payments";
      case "Sports": return "sports_soccer";
      case "Emergency": return "warning";
      default: return "campaign";
    }
  };

  const filteredMessages = messages.filter((msg) => recentTab === "all" || msg.status === recentTab);

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Communication Hub" subtitle="Manage all school communications in one place" />
      <PageGuidance title="How to Use Communication" tips={[
        { icon: "sms", text: "Send SMS: Choose individual, class, or all parents" },
        { icon: "campaign", text: "Notices: Post announcements visible to selected groups" },
        { icon: "automation", text: "Automation: Set auto-SMS for attendance, fees, results" },
        { icon: "drafts", text: "Templates: Save frequent messages for quick sending" },
        { icon: "analytics", text: "Check 'SMS Logs' tab to see delivery status" },
      ]} />
      <Tabs tabs={communicationTabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

      <TabPanel activeTab={activeTab} tabId="messages">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MessageComposer
            messageType={messageType}
            onMessageTypeChange={setMessageType}
            phone={phone}
            onPhoneChange={setPhone}
            selectedClass={selectedClass}
            onSelectedClassChange={setSelectedClass}
            classes={classes}
            message={message}
            onMessageChange={setMessage}
            sending={sending}
            onSend={handleSendMessage}
          />
          <MessageHistory
            recentTab={recentTab}
            onRecentTabChange={setRecentTab}
            loading={loading}
            filteredMessages={filteredMessages}
            messages={messages}
            messageLimit={messageLimit}
            onLoadMore={() => setMessageLimit((prev) => prev + 20)}
          />
        </div>
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="bulk-sms">
        <MessageRecipients
          audience={audience}
          onAudienceChange={setAudience}
          bulkSelectedClass={bulkSelectedClass}
          onBulkSelectedClassChange={setBulkSelectedClass}
          selectedStudents={selectedStudents}
          onToggleStudent={toggleStudent}
          bulkMessage={bulkMessage}
          onBulkMessageChange={(msg) => { setBulkMessage(msg); setSelectedTemplateId(""); }}
          selectedTemplateId={selectedTemplateId}
          onTemplateSelect={handleTemplateSelect}
          templates={templates}
          classes={classes}
          allStudents={allStudents}
          showConfirm={showConfirm}
          onShowConfirmChange={setShowConfirm}
          bulkSending={bulkSending}
          onBulkSend={handleBulkSend}
        />
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="automation">
        <MessageAutomation
          triggers={triggers}
          triggersLoading={triggersLoading}
          absencePreview={absencePreview}
          automationLogs={automationLogs}
          showRuleModal={showRuleModal}
          onShowRuleModalChange={setShowRuleModal}
          editingTrigger={editingTrigger}
          savingRule={savingRule}
          ruleForm={ruleForm}
          onRuleFormChange={setRuleForm}
          runningTriggerId={runningTriggerId}
          onToggleTrigger={handleToggleTrigger}
          onRunTrigger={handleRunTrigger}
          onOpenCreateRule={openCreateRule}
          onOpenEditRule={openEditRule}
          onSaveRule={handleSaveRule}
        />
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="templates">
        <MessageTemplates
          templates={templates}
          showCreateTemplate={showCreateTemplate}
          onShowCreateTemplateChange={setShowCreateTemplate}
          editingTemplate={editingTemplate}
          onEditingTemplateChange={setEditingTemplate}
          newTemplate={newTemplate}
          onNewTemplateChange={setNewTemplate}
          templateCategories={templateCategories}
          onCreateTemplate={createTemplate}
          onUpdateTemplate={updateTemplate}
          onDeleteTemplate={deleteTemplate}
          onCreateDefaultTemplates={createDefaultTemplates}
        />
      </TabPanel>

      <TabPanel activeTab={activeTab} tabId="notices">
        <div className="space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex gap-2 flex-wrap">
              {noticeCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat === "All" ? "" : cat)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${(cat === "All" && !categoryFilter) || categoryFilter === cat ? "bg-gray-900 text-white shadow-md" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
                >
                  {cat !== "All" && <MaterialIcon icon={getCategoryIcon(cat)} className="text-sm" />}
                  {cat}
                </button>
              ))}
            </div>
            <Button onClick={() => setShowNoticeModal(true)}>
              <MaterialIcon icon="add" /> Create Notice
            </Button>
          </div>

          {noticesLoading ? (
            <div className="space-y-3"><TableSkeleton rows={3} /></div>
          ) : notices.length === 0 ? (
            <EmptyState icon="campaign" title="No notices" description="Post your first notice" />
          ) : (
            <div className="space-y-4">
              {notices.filter((n) => !categoryFilter || n.category === categoryFilter).map((notice) => (
                <Card key={notice.id} className={`overflow-hidden ${notice.priority === "high" ? "border-l-4 border-l-red-500" : notice.category === "Emergency" ? "border-l-4 border-l-red-600 bg-red-50/30" : "border-l-4 border-l-gray-900"}`}>
                  {notice.image_url && (
                    <div className="h-48 overflow-hidden">
                      <Image src={notice.image_url} alt={notice.title} width={1200} height={384} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 flex items-center gap-1">
                        <MaterialIcon icon={getCategoryIcon(notice.category)} className="text-xs" /> {notice.category}
                      </span>
                      {notice.priority !== "normal" && (
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium ${notice.priority === "high" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                          {notice.priority} priority
                        </span>
                      )}
                      {notice.category === "Emergency" && (
                        <span className="px-3 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1">
                          <MaterialIcon icon="sms" className="text-xs" /> SMS Sent
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">{notice.title}</h3>
                    <p className="text-gray-500 text-sm whitespace-pre-wrap">{notice.content}</p>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><MaterialIcon className="text-sm">person</MaterialIcon>{notice.users?.full_name || "Unknown"}</span>
                        <span className="flex items-center gap-1"><MaterialIcon className="text-sm">calendar_today</MaterialIcon>{new Date(notice.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => acknowledgeNotice(notice.id)} className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1">
                          <MaterialIcon className="text-sm">check_circle</MaterialIcon> Acknowledge
                        </button>
                        <button onClick={() => deleteNotice(notice.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <MaterialIcon className="text-lg">delete</MaterialIcon>
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {showNoticeModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNoticeModal(false)}>
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-[#e8eaed] sticky top-0 bg-white rounded-t-2xl">
                <h2 className="text-lg font-semibold text-[#191c1d]">Post Notice</h2>
              </div>
              <form onSubmit={handleNoticeSubmit} className="p-6 space-y-4">
                <div>
                  <label htmlFor="notice-title" className="text-sm font-medium text-[#191c1d] mb-2 block">Title</label>
                  <input id="notice-title" type="text" value={newNotice.title} onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })} className="input" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="notice-category" className="text-sm font-medium text-[#191c1d] mb-2 block">Category</label>
                    <select id="notice-category" value={newNotice.category} onChange={(e) => setNewNotice({ ...newNotice, category: e.target.value })} className="input">
                      <option value="General">General</option><option value="Academic">Academic</option><option value="Finance">Finance</option><option value="Sports">Sports</option><option value="Emergency">Emergency</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="notice-priority" className="text-sm font-medium text-[#191c1d] mb-2 block">Priority</label>
                    <select id="notice-priority" value={newNotice.priority} onChange={(e) => setNewNotice({ ...newNotice, priority: e.target.value })} className="input">
                      <option value="normal">Normal</option><option value="medium">Medium</option><option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="notice-content" className="text-sm font-medium text-[#191c1d] mb-2 block">Content</label>
                  <textarea id="notice-content" value={newNotice.content} onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })} className="input min-h-[120px]" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">Image (Optional)</label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 rounded-xl border border-[#e8eaed] bg-white px-4 py-2 text-sm font-medium text-[#5c6670] hover:bg-[#f8fafb] cursor-pointer">
                      <MaterialIcon icon="upload" className="text-lg" />{uploadingImage ? "Uploading..." : "Upload Image"}
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                    </label>
                    {newNotice.image_url && <span className="text-sm text-green-600 flex items-center gap-1"><MaterialIcon className="text-sm">check_circle</MaterialIcon>Image attached</span>}
                  </div>
                </div>
                <div className={`p-4 rounded-xl border-2 transition-all ${newNotice.category === "Emergency" || newNotice.send_sms ? "border-red-200 bg-red-50" : "border-[#e8eaed] bg-[#f8fafb]"}`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={newNotice.send_sms || newNotice.category === "Emergency"} onChange={(e) => setNewNotice({ ...newNotice, send_sms: e.target.checked })} disabled={newNotice.category === "Emergency"} className="w-4 h-4 mt-0.5" />
                    <div>
                      <span className="text-sm font-medium text-[#191c1d]">Send SMS notification to all staff</span>
                      {newNotice.category === "Emergency" && <p className="text-xs text-red-600 mt-1">Emergency notices automatically send SMS to all staff</p>}
                    </div>
                  </label>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" onClick={() => setShowNoticeModal(false)} variant="secondary" className="flex-1">Cancel</Button>
                  <Button type="submit" disabled={sendingSMS} loading={sendingSMS} className="flex-1">Post Notice</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </TabPanel>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); pendingAction?.(); }}
        title="Confirm Deletion"
        message="Are you sure you want to delete this item?"
        variant="danger"
      />
    </div>
    </PageErrorBoundary>
  );
}
