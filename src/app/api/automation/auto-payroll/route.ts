import { NextRequest, NextResponse } from "next/server";
import { computeNetSalary, computeNSSF, computePAYE } from "@/lib/automation";
import {
  requireCronSecretOrDeny,
  createServiceRoleClientOrThrow,
  requireExistingSchoolOrDeny,
} from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const cron = requireCronSecretOrDeny(request);
    if (!cron.ok) return cron.response;

    const supabase = createServiceRoleClientOrThrow();

    const { schoolId, month, year } = await request.json();
    const school = await requireExistingSchoolOrDeny({ supabase, schoolId });
    if (!school.ok) return school.response;

    const payrollMonth = month || new Date().getMonth() + 1;
    const payrollYear = year || new Date().getFullYear();

    // Get all active staff
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select(
        `
        id,
        first_name,
        last_name,
        employee_number,
        position,
        department,
        gross_salary,
        allowances,
        deductions,
        bank_account,
        bank_name,
        nssf_number,
        tin_number
      `,
      )
      .eq("school_id", school.schoolId)
      .eq("status", "active");

    if (staffError) {
      return NextResponse.json(
        { error: "Failed to fetch staff", details: staffError.message },
        { status: 500 },
      );
    }

    const processed: any[] = [];
    const errors: any[] = [];
    let totalPayroll = 0;
    let totalNSSF = 0;
    let totalPAYE = 0;
    let totalNet = 0;

    for (const member of staff as any[]) {
      try {
        // Check if payroll already exists for this staff member this month
        const { data: existingPayroll } = await supabase
          .from("payroll_records")
          .select("id")
          .eq("staff_id", member.id)
          .eq("month", payrollMonth)
          .eq("year", payrollYear)
          .limit(1);

        if (existingPayroll && existingPayroll.length > 0) {
          errors.push({
            staffId: member.id,
            name: `${member.first_name} ${member.last_name}`,
            reason: "Payroll already processed for this month",
          });
          continue;
        }

        const grossSalary = member.gross_salary || 0;
        const allowances = member.allowances || 0;
        const otherDeductions = member.deductions || 0;

        // Compute salary breakdown
        const { gross, nssf_employee, paye, other_deductions, net } =
          computeNetSalary(grossSalary, allowances, otherDeductions);

        const nssf = computeNSSF(grossSalary);
        const payeAmount = computePAYE(
          grossSalary + allowances - nssf_employee,
        );

        // Create payroll record
        const { data: payrollRecord, error: payrollError } = await supabase
          .from("payroll_records")
          .insert({
            school_id: school.schoolId,
            staff_id: member.id,
            month: payrollMonth,
            year: payrollYear,
            gross_salary: gross,
            allowances,
            nssf_employee,
            nssf_employer: nssf.employer,
            nssf_total: nssf.total,
            paye: payeAmount,
            other_deductions: other_deductions,
            total_deductions: nssf_employee + payeAmount + other_deductions,
            net_salary: net,
            bank_account: member.bank_account,
            bank_name: member.bank_name,
            nssf_number: member.nssf_number,
            tin_number: member.tin_number,
            status: "processed",
            processed_at: new Date().toISOString(),
            processed_by: "system",
          })
          .select("id")
          .single();

        if (payrollError) {
          errors.push({
            staffId: member.id,
            name: `${member.first_name} ${member.last_name}`,
            reason: `Failed to create payroll record: ${payrollError.message}`,
          });
          continue;
        }

        // Create payroll deduction details
        await supabase.from("payroll_deductions").insert([
          {
            payroll_record_id: payrollRecord.id,
            school_id: school.schoolId,
            staff_id: member.id,
            type: "NSSF",
            amount: nssf_employee,
            month: payrollMonth,
            year: payrollYear,
          },
          {
            payroll_record_id: payrollRecord.id,
            school_id: school.schoolId,
            staff_id: member.id,
            type: "PAYE",
            amount: payeAmount,
            month: payrollMonth,
            year: payrollYear,
          },
        ]);

        totalPayroll += gross;
        totalNSSF += nssf.total;
        totalPAYE += payeAmount;
        totalNet += net;

        processed.push({
          staffId: member.id,
          name: `${member.first_name} ${member.last_name}`,
          employeeNumber: member.employee_number,
          position: member.position,
          gross,
          nssf_employee,
          nssf_employer: nssf.employer,
          paye: payeAmount,
          other_deductions,
          net,
          payrollRecordId: payrollRecord.id,
        });
      } catch (err) {
        errors.push({
          staffId: member.id,
          name: `${member.first_name} ${member.last_name}`,
          reason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Create payroll summary
    if (processed.length > 0) {
      await supabase.from("payroll_summaries").insert({
        school_id: school.schoolId,
        month: payrollMonth,
        year: payrollYear,
        staff_count: processed.length,
        total_gross: totalPayroll,
        total_nssf: totalNSSF,
        total_paye: totalPAYE,
        total_net: totalNet,
        generated_at: new Date().toISOString(),
        generated_by: "system",
      });
    }

    return NextResponse.json({
      success: true,
      summary: {
        processedCount: processed.length,
        errorCount: errors.length,
        totalPayroll,
        totalNSSF,
        totalPAYE,
        totalNet,
        month: payrollMonth,
        year: payrollYear,
      },
      results: { processed, errors },
    });
  } catch (error) {
    console.error("Auto payroll processing error:", error);
    return NextResponse.json(
      {
        error: "Auto payroll processing failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
