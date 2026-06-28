import { supabase } from "./supabase";
import { logger } from "@/lib/logger";

const DEMO_SCHOOL_ID = "00000000-0000-0000-0000-000000000001";

export async function seedDemoData() {
  // Only allow demo seeding in non-production or with explicit ALLOW_DEMO_SEED flag
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEMO_SEED !== "true"
  ) {
    return { error: "Demo seeding is restricted to development environments" };
  }
  if (!supabase) return { error: "Supabase client not initialized" };

  try {
    // 1. Ensure Demo School exists
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .upsert(
        {
          id: DEMO_SCHOOL_ID,
          name: "SkoolMate Demo Academy",
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

    // Ensure subscription_plan is set
    if (!school.subscription_plan || school.subscription_plan === "free_trial") {
      await supabase
        .from("schools")
        .update({
          subscription_plan: "growth",
          subscription_status: "trial",
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", DEMO_SCHOOL_ID);
    }

    // Seed a subscription_payments record so billing history isn't empty
    const { data: existingPay } = await supabase
      .from("subscription_payments")
      .select("id")
      .eq("school_id", DEMO_SCHOOL_ID)
      .eq("transaction_id", "DEMO-TRIAL-GROWTH")
      .maybeSingle();

    if (!existingPay) {
      await supabase.from("subscription_payments").insert({
        school_id: DEMO_SCHOOL_ID,
        plan: "growth",
        amount: 175000,
        provider: "system",
        transaction_id: "DEMO-TRIAL-GROWTH",
        payment_status: "completed",
        paid_at: new Date().toISOString(),
      });
    }

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

    // 5. Seed fee_terms (modern schema) for demo school
    const feeTerms = [
      {
        school_id: DEMO_SCHOOL_ID,
        name: "Term 1 Tuition",
        code: "T1-TUITION",
        term_type: "fixed_days",
        total_amount: 620000,
        is_active: true,
        academic_year: "2026",
      },
      {
        school_id: DEMO_SCHOOL_ID,
        name: "Term 1 Development",
        code: "T1-DEVELOPMENT",
        term_type: "fixed_days",
        total_amount: 50000,
        is_active: true,
        academic_year: "2026",
      },
    ];

    const { data: createdFeeTerms, error: feeTermsError } = await supabase
      .from("fee_terms")
      .upsert(feeTerms, { onConflict: "school_id,code,academic_year" })
      .select();

    if (feeTermsError) throw feeTermsError;

    // 6. Fetch students to seed fee payments
    const { data: allStudents, error: fetchError } = await supabase
      .from("students")
      .select("id")
      .eq("school_id", DEMO_SCHOOL_ID);

    if (fetchError) throw fetchError;

    if (allStudents && allStudents.length > 0 && createdFeeTerms) {
      const feeTermId = createdFeeTerms[0]?.id;

      // Create student_fee_terms links
      const studentFeeTerms = allStudents.map((s) => ({
        school_id: DEMO_SCHOOL_ID,
        student_id: s.id,
        fee_term_id: feeTermId,
        academic_year: "2026",
        total_amount: 620000,
        final_amount: 620000,
        amount_paid: 400000,
        status: "active",
      }));

      await supabase.from("student_fee_terms").upsert(studentFeeTerms, {
        onConflict: "student_id,fee_term_id,academic_year",
      });

      // Create fee_payment records (one per student, partial payment)
      const payments = allStudents.map((s) => ({
        student_id: s.id,
        amount_paid: 400000,
        payment_method: "mobile_money",
        payment_reference: `DEMO-PAY-${s.id.slice(0, 8)}`,
        paid_by: "Demo Parent",
        payment_date: new Date().toISOString().split("T")[0],
      }));

      const { error: payError } = await supabase
        .from("fee_payments")
        .insert(payments);

      if (payError) {
        logger.warn("[seed-demo] fee_payments insert failed (non-fatal):", payError);
      }
    }

    return { success: true };
  } catch (error: any) {
    logger.error("Demo seeding failed:", error);
    return { error: error.message };
  }
}
