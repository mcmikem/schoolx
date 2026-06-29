export interface CBCLearningOutcome {
  description: string;
  u1Score: number;
  u2Score: number;
}

export interface CBCSubjectEntry {
  name: string;
  teacherName: string;
  teacherRemark: string;
  teacherInitials: string;
  learningOutcomes: CBCLearningOutcome[];
  u1Average: number;
  u2Average: number;
  averageIdentifier: number;
  formativeScore: number;
  eotScore: number;
  summativeScore: number;
  totalMark: number;
  grade: string;
}

export interface CBCReportData {
  school: {
    name: string;
    schoolCode: string;
    unebCenterNumber: string;
    phone: string;
    email: string;
    address: string;
    logoUrl: string;
    motto: string;
    primaryColor: string;
  };
  student: {
    firstName: string;
    lastName: string;
    fullName: string;
    studentNumber: string;
    photoUrl: string;
    className: string;
    formClass: string;
    gender: string;
  };
  term: number;
  academicYear: string;
  examTitle: string;
  subjects: CBCSubjectEntry[];
  summary: {
    totalIdentifier: number;
    totalFormative: number;
    totalEot: number;
    totalMarkSum: number;
    overallAverage: number;
    averageGrade: string;
  };
  gradingScheme: string;
  identifierRanges: { level: number; label: string; descriptor: string; min: number; max: number }[];
  classTeacher: { name: string; comment: string };
  headTeacher: { name: string; comment: string };
  nextTermOpens: string;
  dateOfIssue: string;
}

const IDENTIFIER_RANGES = [
  { level: 3, label: "Outstanding", descriptor: "Most or all LO's achieved for overall achievement", min: 2.50, max: 3.00 },
  { level: 2, label: "Moderate", descriptor: "Many LO's achieved, enough for overall achievement", min: 1.50, max: 2.49 },
  { level: 1, label: "Basic", descriptor: "Few LO's achieved, but not sufficient for overall achievement", min: 0.90, max: 1.49 },
];

const GRADING_SCALE = [
  { min: 85, max: 100, grade: "A+" },
  { min: 80, max: 84, grade: "A" },
  { min: 75, max: 79, grade: "B" },
  { min: 70, max: 74, grade: "C" },
  { min: 65, max: 69, grade: "D" },
  { min: 50, max: 64, grade: "E" },
  { min: 40, max: 49, grade: "F" },
  { min: 0, max: 39, grade: "G" },
];

export function getCBCGrade(totalMark: number): string {
  const found = GRADING_SCALE.find((s) => totalMark >= s.min && totalMark <= s.max);
  return found?.grade || "G";
}

export function getIdentifierLevel(avg: number): number {
  if (avg >= 2.50) return 3;
  if (avg >= 1.50) return 2;
  if (avg >= 0.90) return 1;
  return 1;
}

export function calculateFormativeScore(avgIdentifier: number): number {
  return Math.round((avgIdentifier / 3.0) * 20 * 10) / 10;
}

export function calculateSummativeScore(eotPercent: number): number {
  return Math.round(eotPercent * 0.8);
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generateCBCReportHTML(data: CBCReportData): string {
  const pc = data.school.primaryColor || "#002045";

  const headerHtml = `
    <div class="cbc-header">
      <div class="cbc-header-left">
        ${data.school.logoUrl ? `<img src="${escapeHtml(data.school.logoUrl)}" class="cbc-logo" alt="School Logo" />` : ""}
      </div>
      <div class="cbc-header-center">
        <div class="cbc-school-name">${escapeHtml(data.school.name)}</div>
        <div class="cbc-school-info">${escapeHtml(data.school.address || "")}</div>
        <div class="cbc-school-info">Tel: ${escapeHtml(data.school.phone)} / ${escapeHtml(data.school.email)}</div>
        <div class="cbc-school-meta">
          EMIS No: ${escapeHtml(data.school.schoolCode)} &nbsp;|&nbsp; SchPay Code: ${escapeHtml(data.school.schoolCode)}
          ${data.school.unebCenterNumber ? `&nbsp;|&nbsp; Center No: ${escapeHtml(data.school.unebCenterNumber)}` : ""}
        </div>
      </div>
      <div class="cbc-header-right">
        ${data.student.photoUrl
          ? `<img src="${escapeHtml(data.student.photoUrl)}" class="cbc-photo" alt="${escapeHtml(data.student.fullName)}" />`
          : `<div class="cbc-photo-placeholder"></div>`}
      </div>
    </div>
  `;

  const examTitleHtml = `
    <div class="cbc-exam-title">${escapeHtml(data.examTitle)}</div>
  `;

  const studentInfoHtml = `
    <div class="cbc-student-info">
      <span class="cbc-student-label">Name:</span> ${escapeHtml(data.student.fullName)}
      <span class="cbc-student-sep">|</span>
      <span class="cbc-student-label">${data.student.formClass}:</span> ${escapeHtml(data.student.className)}
      <span class="cbc-student-sep">|</span>
      <span class="cbc-student-label">Student No:</span> ${escapeHtml(data.student.studentNumber)}
    </div>
  `;

  const subjectsHtml = data.subjects.map((subj) => {
    const outcomesHtml = subj.learningOutcomes.map((lo) => `
      <div class="cbc-outcome">
        <span class="cbc-outcome-num">${escapeHtml(lo.description)}</span>
        <span class="cbc-outcome-score">${lo.u1Score.toFixed(1)}</span>
      </div>
    `).join("");

    return `
      <div class="cbc-subject-block">
        <div class="cbc-subject-header">
          <span class="cbc-subject-name">${escapeHtml(subj.name)}</span>
          <span class="cbc-subject-teacher">${escapeHtml(subj.teacherName)}</span>
        </div>
        <div class="cbc-teacher-remark">${escapeHtml(subj.teacherRemark)}</div>
        ${outcomesHtml}
        <div class="cbc-mark-outof"><strong>Mark Out of 20:</strong> ${subj.formativeScore.toFixed(1)}</div>
      </div>
    `;
  }).join("");

  let summaryRows = "";
  let totalIdentifier = 0;
  let totalFormative = 0;
  let totalEot = 0;
  let totalMarkSum = 0;
  let subjectCount = data.subjects.length;

  for (const subj of data.subjects) {
    totalIdentifier += subj.averageIdentifier;
    totalFormative += subj.formativeScore;
    totalEot += subj.eotScore;
    totalMarkSum += subj.totalMark;

    summaryRows += `
      <tr>
        <td class="cbc-left">${escapeHtml(subj.name)}</td>
        <td>${subj.u1Average.toFixed(1)}</td>
        <td>${subj.u2Average.toFixed(1)}</td>
        <td>${subj.averageIdentifier.toFixed(1)}</td>
        <td>${subj.formativeScore.toFixed(1)}</td>
        <td>${Math.round(subj.eotScore)}</td>
        <td>${subj.summativeScore}</td>
        <td>${Math.round(subj.totalMark)}</td>
        <td>${escapeHtml(subj.grade)}</td>
        <td>${escapeHtml(subj.teacherInitials)}</td>
      </tr>
    `;
  }

  const overallAvgIdentifier = subjectCount > 0 ? (totalIdentifier / subjectCount) : 0;
  const overallAvg = subjectCount > 0 ? Math.round((totalMarkSum / subjectCount) * 10) / 10 : 0;
  const avgGrade = getCBCGrade(overallAvg);

  const summaryHtml = `
    <div class="cbc-section-title">SUMMARY REPORT</div>
    <div class="cbc-summary-section">
      <div class="cbc-summary-header-row">
        <span>FORMATIVE ASSESSMENT</span>
        <span class="cbc-summary-spacer"></span>
        <span>SUMMATIVE</span>
        <span class="cbc-summary-spacer"></span>
        <span>TERM AVERAGE</span>
      </div>
      <table class="cbc-summary-table">
        <thead>
          <tr>
            <th class="cbc-left">Subjects</th>
            <th>U1</th>
            <th>U2</th>
            <th>AVE</th>
            <th>Total<br/>Pts</th>
            <th>Total<br/>out of 20</th>
            <th>EOT<br/>100%</th>
            <th>Total<br/>out of 80</th>
            <th>Total<br/>Mark</th>
            <th>Grade</th>
            <th>TEACHER<br/>INITIALS</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows}
        </tbody>
        <tfoot>
          <tr class="cbc-total-row">
            <td class="cbc-left"><strong>TOTAL</strong></td>
            <td></td>
            <td></td>
            <td><strong>${overallAvgIdentifier.toFixed(1)}</strong></td>
            <td></td>
            <td><strong>${totalFormative.toFixed(1)}</strong></td>
            <td></td>
            <td><strong>${totalEot.toFixed(1)}</strong></td>
            <td><strong>${Math.round(totalMarkSum)}</strong></td>
            <td><strong>${escapeHtml(avgGrade)}</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="cbc-average-row">
      AVERAGE: ${overallAvgIdentifier.toFixed(1)} &nbsp; ${totalFormative.toFixed(1)} &nbsp; ${totalEot.toFixed(1)} &nbsp; ${Math.round(totalMarkSum)}
      &nbsp;&nbsp; Average Grade: ${escapeHtml(avgGrade)}
    </div>
  `;

  const gradingHtml = `
    <div class="cbc-grading-section">
      <div>
        <strong>Grading scheme:</strong><br/>
        ${GRADING_SCALE.map((s) => `${s.min} ${s.grade}${s.max < 100 ? ` - ${s.max}` : "+ +"}${s.max < 85 ? "" : ""}`).join(" &nbsp;")}
        <br/>
        <span style="font-size:7pt">${GRADING_SCALE.map((s) => `${s.min}${s.max < 100 ? `-${s.max}` : "+"} ${s.grade}`).join(" ")}</span>
      </div>
      <div style="margin-top:3px">
        <strong>Identifier Ranges:</strong><br/>
        ${IDENTIFIER_RANGES.map((r) => `${r.min.toFixed(1)} - ${r.max.toFixed(1)} Level ${r.level}`).join(" &nbsp;|&nbsp; ")}
      </div>
      <div style="margin-top:3px">
        <table class="cbc-identifier-table">
          <thead>
            <tr><th>Identifier</th><th>Score Range</th><th>Descriptor</th></tr>
          </thead>
          <tbody>
            ${IDENTIFIER_RANGES.map((r) => `
              <tr>
                <td><strong>Level ${r.level}</strong></td>
                <td>${r.min.toFixed(2)} - ${r.max.toFixed(2)}</td>
                <td>${escapeHtml(r.descriptor)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const commentsHtml = `
    <div class="cbc-comments">
      <div class="cbc-comment-block">
        <span class="cbc-comment-label">Class Teacher:</span>
        <span class="cbc-comment-name">${escapeHtml(data.classTeacher.name)}</span>
        <div class="cbc-comment-text">${escapeHtml(data.classTeacher.comment)}</div>
      </div>
      <div class="cbc-comment-block">
        <span class="cbc-comment-label">Headteacher:</span>
        <span class="cbc-comment-name">${escapeHtml(data.headTeacher.name)}</span>
        <div class="cbc-comment-text">${escapeHtml(data.headTeacher.comment)}</div>
      </div>
    </div>
  `;

  const footerHtml = `
    <div class="cbc-footer">
      Start of Next Term: ${escapeHtml(data.nextTermOpens)} &nbsp;&nbsp; Date of Issue: ${escapeHtml(data.dateOfIssue)}
    </div>
    <div class="cbc-motto">${escapeHtml(data.school.motto)}</div>
  `;

  const fullHtml = `
    <div class="cbc-report-page">
      ${headerHtml}
      ${examTitleHtml}
      ${studentInfoHtml}
      <div class="cbc-subjects-area">
        ${subjectsHtml}
      </div>
      ${summaryHtml}
      ${gradingHtml}
      <div class="cbc-comments-area">
        ${commentsHtml}
        ${footerHtml}
      </div>
    </div>
  `;

  const styles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 7.5pt; line-height: 1.25; color: #000; }
    .cbc-report-page { width: 210mm; min-height: 297mm; padding: 8mm 10mm; margin: 0 auto; }

    .cbc-header { display: flex; align-items: flex-start; gap: 8px; border-bottom: 2px solid ${pc}; padding-bottom: 4px; margin-bottom: 4px; }
    .cbc-header-left { width: 55px; flex-shrink: 0; }
    .cbc-header-center { flex: 1; text-align: center; }
    .cbc-header-right { width: 55px; flex-shrink: 0; }
    .cbc-logo { max-width: 50px; max-height: 50px; display: block; }
    .cbc-photo { width: 50px; height: 60px; object-fit: cover; border: 1px solid #ccc; border-radius: 4px; display: block; }
    .cbc-photo-placeholder { width: 50px; height: 60px; border: 1px dashed #ccc; border-radius: 4px; }
    .cbc-school-name { font-size: 11pt; font-weight: bold; color: ${pc}; text-transform: uppercase; }
    .cbc-school-info { font-size: 6.5pt; color: #444; line-height: 1.3; }
    .cbc-school-meta { font-size: 7pt; font-weight: 600; color: #222; margin-top: 2px; letter-spacing: 0.2px; }

    .cbc-exam-title { text-align: center; font-size: 9pt; font-weight: bold; color: ${pc}; margin: 3px 0; }

    .cbc-student-info { font-size: 7.5pt; padding: 2px 0; border-bottom: 1px solid #ddd; margin-bottom: 3px; }
    .cbc-student-label { font-weight: 600; }
    .cbc-student-sep { margin: 0 6px; color: #aaa; }

    .cbc-subjects-area { margin-bottom: 3px; }

    .cbc-subject-block { margin-bottom: 2px; border-bottom: 1px dotted #ccc; padding-bottom: 2px; }
    .cbc-subject-header { display: flex; justify-content: space-between; font-size: 7.5pt; font-weight: bold; color: ${pc}; }
    .cbc-subject-name { text-transform: uppercase; }
    .cbc-subject-teacher { font-weight: normal; font-size: 7pt; color: #555; }
    .cbc-teacher-remark { font-size: 6.5pt; font-style: italic; color: #333; margin: 0 0 1px 0; }
    .cbc-outcome { display: flex; justify-content: space-between; font-size: 6.5pt; padding: 0 0 0 8px; line-height: 1.3; }
    .cbc-outcome-num { flex: 1; }
    .cbc-outcome-score { font-weight: bold; width: 20px; text-align: right; }
    .cbc-mark-outof { font-size: 7pt; text-align: right; margin-top: 1px; color: ${pc}; }

    .cbc-section-title { font-size: 9pt; font-weight: bold; text-align: center; color: ${pc}; margin: 4px 0 2px; border-top: 2px solid ${pc}; padding-top: 3px; }
    .cbc-summary-section { margin-bottom: 2px; }

    .cbc-summary-header-row { display: flex; font-size: 6pt; font-weight: bold; color: ${pc}; margin-bottom: 1px; }
    .cbc-summary-spacer { flex: 1; }

    .cbc-summary-table { width: 100%; border-collapse: collapse; font-size: 6.5pt; }
    .cbc-summary-table th { background: ${pc}; color: #fff; padding: 2px 3px; border: 0.5pt solid ${pc}; text-align: center; font-size: 6pt; font-weight: bold; }
    .cbc-summary-table th.cbc-left { text-align: left; }
    .cbc-summary-table td { padding: 1.5px 3px; border: 0.5pt solid #ccc; text-align: center; }
    .cbc-summary-table td.cbc-left { text-align: left; }
    .cbc-total-row td { font-weight: bold; background: ${pc}15; }

    .cbc-average-row { text-align: center; font-size: 7pt; font-weight: bold; color: ${pc}; margin: 2px 0; }

    .cbc-grading-section { font-size: 6.5pt; margin: 3px 0; border-top: 1px solid #ddd; padding-top: 2px; }
    .cbc-identifier-table { width: 100%; border-collapse: collapse; font-size: 6pt; margin-top: 1px; }
    .cbc-identifier-table th { background: #f0f0f0; padding: 1px 3px; border: 0.5pt solid #ccc; text-align: left; font-size: 6pt; }
    .cbc-identifier-table td { padding: 1px 3px; border: 0.5pt solid #ccc; }

    .cbc-comments-area { margin-top: 3px; }
    .cbc-comments { display: flex; gap: 10px; }
    .cbc-comment-block { flex: 1; border: 0.5pt solid #ddd; padding: 3px 5px; border-radius: 2px; }
    .cbc-comment-label { font-size: 6pt; font-weight: bold; text-transform: uppercase; color: ${pc}; }
    .cbc-comment-name { font-size: 6.5pt; font-style: italic; }
    .cbc-comment-text { font-size: 6.5pt; margin-top: 1px; }

    .cbc-footer { text-align: center; font-size: 7pt; font-weight: 600; color: ${pc}; margin-top: 4px; border-top: 1px solid #ccc; padding-top: 2px; }
    .cbc-motto { text-align: center; font-size: 6pt; font-style: italic; color: #888; margin-top: 1px; }

    @media print {
      @page { size: A4; margin: 0; }
      body { margin: 0; padding: 0; }
      .cbc-report-page { margin: 0; width: 210mm; min-height: 297mm; padding: 8mm 10mm; }
    }
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Report Card - ${escapeHtml(data.student.fullName)}</title>
      <style>${styles}</style>
    </head>
    <body>
      ${fullHtml}
    </body>
    </html>
  `;
}
