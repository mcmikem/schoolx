import { getTemplateSubjects, NURSERY_TEMPLATE } from "@/lib/curriculum-templates";
import { buildDefaultClasses, buildDefaultTimetableSlots, inferClassLevel } from "@/lib/school-setup";

describe("school setup defaults", () => {
  test("builds primary classes from school type", () => {
    const classes = buildDefaultClasses("school-1", "primary", "2026");

    expect(classes).toHaveLength(7);
    expect(classes[0]).toMatchObject({
      school_id: "school-1",
      name: "P.1",
      level: "P.1",
      academic_year: "2026",
    });
    expect(classes[classes.length - 1]?.name).toBe("P.7");
  });

  test("builds combined classes from school type", () => {
    const classes = buildDefaultClasses("school-1", "combined", "2026");

    expect(classes.some((cls) => cls.name === "P.1")).toBe(true);
    expect(classes.some((cls) => cls.name === "S.6")).toBe(true);
  });

  test("does not seed nursery classes unless the school opted in", () => {
    const primary = buildDefaultClasses("school-1", "primary", "2026");
    const combined = buildDefaultClasses("school-1", "combined", "2026");

    expect(primary).toHaveLength(7);
    expect(primary.some((cls) => cls.level === "nursery")).toBe(false);
    expect(combined.some((cls) => cls.level === "nursery")).toBe(false);
  });

  test("seeds Baby, Middle and Top Class first when nursery is opted in", () => {
    const classes = buildDefaultClasses("school-1", "primary", "2026", { nursery: true });

    expect(classes).toHaveLength(10);
    expect(classes.slice(0, 3)).toEqual([
      {
        school_id: "school-1",
        name: "Baby Class",
        level: "nursery",
        stream: null,
        academic_year: "2026",
        max_students: 60,
      },
      {
        school_id: "school-1",
        name: "Middle Class",
        level: "nursery",
        stream: null,
        academic_year: "2026",
        max_students: 60,
      },
      {
        school_id: "school-1",
        name: "Top Class",
        level: "nursery",
        stream: null,
        academic_year: "2026",
        max_students: 60,
      },
    ]);
    expect(classes.some((cls) => cls.name === "P.1")).toBe(true);
    expect(classes.some((cls) => cls.name === "P.7")).toBe(true);
  });

  test("adds nursery to combined schools but never to a pure secondary school", () => {
    const combined = buildDefaultClasses("school-1", "combined", "2026", { nursery: true });
    const secondary = buildDefaultClasses("school-1", "secondary", "2026", { nursery: true });

    expect(combined).toHaveLength(16);
    expect(combined.some((cls) => cls.name === "Top Class")).toBe(true);
    expect(combined.some((cls) => cls.name === "S.6")).toBe(true);

    expect(secondary).toHaveLength(6);
    expect(secondary.some((cls) => cls.level === "nursery")).toBe(false);
  });

  test("seeds pre-primary subjects only when nursery is opted in", () => {
    const withoutNursery = getTemplateSubjects("primary");
    const withNursery = getTemplateSubjects("primary", { nursery: true });

    expect(withoutNursery.some((s) => s.name === "Environmental Activities")).toBe(false);
    expect(withNursery.some((s) => s.name === "Environmental Activities")).toBe(true);
    expect(withNursery.some((s) => s.name === "Language")).toBe(true);

    // Nursery and primary both teach Mathematics — one subject, not two.
    expect(withNursery.filter((s) => s.name === "Mathematics")).toHaveLength(1);
    expect(withNursery.filter((s) => s.code === "MTC")).toHaveLength(1);

    expect(getTemplateSubjects("secondary", { nursery: true }).some((s) => s.name === "Language")).toBe(false);
  });

  test("nursery subjects stay inside the subjects.level DB check constraint", () => {
    // subjects.level is CHECK (level IN ('primary','secondary','both')) — a
    // 'nursery' value here would look right and then fail every insert.
    const dbAllowedLevels = ["primary", "secondary", "both"];
    const offending = NURSERY_TEMPLATE.subjects.filter((s) => !dbAllowedLevels.includes(s.level)).map((s) => s.code);

    expect({ offending }).toEqual({ offending: [] });
  });

  test("nursery classes are grouped under a single recognisable level", () => {
    const grouped = NURSERY_TEMPLATE.classes.map((cls) => `${cls.name}:${cls.level}`);

    expect(grouped).toEqual(["Baby Class:nursery", "Middle Class:nursery", "Top Class:nursery"]);
  });

  test("infers nursery levels from the names schools actually type", () => {
    expect(inferClassLevel("Baby Class", "primary")).toBe("nursery");
    expect(inferClassLevel("Middle Class", "primary")).toBe("nursery");
    expect(inferClassLevel("Top Class", "primary")).toBe("nursery");
    expect(inferClassLevel("baby", "combined")).toBe("nursery");
    expect(inferClassLevel("PP1", "primary")).toBe("nursery");
    expect(inferClassLevel("Pre-Primary", "primary")).toBe("nursery");

    // P.1-style names must not be swallowed by the nursery rule.
    expect(inferClassLevel("P7", "primary")).toBe("P.7");
    expect(inferClassLevel("S.3", "secondary")).toBe("S.3");
    expect(inferClassLevel("P.1", "primary")).toBe("P.1");
  });

  test("infers levels and creates timetable slots", () => {
    expect(inferClassLevel("P7", "primary")).toBe("P.7");
    expect(inferClassLevel("S.3", "secondary")).toBe("S.3");

    const slots = buildDefaultTimetableSlots("school-1");
    expect(slots).toHaveLength(9);
    expect(slots[0]).toMatchObject({
      school_id: "school-1",
      name: "Period 1",
      is_lesson: true,
      order_number: 1,
    });
    expect(slots.some((slot) => slot.name === "Break" && !slot.is_lesson)).toBe(true);
  });
});
