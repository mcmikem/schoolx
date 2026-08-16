import { describe, it, expect } from "@jest/globals";
import {
  normalizeHeader,
  parseDelimitedText,
  parseStudentRows,
  normalizeGender,
  mapRowKeys,
} from "@/lib/import/students";

describe("normalizeHeader", () => {
  it("maps friendly Excel/Word headers to canonical fields", () => {
    expect(normalizeHeader("First Name")).toBe("first_name");
    expect(normalizeHeader("Surname")).toBe("last_name");
    expect(normalizeHeader("Sex")).toBe("gender");
    expect(normalizeHeader("Date of Birth")).toBe("date_of_birth");
    expect(normalizeHeader("DOB")).toBe("date_of_birth");
    expect(normalizeHeader("Parent/Guardian Name")).toBe("parent_name");
    expect(normalizeHeader("Father's Name")).toBe("parent_name");
    expect(normalizeHeader("Mother's Phone")).toBe("parent_phone");
    expect(normalizeHeader("Class")).toBe("class_name");
    expect(normalizeHeader("Adm No.")).toBe("student_number");
    expect(normalizeHeader("PLE Index")).toBe("ple_index_number");
  });

  it("maps legacy snake_case headers used by the old CSV template", () => {
    expect(normalizeHeader("first_name")).toBe("first_name");
    expect(normalizeHeader("last_name")).toBe("last_name");
    expect(normalizeHeader("parent_phone")).toBe("parent_phone");
    expect(normalizeHeader("student_number")).toBe("student_number");
  });

  it("returns null for unknown headers", () => {
    expect(normalizeHeader("Random Column")).toBeNull();
    expect(normalizeHeader("")).toBeNull();
  });
});

describe("mapRowKeys", () => {
  it("assigns two distinct phone columns to phone + phone2", () => {
    const keys = mapRowKeys({ "Phone 1": "", "Phone 2": "" });
    expect(keys.parent_phone).toBe("Phone 1");
    expect(keys.parent_phone2).toBe("Phone 2");
  });
});

describe("normalizeGender", () => {
  it("accepts common variants", () => {
    expect(normalizeGender("M")).toBe("M");
    expect(normalizeGender("male")).toBe("M");
    expect(normalizeGender("F")).toBe("F");
    expect(normalizeGender("FEMALE")).toBe("F");
    expect(normalizeGender("Unknown")).toBe("");
    expect(normalizeGender("")).toBe("");
  });
});

describe("parseDelimitedText", () => {
  it("parses comma CSV with quoted fields", () => {
    const text = 'First Name,Last Name,Gender,Phone\n"John",Doe,M,0700000001\nMary,Smith,F,0700000002';
    const rows = parseDelimitedText(text);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ "First Name": "John", "Last Name": "Doe", Gender: "M", Phone: "0700000001" });
    expect(rows[1]["Last Name"]).toBe("Smith");
  });

  it("detects tab-delimited text (e.g. Word table export)", () => {
    const text = "First Name\tLast Name\tGender\nJohn\tMukasa\tM\nSarah\tNakato\tF";
    const rows = parseDelimitedText(text);
    expect(rows).toHaveLength(2);
    expect(rows[0]["Last Name"]).toBe("Mukasa");
  });

  it("returns an empty array when there is no header row", () => {
    expect(parseDelimitedText("just some text")).toEqual([]);
  });
});

describe("parseStudentRows", () => {
  it("marks a complete row as valid with normalized gender", () => {
    const [row] = parseStudentRows([
      {
        "First Name": "Sarah",
        "Last Name": "Nakato",
        Gender: "female",
        "Parent Phone": "0701234567",
      },
    ]);
    expect(row.isValid).toBe(true);
    expect(row.errors).toEqual([]);
    expect(row.data.gender).toBe("F");
    expect(row.data.parent_phone).toBe("0701234567");
  });

  it("flags rows missing required fields", () => {
    const [row] = parseStudentRows([{ "First Name": "John", Gender: "M" }]);
    expect(row.isValid).toBe(false);
    expect(row.errors).toContain("Missing last name");
  });

  it("flags invalid gender", () => {
    const [row] = parseStudentRows([{ "First Name": "John", "Last Name": "Doe", Gender: "Unknown" }]);
    expect(row.isValid).toBe(false);
    expect(row.errors.some((e) => e.includes("Invalid gender"))).toBe(true);
  });

  it("flags overly short phone numbers", () => {
    const [row] = parseStudentRows([{ "First Name": "John", "Last Name": "Doe", Gender: "M", Phone: "123" }]);
    expect(row.isValid).toBe(false);
    expect(row.errors).toContain("Phone number looks too short");
  });

  it("splits a single full-name column into first and last name", () => {
    const [row] = parseStudentRows([{ Name: "John Mukasa", Gender: "M" }]);
    expect(row.data.first_name).toBe("John");
    expect(row.data.last_name).toBe("Mukasa");
    expect(row.isValid).toBe(true);
  });

  it("maps a single-name cell as both first and last name", () => {
    const [row] = parseStudentRows([{ Name: "Esther", Gender: "F" }]);
    expect(row.data.first_name).toBe("Esther");
    expect(row.data.last_name).toBe("Esther");
  });

  it("maps class and student number aliases", () => {
    const [row] = parseStudentRows([
      { "First Name": "John", "Last Name": "Doe", Gender: "M", Class: "P.5", "Adm No.": "001" },
    ]);
    expect(row.data.class_name).toBe("P.5");
    expect(row.data.student_number).toBe("001");
  });

  it("returns an empty array for non-array input", () => {
    expect(parseStudentRows(null as unknown as Array<Record<string, unknown>>)).toEqual([]);
  });
});
