import { brandPalette, normalizeHexColor } from "@/lib/report-brand";
import { suggestClassTeacherRemark, suggestHeadTeacherRemark } from "@/lib/report-remarks";

/**
 * schools.primary_color is typed by a headmaster and interpolated straight into
 * a style="..." attribute on every printed page. These are the boundaries that
 * stops that being an injection point, plus the rules for turning a screen
 * colour into something legible on paper.
 */

describe("normalizeHexColor", () => {
  it("accepts plain hex and returns it normalised", () => {
    expect(normalizeHexColor("#1e3a5f")).toBe("#1e3a5f");
    expect(normalizeHexColor("1E3A5F")).toBe("#1e3a5f");
    expect(normalizeHexColor("#abc")).toBe("#aabbcc");
    expect(normalizeHexColor("  #fff  ")).toBe("#ffffff");
  });

  it("rejects anything that is not a hex colour", () => {
    for (const bad of [
      "",
      "red",
      "#12345",
      "rgb(1,2,3)",
      "#fff; background:url(http://x)",
      "javascript:alert(1)",
      "var(--x)",
      "#1234567",
    ]) {
      expect(normalizeHexColor(bad)).toBeNull();
    }
  });

  it("rejects non-strings", () => {
    expect(normalizeHexColor(null)).toBeNull();
    expect(normalizeHexColor(undefined)).toBeNull();
  });
});

describe("brandPalette", () => {
  it("keeps a colour that is already dark enough", () => {
    const brand = brandPalette("#1e3a5f");
    expect(brand.ink).toBe("#1e3a5f");
    expect(brand.isBrand).toBe(false);
  });

  it("darkens a pale colour until it can be read as a rule on white", () => {
    const brand = brandPalette("#fde68a");
    expect(brand.isBrand).toBe(true);
    expect(brand.ink).not.toBe("#fde68a");
    // Every channel must have come down, and the result must be genuinely dark.
    expect(brand.ink).toMatch(/^#[0-9a-f]{6}$/);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(brand.ink.slice(i, i + 2), 16));
    expect(Math.max(r, g, b)).toBeLessThan(140);
  });

  it("falls back to the default navy for an unusable colour, and says so", () => {
    const brand = brandPalette("not-a-colour");
    expect(brand.ink).toBe("#1e3a5f");
    expect(brand.isBrand).toBe(false);
  });

  it("always returns a wash lighter than its ink", () => {
    for (const colour of ["#1e3a5f", "#7c3aed", "#fde68a", "bad"]) {
      const { ink, wash } = brandPalette(colour);
      expect(ink).toMatch(/^#[0-9a-f]{6}$/);
      expect(wash).toMatch(/^#[0-9a-f]{6}$/);
      const lum = (hex: string) => {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      expect(lum(wash)).toBeGreaterThan(lum(ink));
    }
  });
});

describe("suggestClassTeacherRemark", () => {
  const base = {
    pupilName: "Amina Nakato",
    className: "P.5 Blue",
    position: 3,
    classSize: 40,
    attendancePresent: 58,
    attendanceTotal: 62,
    average: 77,
    division: "DIV 2",
    subjects: [
      { name: "English", avg: 83, grade: "D2" },
      { name: "Mathematics", avg: 44, grade: "P8" },
    ],
  };

  it("names the pupil, their attendance and their average", () => {
    const text = suggestClassTeacherRemark(base);
    expect(text).toContain("Amina");
    expect(text).toContain("58 out of 62 days");
    expect(text).toContain("77%");
  });

  it("names a strength and a weakness rather than a generic verdict", () => {
    const text = suggestClassTeacherRemark(base);
    expect(text).toContain("English");
    expect(text).toContain("Mathematics");
  });

  it("mentions improvement or decline when a previous term is known", () => {
    expect(suggestClassTeacherRemark({ ...base, previousAverage: 65 })).toMatch(/improvement of 12/);
    expect(suggestClassTeacherRemark({ ...base, previousAverage: 88 })).toMatch(/below last term/);
  });

  it("says nothing about a previous term when it is not recorded", () => {
    expect(suggestClassTeacherRemark(base)).not.toMatch(/last term/);
  });

  it("survives missing attendance and marks", () => {
    const text = suggestClassTeacherRemark({
      pupilName: "Kato",
      attendancePresent: null,
      attendanceTotal: null,
      average: null,
      subjects: [],
    });
    expect(text).toContain("Kato");
    expect(text).not.toContain("null");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("NaN");
  });
});

describe("suggestHeadTeacherRemark", () => {
  it("is shorter and different from the class teacher's line", () => {
    const facts = {
      pupilName: "Amina Nakato",
      position: 2,
      attendancePresent: 60,
      attendanceTotal: 62,
      average: 81,
      division: "DIV 1",
      subjects: [],
    };
    const head = suggestHeadTeacherRemark(facts);
    const teacher = suggestClassTeacherRemark(facts);
    expect(head).not.toBe(teacher);
    expect(head).toContain("60 of 62 days");
    expect(head.length).toBeLessThan(teacher.length);
  });
});