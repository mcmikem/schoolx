import {
  buildDefaultClasses,
  buildDefaultTimetableSlots,
  inferClassLevel,
} from "@/lib/school-setup";

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
