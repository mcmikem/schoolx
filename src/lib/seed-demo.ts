import { supabase } from "./supabase";

const DEMO_SCHOOL_ID = "00000000-0000-0000-0000-000000000001";

export async function seedDemoData() {
  if (!supabase) return { error: "Supabase client not initialized" };

  try {
    // 1. Ensure Demo School exists
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .upsert(
        {
          id: DEMO_SCHOOL_ID,
          name: "Omuto Demo Academy",
          school_code: "DEMO-001",
          district: "Wakiso",
          school_type: "primary",
          ownership: "private",
          subscription_status: "trial",
          primary_color: "#001F3F",
        },
        { onConflict: "id" },
      )
      .select()
      .single();

    if (schoolError) throw schoolError;

    // 2. Add Classes
    const classes = [
      {
        school_id: DEMO_SCHOOL_ID,
        name: "P.1 Blue",
        level: "P.1",
        academic_year: "2026",
      },
      {
        school_id: DEMO_SCHOOL_ID,
        name: "P.2 Red",
        level: "P.2",
        academic_year: "2026",
      },
      {
        school_id: DEMO_SCHOOL_ID,
        name: "P.3 Green",
        level: "P.3",
        academic_year: "2026",
      },
      {
        school_id: DEMO_SCHOOL_ID,
        name: "P.7 candidates",
        level: "P.7",
        academic_year: "2026",
      },
    ];

    const { data: createdClasses, error: classError } = await supabase
      .from("classes")
      .upsert(classes, { onConflict: "school_id,name" })
      .select();

    if (classError) throw classError;

    // 3. Add Students
    if (createdClasses && createdClasses.length > 0) {
      const p1Class = createdClasses.find((c) => c.name === "P.1 Blue");
      const p7Class = createdClasses.find((c) => c.name === "P.7 candidates");

      const students = [
        {
          school_id: DEMO_SCHOOL_ID,
          class_id: p1Class?.id,
          first_name: "John",
          last_name: "Mugisha",
          gender: "M",
          student_number: "STU-001",
          parent_name: "Mary Jane",
          parent_phone: "0770000001",
        },
        {
          school_id: DEMO_SCHOOL_ID,
          class_id: p1Class?.id,
          first_name: "Sarah",
          last_name: "Nakamya",
          gender: "F",
          student_number: "STU-002",
          parent_name: "Paul Nakamya",
          parent_phone: "0770000002",
        },
        {
          school_id: DEMO_SCHOOL_ID,
          class_id: p7Class?.id,
          first_name: "David",
          last_name: "Katende",
          gender: "M",
          student_number: "STU-003",
          parent_name: "Esther Katende",
          parent_phone: "0770000003",
        },
      ];

      const { error: studentError } = await supabase
        .from("students")
        .upsert(students, { onConflict: "school_id,student_number" });

      if (studentError) throw studentError;
    }

    // 4. Add Fee Structure
    const feeStructure = [
      {
        school_id: DEMO_SCHOOL_ID,
        name: "Tuition Fee",
        amount: 450000,
        term: 1,
        academic_year: "2026",
      },
      {
        school_id: DEMO_SCHOOL_ID,
        name: "Development Fee",
        amount: 50000,
        term: 1,
        academic_year: "2026",
      },
      {
        school_id: DEMO_SCHOOL_ID,
        name: "Lunch Program",
        amount: 120000,
        term: 1,
        academic_year: "2026",
      },
    ];

    const { error: feeError } = await supabase
      .from("fee_structure")
      .upsert(feeStructure, {
        onConflict: "school_id,name,term,academic_year",
      });

    if (feeError) throw feeError;

    return { success: true };
  } catch (error: any) {
    console.error("Demo seeding failed:", error);
    return { error: error.message };
  }
}
