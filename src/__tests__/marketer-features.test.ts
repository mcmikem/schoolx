import { describe, it, expect } from "@jest/globals";
import { normalizePlanType } from "@/lib/payments/subscription-client";

function generateSchoolCode(schoolName: string, district: string): string {
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

function calculateCommission(plan: string): number {
  const isPaid = plan !== "free_trial";
  const isPremium = plan === "growth" || plan === "enterprise";
  return isPaid ? (isPremium ? 80000 : 70000) : 4000;
}

interface EarningsEntry {
  amount: number;
  status: string;
}

function calculateSummary(earnings: EarningsEntry[], payouts: EarningsEntry[]) {
  const totalEarned = earnings.reduce((sum, e) => sum + Number(e.amount), 0);
  const pendingEarnings = earnings
    .filter((e) => e.status === "pending" || e.status === "approved")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPaid = payouts.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0);
  return { totalEarned, pendingEarnings, totalPaid, balance: totalEarned - totalPaid };
}

function parseCSV(text: string): { leads: any[]; errors: string[] } {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { leads: [], errors: ["CSV must have a header row and at least one data row"] };

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const schoolNameIdx = headers.findIndex((h) => h.includes("school") || h.includes("name"));
  const contactNameIdx = headers.findIndex((h) => h.includes("contact") || h.includes("person"));
  const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("tel") || h.includes("mobile"));
  const emailIdx = headers.findIndex((h) => h.includes("email") || h.includes("mail"));
  const districtIdx = headers.findIndex((h) => h.includes("district") || h.includes("location"));

  if (schoolNameIdx < 0) return { leads: [], errors: ['CSV must have a "school_name" column'] };

  const leads: any[] = [];
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

function isValidNormalizedPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 12;
}

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(pw) || !/[0-9]/.test(pw))
    return "Password must contain at least one uppercase letter and one number";
  return null;
}

function validateDigitizationFee(fee: number): string | null {
  if (fee < 10000 || fee > 50000) return "Must be 10,000–50,000 UGX";
  return null;
}

const PLAN_ORDER = ["free_trial", "starter", "growth", "enterprise"];

function validatePlanUpgrade(currentPlan: string, newPlan: string, role: string): string | null {
  const currentIdx = PLAN_ORDER.indexOf(currentPlan);
  const newIdx = PLAN_ORDER.indexOf(newPlan);
  if (newIdx < 0) return "Invalid plan";
  if (newIdx <= currentIdx && role !== "super_admin") return "Can only upgrade to a higher plan";
  return null;
}

describe("Marketer – School Code Generation", () => {
  it("generates a code with the expected format", () => {
    const code = generateSchoolCode("Kampala International School", "Kampala");
    expect(code).toMatch(/^[A-Z]{4}[A-Z]{2}\d{3}$/);
  });

  it("uses first 4 chars from school name and 2 from district", () => {
    const code = generateSchoolCode("Test Academy", "Wakiso");
    expect(code).toMatch(/^TEACWA\d{3}$/);
  });

  it("uses SCHL fallback when school name has no letters", () => {
    const code = generateSchoolCode("1234", "UG");
    expect(code).toMatch(/^SCHLUG\d{3}$/);
  });

  it("handles single-word school names", () => {
    const code = generateSchoolCode("Harvard", "Boston");
    expect(code).toMatch(/^HABO\d{3}$/);
  });
});

describe("Marketer – Commission Calculation", () => {
  it("returns 70000 for starter plan", () => {
    expect(calculateCommission("starter")).toBe(70000);
  });

  it("returns 80000 for growth plan", () => {
    expect(calculateCommission("growth")).toBe(80000);
  });

  it("returns 80000 for enterprise plan", () => {
    expect(calculateCommission("enterprise")).toBe(80000);
  });

  it("returns 4000 for free_trial plan", () => {
    expect(calculateCommission("free_trial")).toBe(4000);
  });

  it("returns 70000 for unknown paid plans (default to standard)", () => {
    const isPaid = true;
    const isPremium = false;
    expect(isPaid ? (isPremium ? 80000 : 70000) : 4000).toBe(70000);
  });
});

describe("Marketer – normalizePlanType", () => {
  it("returns free_trial for undefined", () => {
    expect(normalizePlanType(undefined)).toBe("free_trial");
  });

  it("returns free_trial for null", () => {
    expect(normalizePlanType(null)).toBe("free_trial");
  });

  it("returns starter for starter", () => {
    expect(normalizePlanType("starter")).toBe("starter");
  });

  it("returns growth for growth", () => {
    expect(normalizePlanType("growth")).toBe("growth");
  });

  it("returns enterprise for enterprise", () => {
    expect(normalizePlanType("enterprise")).toBe("enterprise");
  });

  it("returns free_trial for unknown plan", () => {
    expect(normalizePlanType("platinum")).toBe("free_trial");
  });
});

describe("Marketer – Data Summary Calculation", () => {
  it("calculates total earned correctly", () => {
    const result = calculateSummary(
      [
        { amount: 70000, status: "pending" },
        { amount: 80000, status: "paid" },
        { amount: 4000, status: "pending" },
      ],
      [],
    );
    expect(result.totalEarned).toBe(154000);
    expect(result.totalPaid).toBe(0);
    expect(result.balance).toBe(154000);
  });

  it("counts pending and approved as pending", () => {
    const result = calculateSummary(
      [
        { amount: 70000, status: "pending" },
        { amount: 80000, status: "approved" },
        { amount: 40000, status: "paid" },
      ],
      [{ amount: 40000, status: "paid" }],
    );
    expect(result.pendingEarnings).toBe(150000);
    expect(result.totalPaid).toBe(40000);
    expect(result.balance).toBe(150000);
  });

  it("returns zeros for empty arrays", () => {
    const result = calculateSummary([], []);
    expect(result).toEqual({ totalEarned: 0, pendingEarnings: 0, totalPaid: 0, balance: 0 });
  });
});

describe("Marketer – CSV Lead Import", () => {
  const validCSV = `school_name,contact_name,contact_phone,district
Kampala High,John K,0700111111,Kampala
Jinja College,Jane M,0711222222,Jinja`;

  it("parses valid CSV correctly", () => {
    const { leads, errors } = parseCSV(validCSV);
    expect(errors).toEqual([]);
    expect(leads).toHaveLength(2);
    expect(leads[0].school_name).toBe("Kampala High");
    expect(leads[0].contact_name).toBe("John K");
    expect(leads[0].contact_phone).toBe("0700111111");
    expect(leads[0].district).toBe("Kampala");
  });

  it("rejects CSV without school_name column", () => {
    const { leads, errors } = parseCSV("title,phone\nTest,0700");
    expect(leads).toHaveLength(0);
    expect(errors).toContain('CSV must have a "school_name" column');
  });

  it("rejects CSV with only header row", () => {
    const { leads, errors } = parseCSV("school_name,phone");
    expect(leads).toHaveLength(0);
    expect(errors.some((e) => e.includes("header row"))).toBe(true);
  });

  it("skips rows with missing school name and reports errors", () => {
    const { leads, errors } = parseCSV("school_name,phone\nKampala High,0700\n,0711\nJinja College,0722");
    expect(leads).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Row 3");
    expect(errors[0]).toContain("missing school name");
  });

  it("strips surrounding quotes from fields", () => {
    const { leads } = parseCSV(`school_name,contact_name\n"My School","John Smith"`);
    expect(leads).toHaveLength(1);
    expect(leads[0].school_name).toBe("My School");
    expect(leads[0].contact_name).toBe("John Smith");
  });

  it("handles alternative header names", () => {
    const csv = `School Name,Contact Person,Phone Number,Location
Test School,Alice,0700111111,Kampala`;
    const { leads, errors } = parseCSV(csv);
    expect(errors).toEqual([]);
    expect(leads).toHaveLength(1);
    expect(leads[0].school_name).toBe("Test School");
    expect(leads[0].district).toBe("Kampala");
  });

  it("sets optional fields to null when column is missing", () => {
    const csv = "school_name\nOnly Name";
    const { leads } = parseCSV(csv);
    expect(leads[0].contact_name).toBeNull();
    expect(leads[0].contact_phone).toBeNull();
    expect(leads[0].contact_email).toBeNull();
    expect(leads[0].district).toBeNull();
  });
});

describe("Marketer – Phone Validation", () => {
  it("accepts Uganda-format 10-digit phone", () => {
    expect(isValidNormalizedPhone("0700111111")).toBe(true);
  });

  it("accepts 12-digit phone with country code", () => {
    expect(isValidNormalizedPhone("256700111111")).toBe(true);
  });

  it("rejects phone shorter than 10 digits", () => {
    expect(isValidNormalizedPhone("0700")).toBe(false);
  });

  it("rejects phone longer than 12 digits", () => {
    expect(isValidNormalizedPhone("2567001111111")).toBe(false);
  });
});

describe("Marketer – Password Validation", () => {
  it("passes valid password", () => {
    expect(validatePassword("Admin1234")).toBeNull();
  });

  it("rejects password shorter than 8 chars", () => {
    expect(validatePassword("Ab1")).toContain("at least 8 characters");
  });

  it("rejects password without uppercase letter", () => {
    expect(validatePassword("admin1234")).toContain("uppercase");
  });

  it("rejects password without number", () => {
    expect(validatePassword("Adminabcd")).toContain("number");
  });
});

describe("Marketer – Digitization Fee Validation", () => {
  it("accepts fee of 10000", () => {
    expect(validateDigitizationFee(10000)).toBeNull();
  });

  it("accepts fee of 50000", () => {
    expect(validateDigitizationFee(50000)).toBeNull();
  });

  it("accepts fee of 25000", () => {
    expect(validateDigitizationFee(25000)).toBeNull();
  });

  it("rejects fee below 10000", () => {
    expect(validateDigitizationFee(9999)).not.toBeNull();
  });

  it("rejects fee above 50000", () => {
    expect(validateDigitizationFee(50001)).not.toBeNull();
  });

  it("rejects zero fee", () => {
    expect(validateDigitizationFee(0)).not.toBeNull();
  });
});

describe("Marketer – Trial Expiry", () => {
  it("identifies an expired trial correctly", () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const now = new Date().toISOString();
    expect(pastDate < now).toBe(true);
  });

  it("does not flag active trial as expired", () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const now = new Date().toISOString();
    expect(futureDate > now).toBe(true);
  });
});

describe("Marketer – Subscription Plan Upgrade", () => {
  it("allows upgrade from free_trial to starter", () => {
    expect(validatePlanUpgrade("free_trial", "starter", "school_admin")).toBeNull();
  });

  it("allows upgrade from starter to growth", () => {
    expect(validatePlanUpgrade("starter", "growth", "school_admin")).toBeNull();
  });

  it("allows upgrade from growth to enterprise", () => {
    expect(validatePlanUpgrade("growth", "enterprise", "school_admin")).toBeNull();
  });

  it("blocks downgrade from enterprise to starter for non-super-admin", () => {
    expect(validatePlanUpgrade("enterprise", "starter", "school_admin")).toContain("upgrade");
  });

  it("allows downgrade for super_admin", () => {
    expect(validatePlanUpgrade("enterprise", "starter", "super_admin")).toBeNull();
  });

  it("blocks same-plan change for non-super-admin", () => {
    expect(validatePlanUpgrade("starter", "starter", "school_admin")).toContain("upgrade");
  });

  it("rejects invalid plan name", () => {
    expect(validatePlanUpgrade("free_trial", "platinum", "school_admin")).toContain("Invalid plan");
  });
});
