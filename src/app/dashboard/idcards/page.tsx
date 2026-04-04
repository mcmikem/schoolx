"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useStudents, useClasses } from "@/lib/hooks";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { Select } from "@/components/ui/index";
import { EmptyState } from "@/components/EmptyState";

export default function IDCardsPage() {
  const { school } = useAuth();
  const { students } = useStudents(school?.id);
  const { classes } = useClasses(school?.id);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const filteredStudents = selectedClass
    ? students.filter((s) => s.class_id === selectedClass)
    : students;

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    setSelectedStudents(filteredStudents.map((s) => s.id));
  };

  const deselectAll = () => {
    setSelectedStudents([]);
  };

  const generateIDCard = (student: (typeof students)[0]) => {
    const cardWindow = window.open("", "_blank");
    if (!cardWindow) return;

    const schoolColor = school?.primary_color || "#002045";
    const schoolName = school?.name || "School";
    const escapeHtml = (s: string) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    const firstName = student.first_name || "";
    const lastName = student.last_name || "";

    cardWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ID Card - ${escapeHtml(firstName)} ${escapeHtml(lastName)}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', sans-serif; }
          .id-card {
            width: 350px;
            height: 220px;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            display: flex;
            flex-direction: row;
          }
          .left-section {
            width: 100px;
            background: linear-gradient(180deg, ${schoolColor} 0%, ${schoolColor}dd 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 15px;
          }
          .avatar {
            width: 70px;
            height: 70px;
            border-radius: 50%;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            color: ${schoolColor};
            border: 3px solid white;
          }
          .school-name-small {
            color: white;
            font-size: 8px;
            text-align: center;
            margin-top: 10px;
            font-weight: 500;
          }
          .right-section {
            flex: 1;
            padding: 15px;
            display: flex;
            flex-direction: column;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          }
          .school-name {
            font-size: 11px;
            font-weight: 700;
            color: ${schoolColor};
            text-transform: uppercase;
          }
          .card-type {
            font-size: 8px;
            color: #666;
            background: #f0f0f0;
            padding: 2px 6px;
            border-radius: 4px;
          }
          .student-name {
            font-size: 14px;
            font-weight: 700;
            color: #111;
            margin-bottom: 2px;
          }
          .student-info {
            font-size: 9px;
            color: #666;
            margin-bottom: 1px;
          }
          .barcode {
            margin-top: auto;
            height: 25px;
            background: repeating-linear-gradient(
              90deg,
              #111 0px,
              #111 1px,
              transparent 1px,
              transparent 3px
            );
            border-radius: 2px;
          }
          .footer {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: ${schoolColor};
          }
          @media print {
            body { margin: 0; }
            .id-card { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="id-card">
          <div class="left-section">
            <div class="avatar">${firstName?.[0]}${lastName?.[0]}</div>
            <div class="school-name-small">${escapeHtml(schoolName)}</div>
          </div>
          <div class="right-section">
            <div class="header">
              <span class="school-name">${escapeHtml(schoolName)}</span>
              <span class="card-type">STUDENT</span>
            </div>
            <div class="student-name">${escapeHtml(firstName)} ${escapeHtml(lastName)}</div>
            <div class="student-info">Class: ${escapeHtml(student.classes?.name || "N/A")}</div>
            <div class="student-info">Student No: ${escapeHtml(student.student_number || "N/A")}</div>
            <div class="student-info">Gender: ${student.gender === "M" ? "Male" : "Female"}</div>
            <div class="barcode"></div>
          </div>
        </div>
      </body>
      </html>
    `);
    cardWindow.document.close();
    cardWindow.print();
  };

  const printAllCards = () => {
    selectedStudents.forEach((id) => {
      const student = students.find((s) => s.id === id);
      if (student) generateIDCard(student);
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Student ID Cards"
        subtitle="Generate and print student identification cards"
        actions={
          <Button
            onClick={printAllCards}
            disabled={selectedStudents.length === 0}
            icon={<MaterialIcon icon="print" />}
          >
            Print Selected ({selectedStudents.length})
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3 items-center">
        <Select
          aria-label="Filter by class"
          value={selectedClass}
          onChange={(e) => {
            setSelectedClass(e.target.value);
            setSelectedStudents([]);
          }}
          options={[
            { value: "", label: "All Classes" },
            ...classes.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <Button variant="secondary" size="sm" onClick={selectAll}>
          Select All
        </Button>
        <Button variant="ghost" size="sm" onClick={deselectAll}>
          Deselect All
        </Button>
      </div>

      {filteredStudents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStudents.map((student) => (
            <Card
              key={student.id}
              className={`overflow-hidden transition-all ${
                selectedStudents.includes(student.id)
                  ? "ring-2 ring-[var(--primary)] shadow-md"
                  : ""
              }`}
              onClick={() => toggleStudent(student.id)}
            >
              <CardBody>
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shadow-sm ${
                      student.gender === "M"
                        ? "bg-[var(--primary)] text-[var(--on-primary)]"
                        : "bg-[var(--pink-500)] text-white"
                    }`}
                  >
                    {student.first_name?.[0]}
                    {student.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[var(--t1)] truncate">
                      {student.first_name} {student.last_name}
                    </h3>
                    <p className="text-sm text-[var(--t3)]">
                      {student.classes?.name}
                    </p>
                    <p className="text-xs text-[var(--t4)]">
                      {student.student_number}
                    </p>
                  </div>
                  {selectedStudents.includes(student.id) && (
                    <div className="w-6 h-6 bg-[var(--primary)] rounded-full flex items-center justify-center">
                      <MaterialIcon
                        className="text-white text-sm"
                        style={{ fontVariationSettings: "FILL 1" }}
                      >
                        check
                      </MaterialIcon>
                    </div>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full mt-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    generateIDCard(student);
                  }}
                  icon={<MaterialIcon icon="badge" />}
                >
                  Generate Card
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="badge"
          title="No Students Found"
          description="Add students to generate ID cards"
        />
      )}
    </div>
  );
}
