import { supabase } from "@/lib/supabase"
import { DEMO_STUDENTS, DEMO_FEE_STRUCTURE, DEMO_FEE_PAYMENTS, DEMO_ATTENDANCE } from "@/lib/demo-data"
import { isDemoSchool } from "@/lib/demo-utils"
import { getCurrentTerm } from "@/lib/automation"

export interface SMSResult {
  success: boolean
  message: string
  count: number
  logs: SMSLogEntry[]
}

export interface SMSLogEntry {
  id: string
  studentId: string
  studentName: string
  parentPhone: string
  message: string
  status: "sent" | "failed" | "demo"
  timestamp: string
}

export interface SMSTemplateVars {
  student_name?: string
  parent_name?: string
  amount?: string
  balance?: string
  days_overdue?: string
  school_name?: string
  term?: string
  subject?: string
  date?: string
  status?: string
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  fee_overdue_7:
    "Dear {{parent_name}}, this is a reminder that school fees for {{student_name}} is 7 days overdue. Outstanding balance: UGX {{balance}}. Please pay to avoid penalties. - {{school_name}}",
  fee_overdue_14:
    "Dear {{parent_name}}, URGENT: School fees for {{student_name}} is now 14 days overdue. Balance: UGX {{balance}}. Please settle immediately. - {{school_name}}",
  fee_overdue_30:
    "Dear {{parent_name}}, FINAL NOTICE: School fees for {{student_name}} is 30 days overdue. Balance: UGX {{balance}}. Student may not sit for exams. Contact the bursar. - {{school_name}}",
  absentee_alert:
    "Dear {{parent_name}}, {{student_name}} was marked absent today at {{school_name}}. Please contact the school if you have concerns.",
  payment_confirmation:
    "Dear {{parent_name}}, we have received UGX {{amount}} for {{student_name}} school fees. Balance: UGX {{balance}}. Thank you. - {{school_name}}",
  report_card_ready:
    "Dear {{parent_name}}, the Term {{term}} report card for {{student_name}} is now ready. Please visit {{school_name}} to collect it.",
}

export function generateSMSTemplate(
  templateKey: string,
  variables: SMSTemplateVars,
): string {
  let template = DEFAULT_TEMPLATES[templateKey]
  if (!template) return ""

  let message = template
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`{{${key}}}`, "g"), value || "")
  }
  return message
}

async function logSMS(
  schoolId: string,
  entry: {
    automation_type: string
    student_id: string
    parent_phone: string
    message: string
    status: string
    metadata?: Record<string, unknown>
  },
  isDemo: boolean,
): Promise<SMSLogEntry> {
  const logEntry: SMSLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    studentId: entry.student_id,
    studentName: "",
    parentPhone: entry.parent_phone,
    message: entry.message,
    status: isDemo ? "demo" : (entry.status as SMSLogEntry["status"]),
    timestamp: new Date().toISOString(),
  }

  if (!isDemo) {
    await supabase.from("sms_logs").insert({
      school_id: schoolId,
      automation_type: entry.automation_type,
      student_id: entry.student_id,
      parent_phone: entry.parent_phone,
      message: entry.message,
      status: entry.status,
      metadata: entry.metadata || {},
      sent_at: new Date().toISOString(),
    })
  }

  return logEntry
}

export async function sendFeeOverdueReminders(options?: {
  schoolId?: string
  isDemo?: boolean
  reminderDays?: number[]
}): Promise<SMSResult> {
  const schoolId = options?.schoolId
  const isDemo = options?.isDemo ?? false
  const reminderDays = options?.reminderDays ?? [7, 14, 30]
  const logs: SMSLogEntry[] = []

  if (isDemo || isDemoSchool(schoolId)) {
    const overdueStudents = DEMO_STUDENTS.filter((s) => s.opening_balance > 0)

    for (const student of overdueStudents) {
      const daysIndex = overdueStudents.indexOf(student) % reminderDays.length
      const days = reminderDays[daysIndex]
      const templateKey = `fee_overdue_${days}`

      const message = generateSMSTemplate(templateKey, {
        student_name: `${student.first_name} ${student.last_name}`,
        parent_name: student.parent_name,
        balance: String(student.opening_balance),
        school_name: "St. Mary's Primary School",
      })

      const log = await logSMS(
        schoolId || "demo-school",
        {
          automation_type: "fee_overdue",
          student_id: student.id,
          parent_phone: student.parent_phone,
          message,
          status: "demo",
          metadata: { days_overdue: days },
        },
        true,
      )
      log.studentName = `${student.first_name} ${student.last_name}`
      logs.push(log)
    }

    return {
      success: true,
      message: `[DEMO] Would send ${logs.length} fee overdue reminders`,
      count: logs.length,
      logs,
    }
  }

  if (!schoolId) {
    return { success: false, message: "School ID required", count: 0, logs: [] }
  }

  const { data: feeStructure } = await supabase
    .from("fee_structure")
    .select("id, amount, due_date, term, academic_year")
    .eq("school_id", schoolId)
    .is("deleted_at", null)

  if (!feeStructure || feeStructure.length === 0) {
    return { success: true, message: "No fee structure found", count: 0, logs: [] }
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, parent_name, parent_phone, class_id")
    .eq("school_id", schoolId)
    .eq("status", "active")

  if (!students || students.length === 0) {
    return { success: true, message: "No active students found", count: 0, logs: [] }
  }

  const studentIds = students.map((s) => s.id)
  const { data: payments } = await supabase
    .from("fee_payments")
    .select("student_id, fee_id, amount_paid")
    .in("student_id", studentIds)

  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .single()

  const now = new Date()

  for (const fee of feeStructure) {
    if (!fee.due_date) continue

    const dueDate = new Date(fee.due_date)
    if (dueDate > now) continue

    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

    const matchingDays = reminderDays.find((d) => d === daysOverdue)
    if (!matchingDays) continue

    const totalFee = feeStructure
      .filter((f) => f.term === fee.term && f.academic_year === fee.academic_year)
      .reduce((sum, f) => sum + f.amount, 0)

    for (const student of students) {
      const studentPayments = (payments || []).filter(
        (p) => p.student_id === student.id,
      )
      const totalPaid = studentPayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0)
      const balance = totalFee - totalPaid

      if (balance <= 0) continue

      const templateKey = `fee_overdue_${matchingDays}`
      const message = generateSMSTemplate(templateKey, {
        student_name: `${student.first_name} ${student.last_name}`,
        parent_name: student.parent_name,
        balance: String(balance),
        school_name: school?.name || "School",
      })

      if (!student.parent_phone) continue

      const log = await logSMS(
        schoolId,
        {
          automation_type: "fee_overdue",
          student_id: student.id,
          parent_phone: student.parent_phone,
          message,
          status: "sent",
          metadata: { days_overdue: matchingDays, fee_term: fee.term },
        },
        false,
      )
      log.studentName = `${student.first_name} ${student.last_name}`
      logs.push(log)
    }
  }

  return {
    success: true,
    message: `Sent ${logs.length} fee overdue reminder(s)`,
    count: logs.length,
    logs,
  }
}

export async function sendAbsenteeAlert(options?: {
  schoolId?: string
  isDemo?: boolean
  date?: string
}): Promise<SMSResult> {
  const schoolId = options?.schoolId
  const isDemo = options?.isDemo ?? false
  const targetDate = options?.date ?? new Date().toISOString().split("T")[0]
  const logs: SMSLogEntry[] = []

  if (isDemo || isDemoSchool(schoolId)) {
    const absentRecords = DEMO_ATTENDANCE.filter(
      (a) => a.status === "absent" && a.date === targetDate,
    )

    for (const record of absentRecords) {
      const student = DEMO_STUDENTS.find((s) => s.id === record.student_id)
      if (!student) continue

      const message = generateSMSTemplate("absentee_alert", {
        student_name: `${student.first_name} ${student.last_name}`,
        parent_name: student.parent_name,
        school_name: "St. Mary's Primary School",
      })

      const log = await logSMS(
        schoolId || "demo-school",
        {
          automation_type: "absentee_alert",
          student_id: student.id,
          parent_phone: student.parent_phone,
          message,
          status: "demo",
          metadata: { date: targetDate, attendance_id: record.id },
        },
        true,
      )
      log.studentName = `${student.first_name} ${student.last_name}`
      logs.push(log)
    }

    return {
      success: true,
      message: `[DEMO] Would send ${logs.length} absentee alert(s)`,
      count: logs.length,
      logs,
    }
  }

  if (!schoolId) {
    return { success: false, message: "School ID required", count: 0, logs: [] }
  }

  const { data: attendance } = await supabase
    .from("attendance")
    .select("id, student_id, status, remarks")
    .eq("date", targetDate)
    .eq("status", "absent")

  if (!attendance || attendance.length === 0) {
    return { success: true, message: "No absent students found", count: 0, logs: [] }
  }

  const studentIds = attendance.map((a) => a.student_id)
  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, parent_name, parent_phone")
    .in("id", studentIds)
    .eq("status", "active")

  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .single()

  for (const record of attendance) {
    const student = students?.find((s) => s.id === record.student_id)
    if (!student || !student.parent_phone) continue

    const message = generateSMSTemplate("absentee_alert", {
      student_name: `${student.first_name} ${student.last_name}`,
      parent_name: student.parent_name,
      school_name: school?.name || "School",
    })

    const log = await logSMS(
      schoolId,
      {
        automation_type: "absentee_alert",
        student_id: student.id,
        parent_phone: student.parent_phone,
        message,
        status: "sent",
        metadata: { date: targetDate, attendance_id: record.id },
      },
      false,
    )
    log.studentName = `${student.first_name} ${student.last_name}`
    logs.push(log)
  }

  return {
    success: true,
    message: `Sent ${logs.length} absentee alert(s)`,
    count: logs.length,
    logs,
  }
}

export async function sendPaymentConfirmation(options?: {
  schoolId?: string
  isDemo?: boolean
  paymentId?: string
}): Promise<SMSResult> {
  const schoolId = options?.schoolId
  const isDemo = options?.isDemo ?? false
  const logs: SMSLogEntry[] = []

  if (isDemo || isDemoSchool(schoolId)) {
    const recentPayment = DEMO_FEE_PAYMENTS[DEMO_FEE_PAYMENTS.length - 1]
    if (!recentPayment) {
      return { success: true, message: "[DEMO] No payments found", count: 0, logs: [] }
    }

    const student = DEMO_STUDENTS.find((s) => s.id === recentPayment.student_id)
    if (!student) {
      return { success: true, message: "[DEMO] Student not found", count: 0, logs: [] }
    }

    const message = generateSMSTemplate("payment_confirmation", {
      student_name: `${student.first_name} ${student.last_name}`,
      parent_name: student.parent_name,
      amount: String(recentPayment.amount_paid),
      balance: String(Math.max(0, student.opening_balance - recentPayment.amount_paid)),
      school_name: "St. Mary's Primary School",
    })

    const log = await logSMS(
      schoolId || "demo-school",
      {
        automation_type: "payment_confirmation",
        student_id: student.id,
        parent_phone: student.parent_phone,
        message,
        status: "demo",
        metadata: { payment_id: recentPayment.id, amount: recentPayment.amount_paid },
      },
      true,
    )
    log.studentName = `${student.first_name} ${student.last_name}`
    logs.push(log)

    return {
      success: true,
      message: `[DEMO] Would send payment confirmation`,
      count: logs.length,
      logs,
    }
  }

  if (!schoolId) {
    return { success: false, message: "School ID required", count: 0, logs: [] }
  }

  let paymentQuery = supabase
    .from("fee_payments")
    .select(
      "id, student_id, amount_paid, fee_id, payment_date, students!inner(id, first_name, last_name, parent_name, parent_phone, school_id)",
    )
    .eq("students.school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(1)

  if (options?.paymentId) {
    paymentQuery = supabase
      .from("fee_payments")
      .select(
        "id, student_id, amount_paid, fee_id, payment_date, students!inner(id, first_name, last_name, parent_name, parent_phone, school_id)",
      )
      .eq("id", options.paymentId)
  }

  const { data: payment } = await paymentQuery.maybeSingle()

  if (!payment) {
    return { success: true, message: "No payment found", count: 0, logs: [] }
  }

  const student = (payment as any).students
  if (!student?.parent_phone) {
    return { success: true, message: "No parent phone found", count: 0, logs: [] }
  }

  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .single()

  const message = generateSMSTemplate("payment_confirmation", {
    student_name: `${student.first_name} ${student.last_name}`,
    parent_name: student.parent_name,
    amount: String(payment.amount_paid),
    balance: "0",
    school_name: school?.name || "School",
  })

  const log = await logSMS(
    schoolId,
    {
      automation_type: "payment_confirmation",
      student_id: student.id,
      parent_phone: student.parent_phone,
      message,
      status: "sent",
      metadata: { payment_id: payment.id, amount: payment.amount_paid },
    },
    false,
  )
  log.studentName = `${student.first_name} ${student.last_name}`
  logs.push(log)

  return {
    success: true,
    message: `Sent payment confirmation`,
    count: logs.length,
    logs,
  }
}

export async function sendReportCardReady(options?: {
  schoolId?: string
  isDemo?: boolean
  term?: number
}): Promise<SMSResult> {
  const schoolId = options?.schoolId
  const isDemo = options?.isDemo ?? false
  const term = options?.term ?? getCurrentTerm().term
  const logs: SMSLogEntry[] = []

  if (isDemo || isDemoSchool(schoolId)) {
    const activeStudents = DEMO_STUDENTS.filter((s) => s.status === "active").slice(0, 5)

    for (const student of activeStudents) {
      const message = generateSMSTemplate("report_card_ready", {
        student_name: `${student.first_name} ${student.last_name}`,
        parent_name: student.parent_name,
        term: String(term),
        school_name: "St. Mary's Primary School",
      })

      const log = await logSMS(
        schoolId || "demo-school",
        {
          automation_type: "report_card_ready",
          student_id: student.id,
          parent_phone: student.parent_phone,
          message,
          status: "demo",
          metadata: { term },
        },
        true,
      )
      log.studentName = `${student.first_name} ${student.last_name}`
      logs.push(log)
    }

    return {
      success: true,
      message: `[DEMO] Would send ${logs.length} report card notification(s)`,
      count: logs.length,
      logs,
    }
  }

  if (!schoolId) {
    return { success: false, message: "School ID required", count: 0, logs: [] }
  }

  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, parent_name, parent_phone")
    .eq("school_id", schoolId)
    .eq("status", "active")

  if (!students || students.length === 0) {
    return { success: true, message: "No active students found", count: 0, logs: [] }
  }

  const { data: school } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .single()

  for (const student of students) {
    if (!student.parent_phone) continue

    const message = generateSMSTemplate("report_card_ready", {
      student_name: `${student.first_name} ${student.last_name}`,
      parent_name: student.parent_name,
      term: String(term),
      school_name: school?.name || "School",
    })

    const log = await logSMS(
      schoolId,
      {
        automation_type: "report_card_ready",
        student_id: student.id,
        parent_phone: student.parent_phone,
        message,
        status: "sent",
        metadata: { term },
      },
      false,
    )
    log.studentName = `${student.first_name} ${student.last_name}`
    logs.push(log)
  }

  return {
    success: true,
    message: `Sent ${logs.length} report card notification(s)`,
    count: logs.length,
    logs,
  }
}

export async function getSMSLogs(options?: {
  schoolId?: string
  isDemo?: boolean
  limit?: number
  type?: string
}): Promise<SMSLogEntry[]> {
  const isDemo = options?.isDemo ?? false
  const limit = options?.limit ?? 50

  if (isDemo || isDemoSchool(options?.schoolId)) {
    const demoLogs: SMSLogEntry[] = [
      {
        id: "demo-log-1",
        studentId: "24",
        studentName: "Xavier Kibuuka",
        parentPhone: "0772345024",
        message: generateSMSTemplate("fee_overdue_14", {
          student_name: "Xavier Kibuuka",
          parent_name: "Martin Kibuuka",
          balance: "570000",
          school_name: "St. Mary's Primary School",
        }),
        status: "demo",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: "demo-log-2",
        studentId: "28",
        studentName: "Allan Ochen",
        parentPhone: "0772345028",
        message: generateSMSTemplate("absentee_alert", {
          student_name: "Allan Ochen",
          parent_name: "Patrick Ochen",
          school_name: "St. Mary's Primary School",
        }),
        status: "demo",
        timestamp: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: "demo-log-3",
        studentId: "1",
        studentName: "Amina Nakamya",
        parentPhone: "0772345001",
        message: generateSMSTemplate("payment_confirmation", {
          student_name: "Amina Nakamya",
          parent_name: "Joseph Nakamya",
          amount: "350000",
          balance: "0",
          school_name: "St. Mary's Primary School",
        }),
        status: "demo",
        timestamp: new Date(Date.now() - 259200000).toISOString(),
      },
    ]

    if (options?.type) {
      return demoLogs.filter((l) =>
        l.message.toLowerCase().includes(options.type!.replace("_", " ")),
      )
    }
    return demoLogs.slice(0, limit)
  }

  if (!options?.schoolId) return []

  let query = supabase
    .from("sms_logs")
    .select("*")
    .eq("school_id", options.schoolId)
    .order("sent_at", { ascending: false })
    .limit(limit)

  if (options.type) {
    query = query.eq("automation_type", options.type)
  }

  const { data } = await query
  if (!data) return []

  return data.map((row: any) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: "",
    parentPhone: row.parent_phone,
    message: row.message,
    status: row.status,
    timestamp: row.sent_at,
  }))
}

export async function getAutomationStatus(options?: {
  schoolId?: string
  isDemo?: boolean
}): Promise<Record<string, boolean>> {
  const isDemo = options?.isDemo ?? false

  if (isDemo || isDemoSchool(options?.schoolId)) {
    return {
      fee_overdue: true,
      absentee_alert: true,
      payment_confirmation: true,
      report_card_ready: false,
    }
  }

  if (!options?.schoolId) {
    return {
      fee_overdue: false,
      absentee_alert: false,
      payment_confirmation: false,
      report_card_ready: false,
    }
  }

  const { data } = await supabase
    .from("sms_automations")
    .select("automation_type, is_active")
    .eq("school_id", options.schoolId)

  if (!data) {
    return {
      fee_overdue: false,
      absentee_alert: false,
      payment_confirmation: false,
      report_card_ready: false,
    }
  }

  const status: Record<string, boolean> = {
    fee_overdue: false,
    absentee_alert: false,
    payment_confirmation: false,
    report_card_ready: false,
  }

  for (const row of data) {
    status[row.automation_type] = row.is_active
  }

  return status
}

export async function toggleAutomation(options: {
  schoolId: string
  automationType: string
  isActive: boolean
  isDemo?: boolean
}): Promise<{ success: boolean; message: string }> {
  if (options.isDemo || isDemoSchool(options.schoolId)) {
    return { success: true, message: `[DEMO] Automation ${options.automationType} toggled` }
  }

  const { error } = await supabase
    .from("sms_automations")
    .update({ is_active: options.isActive, updated_at: new Date().toISOString() })
    .eq("school_id", options.schoolId)
    .eq("automation_type", options.automationType)

  if (error) {
    return { success: false, message: error.message }
  }

  return { success: true, message: `Automation ${options.automationType} ${options.isActive ? "enabled" : "disabled"}` }
}

export async function updateAutomationSchedule(options: {
  schoolId: string
  automationType: string
  scheduleDays?: number[]
  isDemo?: boolean
}): Promise<{ success: boolean; message: string }> {
  if (options.isDemo || isDemoSchool(options.schoolId)) {
    return { success: true, message: `[DEMO] Schedule updated for ${options.automationType}` }
  }

  const { error } = await supabase
    .from("sms_automations")
    .update({
      schedule_days: options.scheduleDays,
      updated_at: new Date().toISOString(),
    })
    .eq("school_id", options.schoolId)
    .eq("automation_type", options.automationType)

  if (error) {
    return { success: false, message: error.message }
  }

  return { success: true, message: "Schedule updated" }
}
