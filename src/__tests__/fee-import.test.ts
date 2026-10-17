import {
  buildFeeTemplateCsv,
  FEE_TEMPLATE_HEADERS,
  feeStructureKey,
  feeStructureToCsv,
  normalizeBoardingStatus,
  normalizeFeeCategory,
  normalizeFeeDate,
  normalizeFeeFrequency,
  parseFeeRows,
  validateFeeRow,
} from "@/lib/import/fees";

describe("fee import template", () => {
  it("ships a header row only so nothing is created by accident", () => {
    const csv = buildFeeTemplateCsv();
    expect(csv).toBe(FEE_TEMPLATE_HEADERS.join(","));
    expect(csv.split("\n")).toHaveLength(1);
  });
});

describe("validateFeeRow", () => {
  it("reads a fully specified row and normalises every column", () => {
    const result = validateFeeRow({
      Item: "Lunch & Porridge",
      Class: "P.1",
      "Amount (UGX)": "45,000",
      Term: "Term 2",
      Category: "Feeding",
      "Applies To": "Day Scholars",
      Frequency: "Termly",
      Zone: "Zone 1",
      "Due Date": "15/03/2026",
      "Academic Year": "2026",
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data).toMatchObject({
      name: "Lunch & Porridge",
      class_name: "P.1",
      amount: "45000",
      term: "2",
      category: "meals",
      boarding_status: "day",
      frequency: "per_term",
      transport_zone: "Zone 1",
      due_date: "2026-03-15",
      academic_year: "2026",
    });
  });

  it("reports a missing name and a non-positive amount", () => {
    const result = validateFeeRow({ Class: "P.1", "Amount (UGX)": "0" });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Fee name is required");
    expect(result.errors).toContain("Amount must be greater than 0");
  });

  it("requires an amount", () => {
    const result = validateFeeRow({ "Fee Name": "Tuition" });
    expect(result.errors).toContain("Amount is required");
  });

  it("does not demand a term on a one-off fee", () => {
    const result = validateFeeRow({ "Fee Name": "Development", Amount: "50000", Frequency: "One-off" });
    expect(result.isValid).toBe(true);
    expect(result.data.term).toBe("");
    expect(result.data.frequency).toBe("one_off");
  });
});

describe("column normalisation", () => {
  it("matches fee categories by keyword and falls back to other", () => {
    expect(normalizeFeeCategory("School Fees")).toBe("tuition");
    expect(normalizeFeeCategory("Lunch & Porridge")).toBe("meals");
    expect(normalizeFeeCategory("Transport (Zone 2)")).toBe("transport");
    expect(normalizeFeeCategory("")).toBe("tuition");
    expect(normalizeFeeCategory("Something unusual")).toBe("other");
  });

  it("reads boarding status in common phrasings", () => {
    expect(normalizeBoardingStatus("Boarders")).toBe("boarding");
    expect(normalizeBoardingStatus("Day Scholars")).toBe("day");
    expect(normalizeBoardingStatus("Day & Boarding")).toBe("both");
    expect(normalizeBoardingStatus("")).toBe("both");
  });

  it("reads frequency in common phrasings", () => {
    expect(normalizeFeeFrequency("Annual")).toBe("per_year");
    expect(normalizeFeeFrequency("One off")).toBe("one_off");
    expect(normalizeFeeFrequency("Termly")).toBe("per_term");
    expect(normalizeFeeFrequency("")).toBe("per_term");
  });

  it("allows a future due date but rejects an impossible one", () => {
    expect(normalizeFeeDate("2026-03-15").value).toBe("2026-03-15");
    expect(normalizeFeeDate("15/03/2026").value).toBe("2026-03-15");
    expect(normalizeFeeDate("32/01/2026").error).toBeTruthy();
    expect(normalizeFeeDate("").value).toBe("");
  });
});

describe("feeStructureToCsv", () => {
  it("writes a header and one row per fee, resolving the class name", () => {
    const csv = feeStructureToCsv(
      [
        {
          name: "Tuition",
          class_id: "c1",
          amount: 500000,
          term: 1,
          category: "tuition",
          boarding_status: "day",
          frequency: "per_term",
          academic_year: "2026",
        },
      ],
      [{ id: "c1", name: "P.1" }],
    );

    const lines = csv.split("\n");
    expect(lines[0]).toBe(FEE_TEMPLATE_HEADERS.join(","));
    expect(lines[1]).toContain("Tuition,P.1,500000,1,Tuition,Day,Per Term");
  });

  it("round-trips through the importer without losing a value", () => {
    const csv = feeStructureToCsv(
      [
        {
          name: "Lunch, Snacks & Porridge",
          class_id: null,
          amount: 45000,
          term: null,
          category: "meals",
          boarding_status: "both",
          frequency: "one_off",
          transport_zone: "",
          due_date: "2026-03-15",
          academic_year: "2026",
        },
      ],
      [],
    );

    const row = csv.split("\n")[1];
    const parsed = parseFeeRows([Object.fromEntries(FEE_TEMPLATE_HEADERS.map((h, i) => [h, splitCsvRow(row)[i]]))])[0];

    expect(parsed.isValid).toBe(true);
    expect(parsed.data).toMatchObject({
      name: "Lunch, Snacks & Porridge",
      class_name: "",
      amount: "45000",
      category: "meals",
      boarding_status: "both",
      frequency: "one_off",
      due_date: "2026-03-15",
      academic_year: "2026",
    });
  });
});

function splitCsvRow(row: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (quoted) {
      if (ch === '"' && row[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

describe("feeStructureKey", () => {
  it("treats the same fee on the same terms as one entry", () => {
    const a = feeStructureKey("Tuition", "class-1", 2, "2026");
    expect(a).toBe(feeStructureKey("  tuition ", "class-1", 2, "2026"));
  });

  it("separates all-classes fees from class-specific ones", () => {
    expect(feeStructureKey("Tuition", "", 2, "2026")).not.toBe(feeStructureKey("Tuition", "class-1", 2, "2026"));
  });
});
