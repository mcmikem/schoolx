"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
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
import { detectConsecutiveAbsenceAlerts } from "@/lib/operations";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, Badge, Input } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import Image from "next/image";
import { PageGuidance } from "@/components/PageGuidance";

const communicationTabs = [
  { id: "messages", label: "Messages" },
  { id: "bulk-sms", label: "Bulk SMS" },
  { id: "automation", label: "Automation" },
  { id: "templates", label: "Templates" },
  { id: "notices", label: "Notices" },
];

const messageTypeTabs = [
  { id: "individual", label: "One Parent" },
  { id: "class", label: "By Class" },
  { id: "all", label: "All Parents" },
];

const recentTabs = [
  { id: "all", label: "All" },
  { id: "sent", label: "Sent" },
  { id: "failed", label: "Failed" },
];

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
  {
    name: "Fee Reminder",
    category: "fee_reminder",
    message:
      "Dear parent, this is a reminder that school fees for {{student_name}} is due. Please pay UGX {{amount}} to avoid penalties. Thank you.",
  },
  {
    name: "Fee Payment Received",
    category: "fee_payment",
    message:
      "Dear parent, we have received UGX {{amount}} for {{student_name}} school fees. Balance: UGX {{balance}}. Thank you.",
  },
  {
    name: "Attendance Alert",
    category: "attendance",
    message:
      "Dear parent, {{student_name}} was marked {{status}} today at school. Please contact us if you have concerns.",
  },
  {
    name: "Exam Notice",
    category: "exam",
    message:
      "Dear parent, {{exam_name}} for {{student_name}} will be held on {{date}}. Please ensure they are prepared.",
  },
  {
    name: "Homework Notice",
    category: "homework",
    message:
      "Dear parent, {{student_name}} has homework in {{subject}}. Due date: {{due_date}}. Please support them to complete it.",
  },
  {
    name: "General Notice",
    category: "general",
    message: "Dear parent/guardian, {{message}}. Thank you.",
  },
];

export default function CommunicationHubPage() {
  const { user, school, isDemo } = useAuth();
  const toast = useToast();
  const { staff } = useStaff(school?.id);
  const {
    triggers,
    loading: triggersLoading,
    toggleTrigger,
    runTrigger,
    createTrigger,
    updateTrigger,
  } = useSMSTriggers(school?.id);

  const [activeTab, setActiveTab] = useState("messages");

  // Messages state
  const [messageType, setMessageType] = useState<
    "individual" | "class" | "all"
  >("individual");
  const [recentTab, setRecentTab] = useState("all");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      message: string;
      recipient_type: string;
      status: string;
      created_at: string;
    }>
  >([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // Bulk SMS state
  type AudienceType = "all" | "class" | "outstanding_fees" | "custom";
  const [audience, setAudience] = useState<AudienceType>("all");
  const [bulkSelectedClass, setBulkSelectedClass] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [allStudents, setAllStudents] = useState<
    Array<{
      id: string;
      first_name: string;
      last_name: string;
      parent_phone: string;
      class_id: string;
      classes?: { name: string };
    }>
  >([]);
  const [bulkSending, setBulkSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(true);

  // Automation state
  const [absencePreview, setAbsencePreview] = useState<{
    count: number;
    threshold: number;
  }>({ count: 0, threshold: 3 });
  const [runningTriggerId, setRunningTriggerId] = useState<string | null>(null);
  const [automationLogs, setAutomationLogs] = useState<any[]>([]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<any | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    name: "",
    event_type: "student_absent",
    threshold_days: 3,
    is_active: true,
  });

  // Templates state
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SMSTemplate | null>(
    null,
  );
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "general",
    message: "",
  });

  // Notices state
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [newNotice, setNewNotice] = useState({
    title: "",
    content: "",
    category: "General",
    priority: "normal",
    expires_at: "",
    image_url: "",
    send_sms: false,
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);

  // Fetch data for Messages tab
  const fetchMessagesData = useCallback(async () => {
    if (!user?.school_id) return;
    try {
      if (isDemo && school?.id) {
        setClasses(
          DEMO_CLASSES.filter((c) => c.school_id === school.id).map((c) => ({
            id: c.id,
            name: c.name,
          })),
        );
        setMessages(
          DEMO_MESSAGES.filter((m) => m.school_id === school.id).map((m) => ({
            id: m.id,
            message: m.message,
            recipient_type: m.recipient_type,
            status: m.status,
            created_at: m.sent_at,
          })),
        );
        return;
      }
      const [classesRes, messagesRes] = await Promise.all([
        supabase
          .from("classes")
          .select("id, name")
          .eq("school_id", user.school_id),
        supabase
          .from("messages")
          .select("*")
          .eq("school_id", user.school_id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (classesRes.data) setClasses(classesRes.data);
      if (messagesRes.data) setMessages(messagesRes.data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.school_id, school?.id, isDemo]);

  // Fetch data for Bulk SMS tab
  const fetchBulkData = useCallback(async () => {
    if (!school?.id) return;
    try {
      const [classesRes, studentsRes, templatesRes] = await Promise.all([
        supabase
          .from("classes")
          .select("id, name")
          .eq("school_id", school.id)
          .order("name"),
        supabase
          .from("students")
          .select(
            "id, first_name, last_name, parent_phone, class_id, classes(name)",
          )
          .eq("school_id", school.id)
          .eq("status", "active"),
        supabase
          .from("sms_templates")
          .select("*")
          .eq("school_id", school.id)
          .eq("is_active", true),
      ]);
      if (classesRes.data) setClasses(classesRes.data);
      if (studentsRes.data)
        setAllStudents(studentsRes.data as unknown as typeof allStudents);
      if (templatesRes.data) setTemplates(templatesRes.data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setBulkLoading(false);
    }
  }, [school?.id]);

  // Fetch notices
  const fetchNotices = useCallback(async () => {
    if (!school?.id) return;
    try {
      if (isDemo) {
        setNotices(
          DEMO_NOTICES.filter((n) => n.school_id === school.id).map((n) => {
            const author = DEMO_STAFF.find((s) => s.id === n.created_by);
            const lowerTitle = n.title.toLowerCase();
            let category = "General";
            if (lowerTitle.includes("fee")) category = "Finance";
            else if (lowerTitle.includes("uneb") || lowerTitle.includes("term"))
              category = "Academic";
            else if (lowerTitle.includes("sport")) category = "Sports";
            return {
              id: n.id,
              title: n.title,
              content: n.content,
              category,
              priority: n.priority === "urgent" ? "high" : n.priority,
              created_by: n.created_by,
              created_at: n.created_at,
              expires_at: n.expires_at,
              users: author ? { full_name: author.full_name } : undefined,
              acknowledged_by: [],
            };
          }),
        );
        return;
      }
      const { data, error } = await supabase
        .from("notices")
        .select("*, users(full_name)")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setNotices(data || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setNoticesLoading(false);
    }
  }, [school?.id, isDemo]);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    if (!school?.id) return;
    const { data } = await supabase
      .from("sms_templates")
      .select("*")
      .eq("school_id", school.id)
      .order("name");
    setTemplates(data || []);
  }, [school?.id]);

  useEffect(() => {
    if (user?.school_id) fetchMessagesData();
    if (school?.id) {
      fetchBulkData();
      fetchNotices();
      fetchTemplates();
    }
  }, [
    user?.school_id,
    school?.id,
    fetchMessagesData,
    fetchBulkData,
    fetchNotices,
    fetchTemplates,
  ]);

  // Automation effects
  useEffect(() => {
    async function loadAbsencePreview() {
      if (!school?.id) return;
      const absenceTrigger = triggers.find(
        (t) => t.event_type === "student_absent",
      );
      const threshold = absenceTrigger?.threshold_days || 3;
      setAbsencePreview((current) => ({ ...current, threshold }));
      try {
        const { data: students } = await supabase
          .from("students")
          .select("id, first_name, last_name, parent_phone")
          .eq("school_id", school.id)
          .eq("status", "active");
        const studentIds = (students || []).map((s) => s.id);
        const { data: attendance } =
          studentIds.length === 0
            ? { data: [] }
            : await supabase
                .from("attendance")
                .select("student_id, date, status")
                .in("student_id", studentIds)
                .gte(
                  "date",
                  new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0],
                )
                .order("date", { ascending: false });
        const alerts = detectConsecutiveAbsenceAlerts({
          students: students || [],
          attendance: attendance || [],
          trigger: {
            threshold_days: threshold,
            is_active: absenceTrigger?.is_active ?? true,
          },
        });
        setAbsencePreview({ count: alerts.length, threshold });
      } catch (error) {
        console.error("Failed to load absence preview", error);
      }
    }
    if (!triggersLoading) loadAbsencePreview();
  }, [school?.id, triggers, triggersLoading]);

  useEffect(() => {
    async function loadLogs() {
      if (!school?.id) return;
      const { data, error } = await supabase
        .from("automated_message_logs")
        .select(
          "id, trigger_id, record_id, recipient_id, status, sent_at, created_at, sms_triggers(name)",
        )
        .eq("school_id", school.id)
        .order("sent_at", { ascending: false })
        .limit(10);
      if (!error) setAutomationLogs(data || []);
    }
    if (!triggersLoading) loadLogs();
  }, [school?.id, triggersLoading, triggers]);

  // Messages handlers
  const handleSendMessage = async () => {
    if (!message.trim() || !user?.school_id) return;
    setSending(true);
    try {
      let phones: string[] = [];
      if (isDemo) {
        if (messageType === "individual") {
          if (!phone.trim()) {
            toast.error("Enter a phone number");
            return;
          }
          phones = [phone];
        } else if (messageType === "class") {
          if (!selectedClass) {
            toast.error("Select a class");
            return;
          }
          phones = DEMO_STUDENTS.filter(
            (s) => s.class_id === selectedClass && s.status === "active",
          )
            .map((s) => s.parent_phone)
            .filter(Boolean);
        } else {
          phones = DEMO_STUDENTS.filter(
            (s) => s.school_id === school?.id && s.status === "active",
          )
            .map((s) => s.parent_phone)
            .filter(Boolean);
        }
      } else if (messageType === "individual") {
        if (!phone.trim()) {
          toast.error("Enter a phone number");
          return;
        }
        phones = [phone];
      } else if (messageType === "class") {
        if (!selectedClass) {
          toast.error("Select a class");
          return;
        }
        const { data: students } = await supabase
          .from("students")
          .select("parent_phone")
          .eq("class_id", selectedClass)
          .eq("status", "active");
        phones = students?.map((s) => s.parent_phone).filter(Boolean) || [];
      } else {
        const { data: students } = await supabase
          .from("students")
          .select("parent_phone")
          .eq("school_id", user.school_id)
          .eq("status", "active");
        phones = students?.map((s) => s.parent_phone).filter(Boolean) || [];
      }
      if (phones.length === 0) {
        toast.error("No recipients found");
        return;
      }
      if (isDemo && school?.id) {
        setMessages((prev) => [
          {
            id: `demo-message-${Date.now()}`,
            message,
            recipient_type: messageType,
            status: "sent",
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        toast.success(
          `Sent to ${phones.length} recipient${phones.length > 1 ? "s" : ""}`,
        );
        setMessage("");
        setPhone("");
        setSelectedClass("");
        return;
      }
      const response = await fetch("/api/sms", {
        method: phones.length === 1 ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phones[0],
          phones,
          message,
          schoolId: user.school_id,
        }),
      });
      const result = await response.json();
      if (result.success) {
        await supabase.from("messages").insert({
          school_id: user.school_id,
          recipient_type: messageType,
          recipient_id: messageType === "class" ? selectedClass : null,
          phone: messageType === "individual" ? phone : null,
          message,
          status: "sent",
          sent_by: user.id,
          sent_at: new Date().toISOString(),
        });
        toast.success(
          `Sent to ${phones.length} recipient${phones.length > 1 ? "s" : ""}`,
        );
        setMessage("");
        setPhone("");
        fetchMessagesData();
      } else {
        toast.error(result.message || "Failed to send");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  // Bulk SMS handlers
  const bulkRecipients = useMemo(() => {
    let filtered = allStudents.filter((s) => s.parent_phone);
    if (audience === "class" && bulkSelectedClass)
      filtered = filtered.filter((s) => s.class_id === bulkSelectedClass);
    else if (audience === "outstanding_fees")
      filtered = filtered.slice(0, Math.ceil(filtered.length * 0.3));
    else if (audience === "custom")
      filtered = filtered.filter((s) => selectedStudents.includes(s.id));
    const phones = new Set(filtered.map((s) => s.parent_phone));
    return { students: filtered, phoneCount: phones.size };
  }, [allStudents, audience, bulkSelectedClass, selectedStudents]);

  const smsCount = useMemo(
    () => Math.ceil(bulkMessage.length / 160) || 0,
    [bulkMessage],
  );
  const costEstimate = useMemo(
    () => bulkRecipients.phoneCount * smsCount * 30,
    [bulkRecipients.phoneCount, smsCount],
  );

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) setBulkMessage(template.message);
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId],
    );
  };

  const handleBulkSend = async () => {
    if (
      !bulkMessage.trim() ||
      bulkRecipients.phoneCount === 0 ||
      !school?.id ||
      !user?.id
    )
      return;
    setBulkSending(true);
    try {
      const phones = bulkRecipients.students
        .map((s) => s.parent_phone)
        .filter(Boolean);
      const response = await fetch("/api/sms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phones,
          message: bulkMessage,
          schoolId: school.id,
        }),
      });
      const result = await response.json();
      if (result.success) {
        await supabase.from("messages").insert({
          school_id: school.id,
          recipient_type:
            audience === "all"
              ? "all"
              : audience === "class"
                ? "class"
                : "bulk",
          recipient_id: audience === "class" ? bulkSelectedClass : null,
          message: bulkMessage,
          status: "sent",
          sent_by: user.id,
          sent_at: new Date().toISOString(),
          recipient_count: bulkRecipients.phoneCount,
        });
        toast.success(
          `SMS sent to ${bulkRecipients.phoneCount} parent${bulkRecipients.phoneCount > 1 ? "s" : ""}`,
        );
        setBulkMessage("");
        setSelectedTemplateId("");
        setShowConfirm(false);
      } else {
        toast.error(result.message || "Failed to send SMS");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send SMS");
    } finally {
      setBulkSending(false);
    }
  };

  // Automation handlers
  const handleToggleTrigger = async (id: string, currentStatus: boolean) => {
    const result = await toggleTrigger(id, !currentStatus);
    if (result.success)
      toast.success(`Trigger ${!currentStatus ? "activated" : "deactivated"}`);
    else toast.error("Failed to update trigger");
  };

  const handleRunTrigger = async (id: string) => {
    setRunningTriggerId(id);
    const result = await runTrigger(id);
    if (result.success)
      toast.success(
        `Trigger run complete: ${result.data?.messagesCreated || 0} message(s) created`,
      );
    else toast.error(result.error || "Failed to run trigger");
    setRunningTriggerId(null);
  };

  const openCreateRule = () => {
    setEditingTrigger(null);
    setRuleForm({
      name: "",
      event_type: "student_absent",
      threshold_days: 3,
      is_active: true,
    });
    setShowRuleModal(true);
  };

  const openEditRule = (trigger: any) => {
    setEditingTrigger(trigger);
    setRuleForm({
      name: trigger.name,
      event_type: trigger.event_type,
      threshold_days: Number(trigger.threshold_days || 0),
      is_active: Boolean(trigger.is_active),
    });
    setShowRuleModal(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.name.trim()) {
      toast.error("Rule name is required");
      return;
    }
    setSavingRule(true);
    const result = editingTrigger
      ? await updateTrigger(editingTrigger.id, {
          name: ruleForm.name.trim(),
          threshold_days: Number(ruleForm.threshold_days),
          is_active: ruleForm.is_active,
        })
      : await createTrigger({
          name: ruleForm.name.trim(),
          event_type: ruleForm.event_type,
          threshold_days: Number(ruleForm.threshold_days),
          is_active: ruleForm.is_active,
        });
    if (result.success) {
      toast.success(editingTrigger ? "Rule updated" : "Rule created");
      setShowRuleModal(false);
      setEditingTrigger(null);
    } else toast.error(result.error || "Failed to save rule");
    setSavingRule(false);
  };

  // Templates handlers
  const createTemplate = async () => {
    if (!newTemplate.name || !newTemplate.message) {
      toast.error("Please fill all fields");
      return;
    }
    try {
      await supabase.from("sms_templates").insert({
        school_id: school?.id,
        name: newTemplate.name,
        category: newTemplate.category,
        message: newTemplate.message,
        is_active: true,
        created_by: user?.id,
      });
      toast.success("Template created");
      setShowCreateTemplate(false);
      setNewTemplate({ name: "", category: "general", message: "" });
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to create template");
    }
  };

  const updateTemplate = async () => {
    if (!editingTemplate) return;
    try {
      await supabase
        .from("sms_templates")
        .update({
          name: editingTemplate.name,
          category: editingTemplate.category,
          message: editingTemplate.message,
          is_active: editingTemplate.is_active,
        })
        .eq("id", editingTemplate.id);
      toast.success("Template updated");
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to update template");
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      await supabase.from("sms_templates").delete().eq("id", id);
      toast.success("Template deleted");
      fetchTemplates();
    } catch (err) {
      toast.error("Failed to delete template");
    }
  };

  const createDefaultTemplates = async () => {
    try {
      const existingNames = new Set(templates.map((t) => t.name));
      const templatesToCreate = DEFAULT_TEMPLATES.filter(
        (t) => !existingNames.has(t.name),
      ).map((t) => ({
        school_id: school?.id,
        ...t,
        is_active: true,
        created_by: user?.id,
      }));
      if (templatesToCreate.length === 0) {
        toast.success("All default templates already exist");
        return;
      }
      await supabase.from("sms_templates").insert(templatesToCreate);
      toast.success(`${templatesToCreate.length} default templates created`);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to create templates");
    }
  };

  // Notices handlers
  const sendNoticeSMS = async (
    title: string,
    content: string,
    category: string,
  ) => {
    if (isDemo) return;
    if (!school?.id || staff.length === 0) return;
    const phones = staff.filter((s: any) => s.phone).map((s: any) => s.phone);
    if (phones.length === 0) return;
    const smsMessage = `[${category}] ${title}: ${content.slice(0, 100)}${content.length > 100 ? "..." : ""}`;
    try {
      await fetch("/api/sms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phones,
          message: smsMessage,
          schoolId: school.id,
        }),
      });
      await supabase.from("messages").insert({
        school_id: school.id,
        recipient_type: "staff",
        message: smsMessage,
        status: "sent",
        sent_by: user?.id,
        sent_at: new Date().toISOString(),
        recipient_count: phones.length,
      });
    } catch (err) {
      console.error("Failed to send notice SMS:", err);
    }
  };

  const handleNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id || !user?.id) return;
    const isEmergency =
      newNotice.category === "Emergency" || newNotice.priority === "high";
    const shouldSendSMS = newNotice.send_sms || isEmergency;
    try {
      setSendingSMS(true);
      if (isDemo) {
        const author = staff.find((member: any) => member.id === user.id);
        setNotices((prev) => [
          {
            id: `demo-notice-${Date.now()}`,
            title: newNotice.title,
            content: newNotice.content,
            category: newNotice.category,
            priority:
              isEmergency && newNotice.category !== "Emergency"
                ? "high"
                : newNotice.priority,
            created_by: user.id,
            created_at: new Date().toISOString(),
            expires_at: newNotice.expires_at || null,
            image_url: newNotice.image_url || undefined,
            send_sms: shouldSendSMS,
            users: { full_name: author?.full_name || user.full_name },
            acknowledged_by: [],
          },
          ...prev,
        ]);
        toast.success(
          shouldSendSMS
            ? `Notice posted and SMS sent to ${staff.filter((s: any) => s.phone).length} staff`
            : "Notice posted",
        );
        setShowNoticeModal(false);
        setNewNotice({
          title: "",
          content: "",
          category: "General",
          priority: "normal",
          expires_at: "",
          image_url: "",
          send_sms: false,
        });
        return;
      }
      const { error } = await supabase.from("notices").insert({
        school_id: school.id,
        title: newNotice.title,
        content: newNotice.content,
        type: newNotice.category,
        priority:
          isEmergency && newNotice.category !== "Emergency"
            ? "high"
            : newNotice.priority,
        created_by: user.id,
        expiry_date: newNotice.expires_at || null,
        image_url: newNotice.image_url || null,
      });
      if (error) throw error;
      if (shouldSendSMS)
        await sendNoticeSMS(
          newNotice.title,
          newNotice.content,
          newNotice.category,
        );
      toast.success(
        shouldSendSMS
          ? `Notice posted and SMS sent to ${staff.filter((s: any) => s.phone).length} staff`
          : "Notice posted",
      );
      setShowNoticeModal(false);
      setNewNotice({
        title: "",
        content: "",
        category: "General",
        priority: "normal",
        expires_at: "",
        image_url: "",
        send_sms: false,
      });
      fetchNotices();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to post notice");
    } finally {
      setSendingSMS(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !school?.id) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `notice-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("notices")
        .upload(fileName, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const {
        data: { publicUrl },
      } = supabase.storage.from("notices").getPublicUrl(fileName);
      setNewNotice({ ...newNotice, image_url: publicUrl });
      toast.success("Image uploaded");
    } catch (err) {
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const deleteNotice = async (id: string) => {
    if (!confirm("Delete this notice?")) return;
    if (isDemo) {
      setNotices(notices.filter((n) => n.id !== id));
      toast.success("Notice deleted");
      return;
    }
    try {
      const { error } = await supabase.from("notices").delete().eq("id", id);
      if (error) throw error;
      setNotices(notices.filter((n) => n.id !== id));
      toast.success("Notice deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const acknowledgeNotice = async (noticeId: string) => {
    if (!user?.id) return;
    if (isDemo) {
      setNotices((prev) =>
        prev.map((n) =>
          n.id === noticeId
            ? {
                ...n,
                acknowledged_by: Array.from(
                  new Set([...(n.acknowledged_by || []), user.id]),
                ),
              }
            : n,
        ),
      );
      toast.success("Notice acknowledged");
      return;
    }
    try {
      const { error } = await supabase.from("notice_acknowledgments").upsert(
        {
          notice_id: noticeId,
          user_id: user.id,
          acknowledged_at: new Date().toISOString(),
        },
        { onConflict: "notice_id,user_id" },
      );
      if (error) {
        if (error.code === "42P01") {
          toast.error("Acknowledgment feature not yet configured");
          return;
        }
        throw error;
      }
      toast.success("Notice acknowledged");
      fetchNotices();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to acknowledge");
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Academic":
        return "school";
      case "Finance":
        return "payments";
      case "Sports":
        return "sports_soccer";
      case "Emergency":
        return "warning";
      default:
        return "campaign";
    }
  };

  const noticeCategories = [
    "All",
    "General",
    "Academic",
    "Finance",
    "Sports",
    "Emergency",
  ];
  const templateCategories = [
    { value: "fee_reminder", label: "Fee Reminder" },
    { value: "fee_payment", label: "Fee Payment" },
    { value: "attendance", label: "Attendance" },
    { value: "exam", label: "Exam" },
    { value: "homework", label: "Homework" },
    { value: "general", label: "General" },
  ];
  const audienceOptions = [
    { value: "all" as AudienceType, label: "All Parents", icon: "groups" },
    { value: "class" as AudienceType, label: "By Class", icon: "school" },
    {
      value: "outstanding_fees" as AudienceType,
      label: "Outstanding Fees",
      icon: "payments",
    },
    {
      value: "custom" as AudienceType,
      label: "Custom Selection",
      icon: "checklist",
    },
  ];

  const filteredMessages = messages.filter(
    (msg) => recentTab === "all" || msg.status === recentTab,
  );
  const getRecipientBadge = (type: string) => {
    const variants: Record<string, "info" | "success" | "warning"> = {
      individual: "info",
      class: "success",
      all: "warning",
    };
    return variants[type] || "info";
  };
  const getStatusBadge = (status: string) =>
    status === "sent" ? "success" : "warning";

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Communication Hub"
        subtitle="Manage all school communications in one place"
      />

      <PageGuidance
        title="How to Use Communication"
        tips={[
          {
            icon: "sms",
            text: "Send SMS: Choose individual, class, or all parents",
          },
          {
            icon: "campaign",
            text: "Notices: Post announcements visible to selected groups",
          },
          {
            icon: "automation",
            text: "Automation: Set auto-SMS for attendance, fees, results",
          },
          {
            icon: "drafts",
            text: "Templates: Save frequent messages for quick sending",
          },
          {
            icon: "analytics",
            text: "Check 'SMS Logs' tab to see delivery status",
          },
        ]}
      />

      <Tabs
        tabs={communicationTabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="mb-6"
      />

      {/* Messages Tab */}
      <TabPanel activeTab={activeTab} tabId="messages">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Send Message</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <Tabs
                tabs={messageTypeTabs}
                activeTab={messageType}
                onChange={(id) =>
                  setMessageType(id as "individual" | "class" | "all")
                }
              />
              {messageType === "individual" && (
                <div>
                  <label
                    htmlFor="message-phone"
                    className="text-sm font-medium text-[var(--on-surface)] mb-2 block"
                  >
                    Phone Number
                  </label>
                  <input
                    id="message-phone"
                    type="tel"
                    placeholder="0700000000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors"
                  />
                </div>
              )}
              {messageType === "class" && (
                <div>
                  <label
                    htmlFor="message-class"
                    className="text-sm font-medium text-[var(--on-surface)] mb-2 block"
                  >
                    Select Class
                  </label>
                  {classes.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                      No classes available
                    </div>
                  ) : (
                    <select
                      id="message-class"
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors"
                    >
                      <option value="">Choose class</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <div>
                <label
                  htmlFor="message-body"
                  className="text-sm font-medium text-[var(--on-surface)] mb-2 block"
                >
                  Message
                </label>
                <textarea
                  id="message-body"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] placeholder-[var(--t4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-colors min-h-[120px] resize-none"
                  maxLength={160}
                />
                <p className="text-xs text-[var(--t3)] mt-2">
                  {message.length}/160 characters
                </p>
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={sending || !message.trim()}
                loading={sending}
              >
                <MaterialIcon icon="send" className="text-lg" />
                {sending ? "Sending..." : "Send SMS"}
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Messages</CardTitle>
            </CardHeader>
            <CardBody>
              <Tabs
                tabs={recentTabs}
                activeTab={recentTab}
                onChange={setRecentTab}
                className="mb-4"
              />
              {loading ? (
                <TableSkeleton rows={3} />
              ) : filteredMessages.length === 0 ? (
                <EmptyState
                  icon="sms"
                  title="No messages sent yet"
                  description={
                    recentTab === "all"
                      ? "Send your first message to get started"
                      : `No ${recentTab} messages found`
                  }
                />
              ) : (
                <div className="space-y-4">
                  {filteredMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-4 bg-[var(--surface-container-low)] rounded-xl"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={getRecipientBadge(msg.recipient_type)}>
                          {msg.recipient_type === "individual"
                            ? "Individual"
                            : msg.recipient_type === "class"
                              ? "By Class"
                              : "All Parents"}
                        </Badge>
                        <Badge variant={getStatusBadge(msg.status)}>
                          {msg.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-[var(--on-surface)] mb-2">
                        {msg.message}
                      </p>
                      <p className="text-xs text-[var(--t3)]">
                        {new Date(msg.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      {/* Bulk SMS Tab */}
      <TabPanel activeTab={activeTab} tabId="bulk-sms">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[var(--t1)] mb-4">
                Target Audience
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {audienceOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAudience(opt.value)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${audience === opt.value ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border)] hover:border-[var(--t3)]"}`}
                  >
                    <MaterialIcon
                      className={`text-2xl mb-1 ${audience === opt.value ? "text-[var(--primary)]" : "text-[var(--t3)]"}`}
                    >
                      {opt.icon}
                    </MaterialIcon>
                    <div
                      className={`text-sm font-medium ${audience === opt.value ? "text-[var(--primary)]" : "text-[var(--t3)]"}`}
                    >
                      {opt.label}
                    </div>
                  </button>
                ))}
              </div>
              {audience === "class" && (
                <div className="mt-4">
                  <label className="text-sm font-medium text-[var(--t1)] mb-2 block">
                    Select Class
                  </label>
                  {classes.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                      No classes available
                    </div>
                  ) : (
                    <select
                      value={bulkSelectedClass}
                      onChange={(e) => setBulkSelectedClass(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm"
                    >
                      <option value="">Choose class</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              {audience === "custom" && (
                <div className="mt-4">
                  <label className="text-sm font-medium text-[var(--t1)] mb-2 block">
                    Select Students ({selectedStudents.length} selected)
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-[var(--border)] rounded-xl">
                    {allStudents.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-3 p-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-container)] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(s.id)}
                          onChange={() => toggleStudent(s.id)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-[var(--t1)]">
                          {s.first_name} {s.last_name}
                          <span className="text-[var(--t3)] ml-1">
                            ({s.classes?.name || "No class"})
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[var(--t1)] mb-4">
                Message
              </h2>
              {templates.length > 0 && (
                <div className="mb-4">
                  <label className="text-sm font-medium text-[var(--t1)] mb-2 block">
                    Use Template
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm"
                  >
                    <option value="">Write custom message</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <textarea
                  value={bulkMessage}
                  onChange={(e) => {
                    setBulkMessage(e.target.value);
                    setSelectedTemplateId("");
                  }}
                  placeholder="Type your message here..."
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)] min-h-[120px] resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <p
                    className={`text-xs ${bulkMessage.length > 160 ? "text-red-600 font-medium" : "text-[var(--t3)]"}`}
                  >
                    {bulkMessage.length} characters ({smsCount} SMS
                    {smsCount > 1 ? "es" : ""} per recipient)
                  </p>
                  {bulkMessage.length > 160 && (
                    <p className="text-xs text-red-600">
                      Message will be split into {smsCount} SMS segments
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-[var(--t1)] mb-4">
                Summary
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                  <span className="text-sm text-[var(--t3)]">Recipients</span>
                  <span className="font-bold text-[var(--t1)]">
                    {bulkRecipients.phoneCount} parents
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                  <span className="text-sm text-[var(--t3)]">
                    SMS per parent
                  </span>
                  <span className="font-bold text-[var(--t1)]">{smsCount}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
                  <span className="text-sm text-[var(--t3)]">Total SMS</span>
                  <span className="font-bold text-[var(--t1)]">
                    {bulkRecipients.phoneCount * smsCount}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-[var(--t3)]">Est. Cost</span>
                  <span className="font-bold text-[var(--t1)]">
                    UGX {costEstimate.toLocaleString()}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-[var(--surface-container)]">
              <p className="text-sm text-[var(--t3)]">
                <MaterialIcon className="text-sm align-text-bottom mr-1">
                  info
                </MaterialIcon>
                This SMS will be sent to{" "}
                <strong className="text-[var(--t1)]">
                  {bulkRecipients.phoneCount} parent
                  {bulkRecipients.phoneCount !== 1 ? "s" : ""}
                </strong>
                {smsCount > 0 && (
                  <span>
                    {" "}
                    ({bulkRecipients.phoneCount * smsCount} total SMS segment
                    {bulkRecipients.phoneCount * smsCount > 1 ? "s" : ""})
                  </span>
                )}
              </p>
            </Card>

            <Button
              onClick={() => setShowConfirm(true)}
              disabled={!bulkMessage.trim() || bulkRecipients.phoneCount === 0}
              className="w-full"
            >
              <MaterialIcon icon="send" className="text-lg" />
              Send Bulk SMS
            </Button>
          </div>
        </div>

        {showConfirm && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() => setShowConfirm(false)}
          >
            <div
              className="bg-[var(--surface)] rounded-2xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-[var(--border)]">
                <h2 className="text-lg font-semibold text-[var(--t1)]">
                  Confirm Bulk SMS
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-[var(--surface-container)] rounded-xl p-4">
                  <div className="text-sm text-[var(--t3)] mb-1">Message</div>
                  <p className="text-sm text-[var(--t1)]">{bulkMessage}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[var(--surface-container)] rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-[var(--t1)]">
                      {bulkRecipients.phoneCount}
                    </div>
                    <div className="text-xs text-[var(--t3)]">Recipients</div>
                  </div>
                  <div className="bg-[var(--surface-container)] rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-[var(--t1)]">
                      UGX {costEstimate.toLocaleString()}
                    </div>
                    <div className="text-xs text-[var(--t3)]">Est. Cost</div>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={bulkSending}
                    onClick={handleBulkSend}
                  >
                    {bulkSending ? "Sending..." : "Confirm & Send"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </TabPanel>

      {/* Automation Tab */}
      <TabPanel activeTab={activeTab} tabId="automation">
        {triggersLoading ? (
          <div className="p-8 text-center">Loading automation rules...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
              {triggers.map((trigger) => (
                <Card key={trigger.id} className="relative overflow-hidden p-6">
                  <div
                    className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-20 transition-all ${trigger.is_active ? "bg-green-500" : "bg-gray-300"}`}
                  />
                  <div className="flex items-center justify-between mb-6">
                    <div
                      className={`p-3 rounded-2xl ${trigger.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                    >
                      <MaterialIcon>
                        {trigger.event_type === "fee_overdue"
                          ? "payments"
                          : "person_off"}
                      </MaterialIcon>
                    </div>
                    <button
                      onClick={() =>
                        handleToggleTrigger(trigger.id, trigger.is_active)
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${trigger.is_active ? "bg-green-600" : "bg-gray-300"}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${trigger.is_active ? "translate-x-6" : "translate-x-1"}`}
                      />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--t1)]">
                        {trigger.name}
                      </h3>
                      <p className="text-xs text-[var(--t3)] uppercase tracking-widest">
                        {trigger.event_type.replace("_", " ")}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]">
                      <div className="flex items-center gap-2 text-sm text-[var(--t3)]">
                        <MaterialIcon className="text-xs">bolt</MaterialIcon>
                        <span>Threshold: {trigger.threshold_days} days</span>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between">
                      <p className="text-[10px] text-[var(--t3)] italic">
                        Last run:{" "}
                        {trigger.last_run_at
                          ? new Date(trigger.last_run_at).toLocaleDateString()
                          : "Never"}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={
                            runningTriggerId === trigger.id ||
                            !trigger.is_active
                          }
                          onClick={() => handleRunTrigger(trigger.id)}
                        >
                          {runningTriggerId === trigger.id
                            ? "Running..."
                            : "Run Now"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditRule(trigger)}
                        >
                          Edit Rule
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              <button
                onClick={openCreateRule}
                className="border-2 border-dashed border-[var(--border)] hover:border-blue-300 hover:bg-blue-50/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all group"
              >
                <div className="w-12 h-12 rounded-full bg-[var(--surface-container)] flex items-center justify-center text-[var(--t3)] group-hover:text-blue-500 group-hover:bg-blue-100 transition-all">
                  <MaterialIcon>add</MaterialIcon>
                </div>
                <p className="text-sm font-medium text-[var(--t3)] group-hover:text-[var(--t2)]">
                  New Automation Rule
                </p>
              </button>
            </div>

            <Card className="p-6">
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-amber-900">
                  Attendance trigger preview
                </div>
                <div className="mt-1 text-sm text-amber-800">
                  {absencePreview.count} student
                  {absencePreview.count === 1 ? "" : "s"} currently meet the{" "}
                  {absencePreview.threshold}-day consecutive absence threshold.
                </div>
              </div>
              <h2 className="text-xl font-bold text-[var(--t1)] mb-6">
                Automation Logs
              </h2>
              <div className="space-y-3">
                {automationLogs.length === 0 ? (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-container)] p-4 text-sm text-[var(--t3)]">
                    No automation runs recorded yet.
                  </div>
                ) : (
                  automationLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-container)] border border-[var(--border)]"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-2 h-2 rounded-full ${log.status === "sent" ? "bg-green-500" : "bg-red-500"}`}
                        />
                        <div>
                          <p className="text-sm font-medium text-[var(--t1)]">
                            {log.sms_triggers?.name || "Automation Rule"}{" "}
                            {log.status === "sent"
                              ? "processed successfully"
                              : "failed"}
                          </p>
                          <p className="text-[10px] text-[var(--t3)]">
                            {new Date(
                              log.sent_at || log.created_at,
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <MaterialIcon className="text-[var(--t3)]">
                        {log.status === "sent" ? "check_circle" : "error"}
                      </MaterialIcon>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </>
        )}

        {showRuleModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowRuleModal(false)}
          >
            <Card
              className="w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-[var(--t1)] mb-4">
                {editingTrigger
                  ? "Edit Automation Rule"
                  : "Create Automation Rule"}
              </h2>
              <form className="space-y-4" onSubmit={handleSaveRule}>
                <Input
                  label="Rule Name"
                  value={ruleForm.name}
                  onChange={(e) =>
                    setRuleForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-[var(--on-surface)] mb-2">
                    Trigger Event
                  </label>
                  <select
                    value={ruleForm.event_type}
                    disabled={Boolean(editingTrigger)}
                    onChange={(e) =>
                      setRuleForm((prev) => ({
                        ...prev,
                        event_type: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <option value="student_absent">Student Absent</option>
                    <option value="fee_overdue">Fee Overdue</option>
                  </select>
                </div>
                <Input
                  label="Threshold Days"
                  type="number"
                  min={0}
                  value={String(ruleForm.threshold_days)}
                  onChange={(e) =>
                    setRuleForm((prev) => ({
                      ...prev,
                      threshold_days: Number(e.target.value) || 0,
                    }))
                  }
                  required
                />
                <label className="flex items-center gap-3 text-sm text-[var(--t1)]">
                  <input
                    type="checkbox"
                    checked={ruleForm.is_active}
                    onChange={(e) =>
                      setRuleForm((prev) => ({
                        ...prev,
                        is_active: e.target.checked,
                      }))
                    }
                  />
                  Active
                </label>
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setShowRuleModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" loading={savingRule}>
                    Save Rule
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </TabPanel>

      {/* Templates Tab */}
      <TabPanel activeTab={activeTab} tabId="templates">
        <div className="flex gap-2 mb-6 flex-wrap">
          <Button variant="secondary" onClick={createDefaultTemplates}>
            <MaterialIcon icon="auto_awesome" className="text-lg" />
            Add Defaults
          </Button>
          <Button onClick={() => setShowCreateTemplate(true)}>
            <MaterialIcon icon="add" className="text-lg" />
            Create Template
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-[var(--t1)]">
                  {template.name}
                </h3>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${template.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                >
                  {template.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="text-xs text-[var(--t3)] mb-2 uppercase">
                {template.category.replace("_", " ")}
              </div>
              <p className="text-sm text-[var(--t3)] mb-4 line-clamp-3">
                {template.message}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => setEditingTemplate(template)}
                  className="flex-1"
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => deleteTemplate(template.id)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
          {templates.length === 0 && (
            <div className="col-span-full text-center py-12 text-[var(--t3)]">
              <MaterialIcon className="text-5xl opacity-50 mx-auto">
                sms
              </MaterialIcon>
              <p className="mt-2">
                No templates yet. Create one or add defaults.
              </p>
            </div>
          )}
        </div>

        {showCreateTemplate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-lg">
              <h2 className="text-xl font-bold text-[var(--t1)] mb-4">
                Create SMS Template
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Template Name
                  </label>
                  <input
                    value={newTemplate.name}
                    onChange={(e) =>
                      setNewTemplate({ ...newTemplate, name: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                    placeholder="e.g., Fee Reminder"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Category
                  </label>
                  <select
                    value={newTemplate.category}
                    onChange={(e) =>
                      setNewTemplate({
                        ...newTemplate,
                        category: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  >
                    {templateCategories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Message
                  </label>
                  <textarea
                    value={newTemplate.message}
                    onChange={(e) =>
                      setNewTemplate({
                        ...newTemplate,
                        message: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                    rows={4}
                    placeholder="Enter message template..."
                  />
                  <p className="text-xs text-[var(--t3)] mt-1">
                    Use {"{{variable}}"} for dynamic content (e.g.,{" "}
                    {"{{student_name}}"}, {"{{amount}}"})
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowCreateTemplate(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={createTemplate}>
                  Create Template
                </Button>
              </div>
            </div>
          </div>
        )}

        {editingTemplate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-lg">
              <h2 className="text-xl font-bold text-[var(--t1)] mb-4">
                Edit SMS Template
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Template Name
                  </label>
                  <input
                    value={editingTemplate.name}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Category
                  </label>
                  <select
                    value={editingTemplate.category}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        category: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                  >
                    {templateCategories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Message
                  </label>
                  <textarea
                    value={editingTemplate.message}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        message: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--on-surface)]"
                    rows={4}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingTemplate.is_active}
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          is_active: e.target.checked,
                        })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setEditingTemplate(null)}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={updateTemplate}>
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </TabPanel>

      {/* Notices Tab */}
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
                  {cat !== "All" && (
                    <MaterialIcon
                      icon={getCategoryIcon(cat)}
                      className="text-sm"
                    />
                  )}
                  {cat}
                </button>
              ))}
            </div>
            <Button onClick={() => setShowNoticeModal(true)}>
              <MaterialIcon icon="add" />
              Create Notice
            </Button>
          </div>

          {noticesLoading ? (
            <div className="space-y-3">
              <TableSkeleton rows={3} />
            </div>
          ) : notices.length === 0 ? (
            <EmptyState
              icon="campaign"
              title="No notices"
              description="Post your first notice"
            />
          ) : (
            <div className="space-y-4">
              {notices
                .filter((n) => !categoryFilter || n.category === categoryFilter)
                .map((notice) => (
                  <Card
                    key={notice.id}
                    className={`overflow-hidden ${notice.priority === "high" ? "border-l-4 border-l-red-500" : notice.category === "Emergency" ? "border-l-4 border-l-red-600 bg-red-50/30" : "border-l-4 border-l-gray-900"}`}
                  >
                    {notice.image_url && (
                      <div className="h-48 overflow-hidden">
                        <Image
                          src={notice.image_url}
                          alt={notice.title}
                          width={1200}
                          height={384}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 flex items-center gap-1">
                          <MaterialIcon
                            icon={getCategoryIcon(notice.category)}
                            className="text-xs"
                          />
                          {notice.category}
                        </span>
                        {notice.priority !== "normal" && (
                          <span
                            className={`px-3 py-1 rounded-lg text-xs font-medium ${notice.priority === "high" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}
                          >
                            {notice.priority} priority
                          </span>
                        )}
                        {notice.category === "Emergency" && (
                          <span className="px-3 py-1 rounded-lg text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1">
                            <MaterialIcon icon="sms" className="text-xs" />
                            SMS Sent
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-900 mb-2">
                        {notice.title}
                      </h3>
                      <p className="text-gray-500 text-sm whitespace-pre-wrap">
                        {notice.content}
                      </p>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <MaterialIcon className="text-sm">
                              person
                            </MaterialIcon>
                            {notice.users?.full_name || "Unknown"}
                          </span>
                          <span className="flex items-center gap-1">
                            <MaterialIcon className="text-sm">
                              calendar_today
                            </MaterialIcon>
                            {new Date(notice.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => acknowledgeNotice(notice.id)}
                            className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <MaterialIcon className="text-sm">
                              check_circle
                            </MaterialIcon>
                            Acknowledge
                          </button>
                          <button
                            onClick={() => deleteNotice(notice.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <MaterialIcon className="text-lg">
                              delete
                            </MaterialIcon>
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
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() => setShowNoticeModal(false)}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-[#e8eaed] sticky top-0 bg-white rounded-t-2xl">
                <h2 className="text-lg font-semibold text-[#191c1d]">
                  Post Notice
                </h2>
              </div>
              <form onSubmit={handleNoticeSubmit} className="p-6 space-y-4">
                <div>
                  <label
                    htmlFor="notice-title"
                    className="text-sm font-medium text-[#191c1d] mb-2 block"
                  >
                    Title
                  </label>
                  <input
                    id="notice-title"
                    type="text"
                    value={newNotice.title}
                    onChange={(e) =>
                      setNewNotice({ ...newNotice, title: e.target.value })
                    }
                    className="input"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="notice-category"
                      className="text-sm font-medium text-[#191c1d] mb-2 block"
                    >
                      Category
                    </label>
                    <select
                      id="notice-category"
                      value={newNotice.category}
                      onChange={(e) =>
                        setNewNotice({ ...newNotice, category: e.target.value })
                      }
                      className="input"
                    >
                      <option value="General">General</option>
                      <option value="Academic">Academic</option>
                      <option value="Finance">Finance</option>
                      <option value="Sports">Sports</option>
                      <option value="Emergency">Emergency</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="notice-priority"
                      className="text-sm font-medium text-[#191c1d] mb-2 block"
                    >
                      Priority
                    </label>
                    <select
                      id="notice-priority"
                      value={newNotice.priority}
                      onChange={(e) =>
                        setNewNotice({ ...newNotice, priority: e.target.value })
                      }
                      className="input"
                    >
                      <option value="normal">Normal</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="notice-content"
                    className="text-sm font-medium text-[#191c1d] mb-2 block"
                  >
                    Content
                  </label>
                  <textarea
                    id="notice-content"
                    value={newNotice.content}
                    onChange={(e) =>
                      setNewNotice({ ...newNotice, content: e.target.value })
                    }
                    className="input min-h-[120px]"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#191c1d] mb-2 block">
                    Image (Optional)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="btn btn-secondary cursor-pointer">
                      <MaterialIcon icon="upload" className="text-lg" />
                      {uploadingImage ? "Uploading..." : "Upload Image"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                    </label>
                    {newNotice.image_url && (
                      <span className="text-sm text-green-600 flex items-center gap-1">
                        <MaterialIcon className="text-sm">
                          check_circle
                        </MaterialIcon>
                        Image attached
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`p-4 rounded-xl border-2 transition-all ${newNotice.category === "Emergency" || newNotice.send_sms ? "border-red-200 bg-red-50" : "border-[#e8eaed] bg-[#f8fafb]"}`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        newNotice.send_sms || newNotice.category === "Emergency"
                      }
                      onChange={(e) =>
                        setNewNotice({
                          ...newNotice,
                          send_sms: e.target.checked,
                        })
                      }
                      disabled={newNotice.category === "Emergency"}
                      className="w-4 h-4 mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-[#191c1d]">
                        Send SMS notification to all staff
                      </span>
                      {newNotice.category === "Emergency" && (
                        <p className="text-xs text-red-600 mt-1">
                          Emergency notices automatically send SMS to all staff
                        </p>
                      )}
                      {!newNotice.category && newNotice.send_sms && (
                        <p className="text-xs text-[#5c6670] mt-1">
                          SMS will be sent to{" "}
                          {staff.filter((s: any) => s.phone).length} staff
                          members
                        </p>
                      )}
                    </div>
                  </label>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNoticeModal(false)}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingSMS}
                    className="btn btn-primary flex-1"
                  >
                    {sendingSMS ? "Posting..." : "Post Notice"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </TabPanel>
    </div>
  );
}
