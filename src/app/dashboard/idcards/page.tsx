"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useStudents, useClasses } from "@/lib/hooks";
import MaterialIcon from "@/components/MaterialIcon";
import { printWhenReady, writePrintDocument } from "@/lib/print-window";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { Select } from "@/components/ui/index";
import { EmptyState } from "@/components/EmptyState";

export default function IDCardsPage() {
  const { school } = useAuth();
  const { students } = useStudents(school?.id, { limit: 1000, fields: "slim" });
  const { classes } = useClasses(school?.id);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const filteredStudents = selectedClass ? students.filter((s) => s.class_id === selectedClass) : students;

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
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

    const schoolColor = school?.primary_color || "var(--secondary, #002045)";
    const schoolLogo = school?.logo_url || "";
    const schoolName = school?.name || "School";
    const escapeHtml = (s: string) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const firstName = student.first_name || "";
    const lastName = student.last_name || "";

    const idCardStyles = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f5f5f7; }
      .id-card {
        width: 350px;
        height: 220px;
        background: white;
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 4px 24px rgba(0,0,0,0.08);
        border: 1px solid #e5e5ea;
        position: relative;
        display: flex;
        flex-direction: column;
      }
      .accent-bar {
        height: 6px;
        background: linear-gradient(90deg, ${schoolColor}, #2563eb);
      }
      .header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px 8px;
        border-bottom: 1px solid #f0f0f2;
      }
      .school-logo {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        object-fit: contain;
        background: #f0f0f2;
        padding: 2px;
        flex-shrink: 0;
      }
      .school-logo-fallback {
        width: 32px;
        height: 32px;
        border-radius: 6px;
        background: ${schoolColor};
        color: white;
        font-size: 14px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .school-info { flex: 1; }
      .school-name {
        font-size: 12px;
        font-weight: 600;
        color: ${schoolColor};
        line-height: 1.2;
      }
      .school-sub {
        font-size: 9px;
        color: #6e6e73;
        margin-top: 1px;
      }
      .card-type {
        font-size: 8px;
        color: #6e6e73;
        background: #f0f0f2;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
      }
      .body {
        display: flex;
        gap: 14px;
        padding: 10px 16px;
        flex: 1;
      }
      .photo {
        width: 72px;
        height: 88px;
        border-radius: 8px;
        background: #f0f0f2;
        border: 1px solid #e5e5ea;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #aeaeb2;
        font-size: 10px;
        flex-shrink: 0;
        overflow: hidden;
      }
      .photo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .details { flex: 1; }
      .student-name {
        font-size: 14px;
        font-weight: 600;
        color: #1d1d1f;
        margin-bottom: 6px;
        line-height: 1.2;
      }
      .detail-row {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        margin-bottom: 3px;
      }
      .detail-label { color: #6e6e73; }
      .detail-value { color: #1d1d1f; font-weight: 500; }
      .footer {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 16px;
        background: #f9f9fb;
        border-top: 1px solid #f0f0f2;
      }
      .qr {
        width: 32px;
        height: 32px;
        background: white;
        border: 1px solid #e5e5ea;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 7px;
        color: #aeaeb2;
      }
      .validity {
        font-size: 8px;
        color: #6e6e73;
        text-align: right;
        line-height: 1.4;
      }
      .validity strong { color: #1d1d1f; }
      @media print {
        body { margin: 0; background: white; }
        .id-card { box-shadow: none; }
      }
    `;

    const idCardBody = `
      <div class="id-card">
        <div class="accent-bar"></div>
        <div class="header">
          ${
            schoolLogo
              ? `<img src="${escapeHtml(schoolLogo)}" alt="${escapeHtml(schoolName)} logo" class="school-logo" />`
              : `<div class="school-logo-fallback">${escapeHtml(schoolName.charAt(0).toUpperCase())}</div>`
          }
          <div class="school-info">
            <div class="school-name">${escapeHtml(schoolName)}</div>
            <div class="school-sub">${escapeHtml(school?.address || "School Address")}</div>
          </div>
          <span class="card-type">STUDENT ID</span>
        </div>
        <div class="body">
          <div class="photo">
            ${
              (student as any).photo_url
                ? `<img src="${escapeHtml((student as any).photo_url)}" alt="Student photo" />`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;opacity:0.3"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>`
            }
          </div>
          <div class="details">
            <div class="student-name">${escapeHtml(firstName)} ${escapeHtml(lastName)}</div>
            <div class="detail-row"><span class="detail-label">Class</span><span class="detail-value">${escapeHtml(student.classes?.name || "N/A")}</span></div>
            <div class="detail-row"><span class="detail-label">Student No.</span><span class="detail-value">${escapeHtml(student.student_number || "N/A")}</span></div>
            <div class="detail-row"><span class="detail-label">Gender</span><span class="detail-value">${student.gender === "M" ? "Male" : "Female"}</span></div>
            ${(student as any).boarding_status && (student as any).boarding_status !== "day" ? `<div class="detail-row"><span class="detail-label">Boarder</span><span class="detail-value">${escapeHtml((student as any).boarding_status)}</span></div>` : ""}
            ${(student as any).houses?.name ? `<div class="detail-row"><span class="detail-label">House</span><span class="detail-value">${escapeHtml((student as any).houses.name)}</span></div>` : ""}
          </div>
        </div>
        <div class="footer">
          <div class="qr">QR</div>
          <div class="validity">
            Valid until <strong>Dec 2026</strong><br />
            ${escapeHtml(school?.phone || "+256 000 000 000")}
          </div>
        </div>
      </div>
    `;

    // document.open() left document.body null, so the next line threw and the
    // popup stayed blank -- an empty tab and no ID card.
    writePrintDocument(cardWindow, `ID Card - ${firstName} ${lastName}`, idCardBody, {
      styles: idCardStyles,
      page: "A4",
    });
    void printWhenReady(cardWindow);
  };

  const printAllCards = () => {
    selectedStudents.forEach((id) => {
      const student = students.find((s) => s.id === id);
      if (student) generateIDCard(student);
    });
  };

  return (
    <PageErrorBoundary>
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
            options={[{ value: "", label: "All Classes" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]}
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
                  selectedStudents.includes(student.id) ? "ring-2 ring-[var(--primary)] shadow-md" : ""
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
                      <p className="text-sm text-[var(--t3)]">{student.classes?.name}</p>
                      <p className="text-xs text-[var(--t4)]">{student.student_number}</p>
                    </div>
                    {selectedStudents.includes(student.id) && (
                      <div className="w-6 h-6 bg-[var(--primary)] rounded-full flex items-center justify-center">
                        <MaterialIcon className="text-white text-sm">check</MaterialIcon>
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
          <EmptyState icon="badge" title="No Students Found" description="Add students to generate ID cards" />
        )}
      </div>
    </PageErrorBoundary>
  );
}
