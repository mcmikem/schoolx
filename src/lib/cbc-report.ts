export interface CBCLearningOutcome {
  description: string;
  u1Score: number | null;
  u2Score: number | null;
  identifierScore?: number | null;
  scoreLabel?: string;
}

export interface CBCSubjectEntry {
  name: string;
  teacherName: string;
  teacherRemark: string;
  teacherInitials: string;
  learningOutcomes: CBCLearningOutcome[];
  u1Average: number | null;
  u2Average: number | null;
  averageIdentifier: number | null;
  formativeScore: number | null;
  eotScore: number | null;
  summativeScore: number | null;
  totalMark: number | null;
  grade: string;
  /** Evidence columns; shown when a school records these assessment types. */
  projectScore?: number | null;
  continuousAssessmentScore?: number | null;
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
    totalIdentifier: number | null;
    totalFormative: number | null;
    totalEot: number | null;
    totalMarkSum: number | null;
    overallAverage: number | null;
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
  {
    level: 3,
    label: "Outstanding",
    descriptor: "Most or all LO's achieved for overall achievement",
    min: 2.5,
    max: 3.0,
  },
  {
    level: 2,
    label: "Moderate",
    descriptor: "Many LO's achieved, enough for overall achievement",
    min: 1.5,
    max: 2.49,
  },
  {
    level: 1,
    label: "Basic",
    descriptor: "Few LO's achieved, but not sufficient for overall achievement",
    min: 0.9,
    max: 1.49,
  },
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
  if (!Number.isFinite(totalMark) || totalMark < 0 || totalMark > 100) return "—";
  const found = GRADING_SCALE.find((scale) => totalMark >= scale.min);
  return found?.grade || "—";
}

export function getIdentifierLevel(avg: number): number {
  if (avg >= 2.5) return 3;
  if (avg >= 1.5) return 2;
  if (avg >= 0.9) return 1;
  return 1;
}

export function calculateFormativeScore(avgIdentifier: number): number {
  return Math.round((avgIdentifier / 3.0) * 20 * 10) / 10;
}

export function calculateSummativeScore(eotPercent: number): number {
  return Math.round(eotPercent * 0.8);
}

export interface CBCAssessmentRow {
  assessment_type: string;
  score?: number | null;
  identifier_score?: number | null;
  max_score?: number | null;
}

export function cbcIdentifierValue(row: CBCAssessmentRow): number | null {
  const value = row.identifier_score ?? row.score;
  return value != null && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 3
    ? Number(value)
    : null;
}

export function calculateCBCSubject(rows: CBCAssessmentRow[]) {
  const average = (items: CBCAssessmentRow[]) => {
    if (!items.length) return null;
    const values = items.map(cbcIdentifierValue);
    if (values.some((value) => value === null)) return null;
    return (values as number[]).reduce((total, value) => total + value, 0) / values.length;
  };
  const u1Average = average(rows.filter((row) => row.assessment_type === "u1"));
  const u2Average = average(rows.filter((row) => row.assessment_type === "u2"));
  const identifiers = rows.filter((row) => ["competency", "identifier_score", "aoi"].includes(row.assessment_type));
  const averageIdentifier = identifiers.length
    ? average(identifiers)
    : u1Average === null || u2Average === null
      ? null
      : (u1Average + u2Average) / 2;
  const exams = rows.filter((row) => row.assessment_type === "eot");
  const candidates = exams.length ? exams : rows.filter((row) => row.assessment_type === "exam");
  const exam = candidates.length === 1 ? candidates[0] : null;
  const maximum = exam?.max_score ?? 100;
  const eotScore =
    exam?.score != null &&
    Number.isFinite(Number(exam.score)) &&
    Number.isFinite(Number(maximum)) &&
    Number(maximum) > 0 &&
    Number(exam.score) >= 0 &&
    Number(exam.score) <= Number(maximum)
      ? (Number(exam.score) / Number(maximum)) * 100
      : null;
  const formativeScore = averageIdentifier === null ? null : calculateFormativeScore(averageIdentifier);
  const summativeScore = eotScore === null ? null : calculateSummativeScore(eotScore);
  const totalMark =
    formativeScore === null || summativeScore === null ? null : Math.round(formativeScore + summativeScore);
  const percentageAverage = (items: CBCAssessmentRow[]) => {
    const percentages = items
      .map((row) => {
        const score = Number(row.score);
        const max = Number(row.max_score ?? 100);
        return Number.isFinite(score) && Number.isFinite(max) && max > 0 && score >= 0 && score <= max
          ? (score / max) * 100
          : null;
      })
      .filter((value): value is number => value !== null);
    return percentages.length ? Math.round((percentages.reduce((sum, value) => sum + value, 0) / percentages.length) * 10) / 10 : null;
  };
  const projectScore = percentageAverage(rows.filter((row) => row.assessment_type === "project"));
  const continuousAssessmentScore = percentageAverage(
    rows.filter((row) => ["ca1", "ca2", "ca3", "ca4", "class_test", "saturday"].includes(row.assessment_type)),
  );
  return {
    u1Average,
    u2Average,
    averageIdentifier,
    formativeScore,
    eotScore,
    summativeScore,
    totalMark,
    grade: totalMark === null ? "—" : getCBCGrade(totalMark),
    projectScore,
    continuousAssessmentScore,
  };
}

export function summarizeCBCSubjects(
  subjects: Pick<
    CBCSubjectEntry,
    | "averageIdentifier"
    | "formativeScore"
    | "eotScore"
    | "summativeScore"
    | "totalMark"
    | "projectScore"
    | "continuousAssessmentScore"
  >[],
) {
  const recorded = subjects.filter((subject) => subject.totalMark !== null && Number.isFinite(subject.totalMark));
  const sum = (key: "averageIdentifier" | "formativeScore" | "eotScore" | "summativeScore" | "totalMark") => {
    const values = recorded
      .map((subject) => subject[key])
      .filter((value): value is number => value !== null && Number.isFinite(value));
    return values.length ? Math.round(values.reduce((total, value) => total + value, 0) * 10) / 10 : null;
  };
  const totalMarkSum = sum("totalMark");
  const overallAverage = recorded.length ? Math.round((totalMarkSum! / recorded.length) * 10) / 10 : null;
  const identifiers = recorded
    .map((subject) => subject.averageIdentifier)
    .filter((value): value is number => value !== null);
  const overallIdentifier = identifiers.length
    ? identifiers.reduce((total, value) => total + value, 0) / identifiers.length
    : null;
  const isComplete = subjects.length > 0 && recorded.length === subjects.length;
  const averageEvidence = (key: "projectScore" | "continuousAssessmentScore") => {
    const values = subjects
      .map((subject) => subject[key])
      .filter((value): value is number => value != null && Number.isFinite(value));
    return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
  };
  return {
    totalIdentifier: sum("averageIdentifier"),
    totalFormative: sum("formativeScore"),
    totalEot: sum("eotScore"),
    totalSummative: sum("summativeScore"),
    totalMarkSum,
    overallAverage,
    overallIdentifier,
    recordedSubjects: recorded.length,
    projectAverage: averageEvidence("projectScore"),
    continuousAssessmentAverage: averageEvidence("continuousAssessmentScore"),
    isComplete,
    averageGrade: !isComplete ? "Incomplete" : getCBCGrade(overallAverage!),
  };
}

function cbcMark(value: number | null, decimals = 1): string {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(decimals);
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
        ${
          data.student.photoUrl
            ? `<img src="${escapeHtml(data.student.photoUrl)}" class="cbc-photo" alt="${escapeHtml(data.student.fullName)}" />`
            : `<div class="cbc-photo-placeholder"></div>`
        }
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

  const subjectsHtml = data.subjects
    .map((subj) => {
      const outcomesHtml = subj.learningOutcomes
        .map(
          (lo) => `
      <div class="cbc-outcome">
        <span class="cbc-outcome-num">${escapeHtml(lo.description)}</span>
        <span class="cbc-outcome-score">${lo.identifierScore !== undefined ? `${escapeHtml(lo.scoreLabel || "Identifier")}: ${cbcMark(lo.identifierScore)}` : `U1: ${cbcMark(lo.u1Score)} · U2: ${cbcMark(lo.u2Score)}`}</span>
      </div>
    `,
        )
        .join("");

      return `
      <div class="cbc-subject-block">
        <div class="cbc-subject-header">
          <span class="cbc-subject-name">${escapeHtml(subj.name)}</span>
          <span class="cbc-subject-teacher">${escapeHtml(subj.teacherName)}</span>
        </div>
        <div class="cbc-teacher-remark">${escapeHtml(subj.teacherRemark)}</div>
        ${outcomesHtml}
        ${subj.projectScore != null || subj.continuousAssessmentScore != null
          ? `<div class="cbc-evidence">Project: ${cbcMark(subj.projectScore ?? null)}% &nbsp; · &nbsp; Continuous assessment: ${cbcMark(subj.continuousAssessmentScore ?? null)}%</div>`
          : ""}
        <div class="cbc-mark-outof"><strong>Mark Out of 20:</strong> ${cbcMark(subj.formativeScore)}</div>
      </div>
    `;
    })
    .join("");

  let summaryRows = "";
  const summary = summarizeCBCSubjects(data.subjects);

  for (const subj of data.subjects) {
    summaryRows += `
      <tr>
        <td class="cbc-left">${escapeHtml(subj.name)}</td>
        <td>${cbcMark(subj.u1Average)}</td>
        <td>${cbcMark(subj.u2Average)}</td>
        <td>${cbcMark(subj.averageIdentifier)}</td>
        <td>${cbcMark(subj.projectScore ?? null)}</td>
        <td>${cbcMark(subj.continuousAssessmentScore ?? null)}</td>
        <td>${cbcMark(subj.formativeScore)}</td>
        <td>${cbcMark(subj.eotScore, 0)}</td>
        <td>${cbcMark(subj.summativeScore, 0)}</td>
        <td>${cbcMark(subj.totalMark, 0)}</td>
        <td>${escapeHtml(subj.grade)}</td>
        <td>${escapeHtml(subj.teacherInitials)}</td>
      </tr>
    `;
  }

  const summaryHtml = `
    <div class="cbc-section-title">SUMMARY REPORT</div>
    ${summary.isComplete ? "" : '<div class="cbc-provisional">Provisional — missing or invalid assessments show as —. This is not a complete official result.</div>'}
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
            <th>Project<br/>%</th>
            <th>CA<br/>%</th>
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
            <td><strong>${cbcMark(summary.overallIdentifier)}</strong></td>
            <td><strong>${cbcMark(summary.projectAverage)}</strong></td>
            <td><strong>${cbcMark(summary.continuousAssessmentAverage)}</strong></td>
            <td><strong>${cbcMark(summary.totalFormative)}</strong></td>
            <td><strong>${cbcMark(summary.totalEot)}</strong></td>
            <td><strong>${cbcMark(summary.totalSummative)}</strong></td>
            <td><strong>${cbcMark(summary.totalMarkSum, 0)}</strong></td>
            <td><strong>${escapeHtml(summary.averageGrade)}</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="cbc-average-row">
      AVERAGE: <span class="cbc-overall-average">${summary.overallAverage === null ? "—" : `${cbcMark(summary.overallAverage)}%`}</span>
      &nbsp; ${summary.recordedSubjects}/${data.subjects.length} completed subjects; totals exclude incomplete subjects
      &nbsp;&nbsp; Average Grade: ${escapeHtml(summary.averageGrade)}
    </div>
  `;

  const gradingHtml = `
    <div class="cbc-grading-section">
      <div>
        <strong>Grading scheme:</strong><br/>
        ${GRADING_SCALE.map((scale, index) => `${scale.min}${index === 0 ? "–100" : `–&lt;${GRADING_SCALE[index - 1].min}`} ${escapeHtml(scale.grade)}`).join(" &nbsp;|&nbsp; ")}
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
            ${IDENTIFIER_RANGES.map(
              (r) => `
              <tr>
                <td><strong>Level ${r.level}</strong></td>
                <td>${r.min.toFixed(2)} - ${r.max.toFixed(2)}</td>
                <td>${escapeHtml(r.descriptor)}</td>
              </tr>
            `,
            ).join("")}
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
    .cbc-outcome-score { font-weight: bold; min-width: 72px; text-align: right; }
    .cbc-evidence { font-size: 6.5pt; text-align: right; color: #333; }
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
    .cbc-provisional { border: 1px solid #b45309; padding: 6px; margin: 6px 0; font-size: 9pt; }

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
