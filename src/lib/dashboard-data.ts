type PaymentLike = {
  amount_paid?: number | string | null;
  payment_date?: string | null;
  students?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

type SmsStatsLike = {
  sentToday?: number;
};

type DashboardStatsLike = {
  totalStudents?: number;
};

export type DashboardTrendPoint = {
  name: string;
  fees: number;
  attendance: number | null;
};

export type EcosystemActivity = {
  id: string;
  type: "payment" | "sms";
  title: string;
  detail: string;
  time: string;
  icon: string;
  color: string;
};

function monthKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short" });
}

export function buildDashboardTrendData(options: {
  stats?: DashboardStatsLike | null;
  activeStudentsCount: number;
  payments: PaymentLike[];
  attendanceRate: number;
  isDemo?: boolean;
  currentDate?: Date;
}): DashboardTrendPoint[] {
  const {
    stats,
    activeStudentsCount,
    payments,
    attendanceRate,
    isDemo = false,
    currentDate = new Date(),
  } = options;

  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - (5 - index), 1);
    return {
      key: monthKey(date),
      label: monthLabel(date),
      isCurrent: index === 5,
    };
  });

  if (isDemo) {
    const baseFees = payments.reduce(
      (sum, payment) => sum + Number(payment.amount_paid || 0),
      0,
    );
    const demoFees = baseFees > 0 ? Math.max(baseFees / 6, 50000) : 50000;
    const demoAttendance = attendanceRate > 0 ? attendanceRate : 88;

    return months.map((month, index) => ({
      name: month.label,
      fees: Math.round(demoFees * (0.7 + index * 0.08)),
      attendance: Math.min(100, Math.round(demoAttendance - 4 + index)),
    }));
  }

  const feesByMonth = new Map<string, number>();
  payments.forEach((payment) => {
    if (!payment.payment_date) return;
    const date = new Date(payment.payment_date);
    if (Number.isNaN(date.getTime())) return;

    const key = monthKey(date);
    feesByMonth.set(
      key,
      (feesByMonth.get(key) || 0) + Number(payment.amount_paid || 0),
    );
  });

  const hasAttendance = attendanceRate > 0;
  const totalStudents = stats?.totalStudents || activeStudentsCount || 0;
  const hasOperationalSignal = payments.length > 0 || hasAttendance || totalStudents > 0;

  if (!hasOperationalSignal) {
    return months.map((month) => ({
      name: month.label,
      fees: 0,
      attendance: null,
    }));
  }

  return months.map((month) => ({
    name: month.label,
    fees: feesByMonth.get(month.key) || 0,
    attendance: month.isCurrent && hasAttendance ? attendanceRate : null,
  }));
}

export function buildEcosystemActivities(options: {
  payments: PaymentLike[];
  smsStats?: SmsStatsLike;
}): EcosystemActivity[] {
  const { payments, smsStats } = options;
  const list: EcosystemActivity[] = [];

  payments.slice(0, 3).forEach((payment, index) => {
    const payer = payment.students?.first_name || "Student";
    list.push({
      id: `pay-${index}`,
      type: "payment",
      title: "Fee Payment Received",
      detail: `UGX ${Number(payment.amount_paid || 0).toLocaleString()} from ${payer}`,
      time: payment.payment_date || "Recent",
      icon: "payments",
      color: "var(--green)",
    });
  });

  if ((smsStats?.sentToday || 0) > 0) {
    list.push({
      id: "sms-today",
      type: "sms",
      title: "Communication Sent",
      detail: `${smsStats?.sentToday} SMS messages delivered to parents`,
      time: "Today",
      icon: "sms",
      color: "var(--navy)",
    });
  }

  return list;
}
