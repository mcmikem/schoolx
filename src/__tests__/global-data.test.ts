import { describe, it, expect } from "@jest/globals";
import { normalizeAuthPhone } from "@/lib/validation";
import { mapParentStudentLinks, resolveSelectedChild } from "@/lib/parent-portal";

describe("Global Data Quality — Multi-Tenant", () => {
  describe("1. Class Assignment", () => {
    it("migration assigns orphaned students to a default class", () => {
      const migration = require("fs").readFileSync(
        require("path").join(process.cwd(), "supabase/migrations/202611010008_assign_missing_classes.sql"),
        "utf8",
      );
      expect(migration).toMatch(/UPDATE\s+students\s+SET\s+class_id/i);
      expect(migration).toMatch(/WHERE\s+class_id\s+IS\s+NULL/i);
    });

    it("mapParentStudentLinks falls back to 'Unassigned' when class is null", () => {
      const children = mapParentStudentLinks([
        {
          student: {
            id: "stu-no-class",
            first_name: "Orphan",
            last_name: "Student",
            school_id: "sch-1",
            class_id: undefined,
            class: null,
            photo_url: null,
          },
        },
      ]);
      expect(children).toHaveLength(1);
      expect(children[0].class_name).toBe("Unassigned");
      expect(children[0].photo_url).toBeNull();
    });

    it("mapParentStudentLinks reads class name from nested relation", () => {
      const children = mapParentStudentLinks([
        {
          student: {
            id: "stu-1",
            first_name: "Alice",
            last_name: "N.",
            school_id: "sch-1",
            class_id: "cls-1",
            class: { name: "P.5 Blue" },
            photo_url: "https://example.com/photo.jpg",
          },
        },
      ]);
      expect(children[0].class_name).toBe("P.5 Blue");
      expect(children[0].photo_url).toBe("https://example.com/photo.jpg");
    });

    it("resolveSelectedChild returns first child when none selected", () => {
      const children = [{ id: "c1", first_name: "A", last_name: "B", class_name: "P.1" }];
      expect(resolveSelectedChild(children, null)?.id).toBe("c1");
      expect(resolveSelectedChild(children, "missing")).toBeNull();
      expect(resolveSelectedChild([], "c1")).toBeNull();
    });
  });

  describe("2. Phone Number Normalization", () => {
    it("normalizeAuthPhone strips non-digits and produces 256XXXXXXXXX format", () => {
      expect(normalizeAuthPhone("0770123456")).toBe("256770123456");
      expect(normalizeAuthPhone("+256 770 123 456")).toBe("256770123456");
      expect(normalizeAuthPhone("770123456")).toBe("256770123456");
      expect(normalizeAuthPhone("")).toBe("");
    });

    it("migration normalizes to 256XXXXXXXXX format", () => {
      const migration = require("fs").readFileSync(
        require("path").join(process.cwd(), "supabase/migrations/20260622_normalize_parent_phones.sql"),
        "utf8",
      );
      expect(migration).toContain("normalize_uganda_phone");
      expect(migration).toMatch(/UPDATE.*students\s+SET\s+parent_phone/i);
    });

    it("normalizeAuthPhone handles edge cases", () => {
      expect(normalizeAuthPhone("256770123456")).toBe("256770123456");
      expect(normalizeAuthPhone("  0770 123 456  ")).toBe("256770123456");
    });
  });

  describe("3. Student Profile Updates", () => {
    it("StudentDetailPanel edit form includes blood_type field", () => {
      const panel = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/components/students/StudentDetailPanel.tsx"),
        "utf8",
      );
      expect(panel).toMatch(/blood_type/);
      expect(panel).toContain("A+");
      expect(panel).toContain("O-");
    });

    it("dashboard student profile uses StudentDetailPanel for editing", () => {
      const page = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/dashboard/students/[id]/page.tsx"),
        "utf8",
      );
      expect(page).toContain("StudentDetailPanel");
      expect(page).toContain("handleProfileUpdate");
    });

    it("StudentDetailPanel accepts blood_type in update payload", () => {
      const panel = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/components/students/StudentDetailPanel.tsx"),
        "utf8",
      );
      expect(panel).toMatch(/blood_type:\s*editForm\.blood_type/);
    });
  });

  describe("4. Placeholder Avatars", () => {
    it("parent portal child selector shows photo_url when available", () => {
      const portal = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/parent-portal/page.tsx"),
        "utf8",
      );
      expect(portal).toContain("child.photo_url");
    });

    it("student profile page shows initials when no photo_url", () => {
      const profile = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/app/dashboard/students/[id]/page.tsx"),
        "utf8",
      );
      expect(profile).toContain("photo_url");
      expect(profile).toContain("first_name?.[0]");
    });

    it("StudentPhotoField shows owl mascot when no photo", () => {
      const field = require("fs").readFileSync(
        require("path").join(process.cwd(), "src/components/students/StudentPhotoField.tsx"),
        "utf8",
      );
      expect(field).toContain("OwlMascot");
      expect(field).toContain("photoUrl");
    });
  });

  describe("5. Seed Scripts", () => {
    it("client-side seed script generates fee payments for demo students", () => {
      const seed = require("fs").readFileSync(require("path").join(process.cwd(), "src/lib/seed-demo.ts"), "utf8");
      expect(seed).toContain("fee_payments");
      expect(seed).toContain("student_fee_terms");
    });

    it("CLI seed script generates fee payments for demo students", () => {
      const seed = require("fs").readFileSync(require("path").join(process.cwd(), "scripts/seed-demo.ts"), "utf8");
      expect(seed).toContain("fee_payments");
    });
  });
});
