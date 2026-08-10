// Shared marketer business logic. Kept dependency-free so it can be imported
// by both API routes and unit tests — tests must never re-implement this.

export function generateSchoolCode(schoolName: string, district: string): string {
  const nameWords = schoolName
    .toUpperCase()
    .replace(/[^A-Z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  let nameCode = "";
  for (const word of nameWords.slice(0, 3)) {
    nameCode += word.substring(0, 2);
    if (nameCode.length >= 4) break;
  }
  nameCode = nameCode.substring(0, 4) || "SCHL";
  const districtCode =
    district
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .substring(0, 2) || "UG";
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `${nameCode}${districtCode}${randomNum}`;
}

export function calculateCommission(plan: string): number {
  const isPaid = plan !== "free_trial";
  const isPremium = plan === "growth" || plan === "enterprise";
  return isPaid ? (isPremium ? 80000 : 70000) : 4000;
}

export interface EarningsEntry {
  amount: number;
  status: string;
}

export function calculateEarningsSummary(earnings: EarningsEntry[], payouts: EarningsEntry[]) {
  const totalEarned = earnings.reduce((sum, e) => sum + Number(e.amount), 0);
  const pendingEarnings = earnings
    .filter((e) => e.status === "pending" || e.status === "approved")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPaid = payouts.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0);
  return { totalEarned, pendingEarnings, totalPaid, balance: totalEarned - totalPaid };
}

export interface ParsedLead {
  school_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  district: string | null;
  status: "new";
}

export function parseCSV(text: string): { leads: ParsedLead[]; errors: string[] } {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { leads: [], errors: ["CSV must have a header row and at least one data row"] };

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const schoolNameIdx = headers.findIndex((h) => h.includes("school") || h.includes("name"));
  const contactNameIdx = headers.findIndex((h) => h.includes("contact") || h.includes("person"));
  const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("tel") || h.includes("mobile"));
  const emailIdx = headers.findIndex((h) => h.includes("email") || h.includes("mail"));
  const districtIdx = headers.findIndex((h) => h.includes("district") || h.includes("location"));

  if (schoolNameIdx < 0) return { leads: [], errors: ['CSV must have a "school_name" column'] };

  const leads: ParsedLead[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const schoolName = cols[schoolNameIdx];
    if (!schoolName) {
      errors.push(`Row ${i + 1}: missing school name`);
      continue;
    }
    leads.push({
      school_name: schoolName,
      contact_name: contactNameIdx >= 0 ? cols[contactNameIdx] || null : null,
      contact_phone: phoneIdx >= 0 ? cols[phoneIdx] || null : null,
      contact_email: emailIdx >= 0 ? cols[emailIdx] || null : null,
      district: districtIdx >= 0 ? cols[districtIdx] || null : null,
      status: "new",
    });
  }

  return { leads, errors };
}

export function isValidNormalizedPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 12;
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(pw) || !/[0-9]/.test(pw))
    return "Password must contain at least one uppercase letter and one number";
  return null;
}

export function validateDigitizationFee(fee: number): string | null {
  if (fee < 10000 || fee > 50000) return "Must be 10,000–50,000 UGX";
  return null;
}

const PLAN_ORDER = ["free_trial", "starter", "growth", "enterprise"];

export function validatePlanUpgrade(currentPlan: string, newPlan: string, role: string): string | null {
  const currentIdx = PLAN_ORDER.indexOf(currentPlan);
  const newIdx = PLAN_ORDER.indexOf(newPlan);
  if (newIdx < 0) return "Invalid plan";
  if (newIdx <= currentIdx && role !== "super_admin") return "Can only upgrade to a higher plan";
  return null;
}
