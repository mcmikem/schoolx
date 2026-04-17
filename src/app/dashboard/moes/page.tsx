"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAcademic } from "@/lib/academic-context";
import { useStudents, useClasses } from "@/lib/hooks";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

interface MoESRow {
  className: string;
  boys: number;
  girls: number;
  total: number;
  ageUnder6: number;
  age6: number;
  age7: number;
  age8: number;
  age9: number;
  age10: number;
  age11: number;
  age12: number;
  ageOver12: number;
}

export default function MoESExportPage() {
  const { school } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const toast = useToast();
  const { students } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);
  const [exporting, setExporting] = useState(false);

  const formatCurrency = (amount: number) => `UGX ${amount.toLocaleString()}`;

  const moesData: MoESRow[] = useMemo(() => {
    return classes.map((cls) => {
      const classStudents = students.filter((s) => s.class_id === cls.id);
      const boys = classStudents.filter((s) => s.gender === "M");
      const girls = classStudents.filter((s) => s.gender === "F");

      const currentYear = new Date().getFullYear();
      const getAge = (dob?: string) => {
        if (!dob) return 0;
        return currentYear - new Date(dob).getFullYear();
      };

      const allStudents = [...boys, ...girls];
      const ageUnder6 = allStudents.filter(
        (s) => getAge(s.date_of_birth) < 6,
      ).length;
      const age6 = allStudents.filter(
        (s) => getAge(s.date_of_birth) === 6,
      ).length;
      const age7 = allStudents.filter(
        (s) => getAge(s.date_of_birth) === 7,
      ).length;
      const age8 = allStudents.filter(
        (s) => getAge(s.date_of_birth) === 8,
      ).length;
      const age9 = allStudents.filter(
        (s) => getAge(s.date_of_birth) === 9,
      ).length;
      const age10 = allStudents.filter(
        (s) => getAge(s.date_of_birth) === 10,
      ).length;
      const age11 = allStudents.filter(
        (s) => getAge(s.date_of_birth) === 11,
      ).length;
      const age12 = allStudents.filter(
        (s) => getAge(s.date_of_birth) === 12,
      ).length;
      const ageOver12 = allStudents.filter(
        (s) => getAge(s.date_of_birth) > 12,
      ).length;

      return {
        className: cls.name,
        boys: boys.length,
        girls: girls.length,
        total: classStudents.length,
        ageUnder6,
        age6,
        age7,
        age8,
        age9,
        age10,
        age11,
        age12,
        ageOver12,
      };
    });
  }, [classes, students]);

  const totals = useMemo(
    () => ({
      boys: moesData.reduce((sum, r) => sum + r.boys, 0),
      girls: moesData.reduce((sum, r) => sum + r.girls, 0),
      total: moesData.reduce((sum, r) => sum + r.total, 0),
    }),
    [moesData],
  );

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;

      const data = [
        ["MINISTRY OF EDUCATION AND SPORTS"],
        ["SCHOOL HEADCOUNT RETURN"],
        [""],
        ["School Name:", school?.name || ""],
        ["School Code:", school?.school_code || ""],
        ["District:", school?.district || ""],
        ["Academic Year:", academicYear],
        ["Term:", currentTerm],
        ["Date:", new Date().toLocaleDateString()],
        [""],
        [
          "CLASS",
          "BOYS",
          "GIRLS",
          "TOTAL",
          "Under 6",
          "6",
          "7",
          "8",
          "9",
          "10",
          "11",
          "12",
          "Over 12",
        ],
        ...moesData.map((row) => [
          row.className,
          row.boys,
          row.girls,
          row.total,
          row.ageUnder6,
          row.age6,
          row.age7,
          row.age8,
          row.age9,
          row.age10,
          row.age11,
          row.age12,
          row.ageOver12,
        ]),
        ["TOTAL", totals.boys, totals.girls, totals.total],
      ];

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("MoES Headcount");
      data.forEach((row) => worksheet.addRow(row));

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MoES_Headcount_${school?.school_code}_${academicYear}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("MoES headcount exported");
    } catch (err) {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="MoES Headcount"
        subtitle="Ministry of Education headcount return"
      />

      <Card className="max-w-2xl mb-6">
        <CardBody>
          <h2 className="font-semibold text-[var(--t1)] mb-4">
            School Information
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-[var(--t3)]">School Name</div>
              <div className="font-medium text-[var(--t1)]">{school?.name}</div>
            </div>
            <div>
              <div className="text-sm text-[var(--t3)]">School Code</div>
              <div className="font-medium text-[var(--t1)]">
                {school?.school_code}
              </div>
            </div>
            <div>
              <div className="text-sm text-[var(--t3)]">District</div>
              <div className="font-medium text-[var(--t1)]">
                {school?.district}
              </div>
            </div>
            <div>
              <div className="text-sm text-[var(--t3)]">Academic Year</div>
              <div className="font-medium text-[var(--t1)]">
                {academicYear}, Term {currentTerm}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="text-center">
          <CardBody>
            <div className="text-2xl font-bold text-[var(--t1)]">
              {totals.total}
            </div>
            <div className="text-sm text-[var(--t3)]">Total Students</div>
          </CardBody>
        </Card>
        <Card className="text-center">
          <CardBody>
            <div className="text-2xl font-bold text-blue-600">
              {totals.boys}
            </div>
            <div className="text-sm text-[var(--t3)]">Boys</div>
          </CardBody>
        </Card>
        <Card className="text-center">
          <CardBody>
            <div className="text-2xl font-bold text-pink-600">
              {totals.girls}
            </div>
            <div className="text-sm text-[var(--t3)]">Girls</div>
          </CardBody>
        </Card>
      </div>

      <Card className="mb-6">
        <CardBody className="p-0">
          <div className="table-wrapper">
            <table className="table">
              <thead className="bg-[var(--surface-container-low)]">
                <tr>
                  <th>Class</th>
                  <th>Boys</th>
                  <th>Girls</th>
                  <th>Total</th>
                  <th>Under 6</th>
                  <th>6-12</th>
                  <th>Over 12</th>
                </tr>
              </thead>
              <tbody>
                {moesData.map((row) => (
                  <tr key={row.className}>
                    <td className="font-medium text-[var(--t1)]">
                      {row.className}
                    </td>
                    <td className="text-blue-600">{row.boys}</td>
                    <td className="text-pink-600">{row.girls}</td>
                    <td className="font-medium">{row.total}</td>
                    <td>{row.ageUnder6}</td>
                    <td>
                      {row.age6 +
                        row.age7 +
                        row.age8 +
                        row.age9 +
                        row.age10 +
                        row.age11 +
                        row.age12}
                    </td>
                    <td>{row.ageOver12}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold">
                  <td>TOTAL</td>
                  <td className="text-blue-600">{totals.boys}</td>
                  <td className="text-pink-600">{totals.girls}</td>
                  <td>{totals.total}</td>
                  <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Button
        onClick={exportToExcel}
        disabled={exporting}
        icon={exporting ? undefined : <MaterialIcon icon="download" />}
      >
        {exporting ? "Exporting..." : "Download MoES Headcount (Excel)"}
      </Button>

      <Card className="max-w-2xl mt-6">
        <CardBody>
          <h2 className="font-semibold text-[var(--t1)] mb-4">
            About MoES Returns
          </h2>
          <ul className="space-y-2 text-sm text-[var(--t3)]">
            <li>
              This report generates the official Ministry of Education headcount
              format
            </li>
            <li>Includes student counts by class, gender, and age</li>
            <li>
              Required for government reporting and capitation grant allocation
            </li>
            <li>Submit to your District Education Officer (DEO)</li>
          </ul>
        </CardBody>
      </Card>
    </div>
    </PageErrorBoundary>
  );
}
