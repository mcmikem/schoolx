import { escapeHtml } from "@/lib/cbc-report";

/**
 * Printable Uganda Primary Pupil's Progress Report — the layout Ugandan
 * schools, parents, and inspectors expect (see the reference: republic
 * header, boxed title, MID/END/AVG/AGG/GRADE table, UNEB legend,
 * behaviour grid, ruled remarks, signatures + stamp).
 *
 * Rendered as standalone print HTML (window.open + print()), black on
 * white, so it looks right on paper with or without the app stylesheet.
 */

export interface UgandaPrintSubject {
  name: string;
  bot: number | null;
  mot: number | null;
  eot: number | null;
  avg: number | null;
  agg: number | null;
  grade: string;
  remarks: string;
}

export interface UgandaPrintInput {
  school: {
    name: string;
    address?: string | null;
    phone?: string | null;
    motto?: string | null;
    logoUrl?: string | null;
    sigClassUrl?: string | null;
    sigHeadUrl?: string | null;
  };
  pupil: {
    name: string;
    studentNumber: string;
    pupilId?: string;
    gender: string;
    className: string;
    photoUrl?: string | null;
    term: number | string;
    year: string;
    attendancePresent: number | null;
    attendanceTotal: number | null;
  };
  subjects: UgandaPrintSubject[];
  totals: {
    midTotal: number | null;
    endTotal: number | null;
    avgMean: number | null;
    aggSum: number | null;
    division: string;
  };
  comments: { classTeacher: string; hm: string };
  position?: number | null;
  feeBalance: number | null;
  nextTermBegins: string | null;
}

const cell = (v: number | null): string => (v === null ? "—" : String(v));
const money = (n: number): string => `UGX ${Number(n || 0).toLocaleString()}`;

const GRADING_LEGEND: Array<Array<[string, string]>> = [
  [
    ["80-100: D1", "70-74: C3"],
    ["75-79: D2", "65-69: C4"],
  ],
  [
    ["60-64: C5", "50-54: P7"],
    ["55-59: C6", "45-49: P8"],
  ],
];

const BEHAVIOUR_ROWS: Array<[string, string]> = [
  ["Discipline", "Cleanliness"],
  ["Responsibility", "Sports"],
];

function signatureCell(imageUrl: string | null | undefined, caption: string): string {
  const visual = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(caption)} signature" style="max-height:56px;max-width:160px;object-fit:contain;">`
    : `<div style="border-bottom:1px solid #000;width:170px;height:40px;"></div>`;
  return `<div style="text-align:center;">${visual}<div style="font-size:11px;margin-top:4px;">${escapeHtml(caption)}</div></div>`;
}

export function generateUgandaPrimaryHTML(input: UgandaPrintInput): string {
  return ugandaDocumentShell(`Progress Report - ${input.pupil.name}`, generateUgandaPrimaryBody(input));
}

/** Full print document around one or more report bodies. */
export function ugandaDocumentShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;color:#000;max-width:760px;margin:0 auto;padding:24px;}
    table{width:100%;border-collapse:collapse;margin:6px 0 10px;}
    h2.section{font-size:14px;text-decoration:underline;margin:16px 0 4px;}
    @media print{ body{padding:0;} .page-break{page-break-before:always;} }
  </style></head><body>${bodyHtml}</body></html>`;
}

/** Inner report content (no document shell) — print-all joins several. */
export function generateUgandaPrimaryBody(input: UgandaPrintInput): string {
  const { school, pupil, subjects, totals, comments, feeBalance, nextTermBegins } = input;
  const contact = [school.address, school.phone].filter(Boolean).join(" · ");
  const recordedAverages = subjects
    .map((subject) => subject.avg)
    .filter((average): average is number => average !== null);
  const totalSubjectAverages = recordedAverages.length
    ? recordedAverages.reduce((sum, average) => sum + average, 0)
    : null;

  const subjectRows = subjects
    .map(
      (s) => `<tr>
        <td style="padding:6px 10px;border:1px solid #000;text-align:left;">${escapeHtml(s.name)}</td>
        <td style="padding:6px 10px;border:1px solid #000;text-align:center;">${cell(s.bot)}</td>
        <td style="padding:6px 10px;border:1px solid #000;text-align:center;">${cell(s.mot)}</td>
        <td style="padding:6px 10px;border:1px solid #000;text-align:center;">${cell(s.eot)}</td>
        <td style="padding:6px 10px;border:1px solid #000;text-align:center;">${cell(s.avg)}</td>
        <td style="padding:6px 10px;border:1px solid #000;text-align:center;font-weight:bold;">${cell(s.agg)}</td>
        <td style="padding:6px 10px;border:1px solid #000;text-align:center;font-weight:bold;">${escapeHtml(s.grade)}</td>
        <td style="padding:6px 10px;border:1px solid #000;">${escapeHtml(s.remarks)}</td>
        <td style="padding:6px 10px;border:1px solid #000;text-align:center;"></td>
      </tr>`,
    )
    .join("");

  const legendHtml = GRADING_LEGEND.map(
    (row) =>
      `<tr>${row.map(([a, b]) => `<td style="padding:4px 10px;border:1px solid #000;font-size:11px;">${escapeHtml(a)}</td><td style="padding:4px 10px;border:1px solid #000;font-size:11px;">${escapeHtml(b)}</td>`).join("")}</tr>`,
  ).join("");

  const behaviourHtml = BEHAVIOUR_ROWS.map(
    ([left, right]) =>
      `<tr><td style="padding:6px 12px;border:1px solid #000;font-size:12px;">${left}</td><td style="padding:6px 12px;border:1px solid #000;"></td><td style="padding:6px 12px;border:1px solid #000;font-size:12px;">${right}</td><td style="padding:6px 12px;border:1px solid #000;"></td></tr>`,
  ).join("");

  const remarkBlock = (label: string, text: string): string => `
    <p style="font-size:13px;font-weight:bold;margin:14px 0 2px;">${label}:</p>
    ${text ? `<p style="font-size:13px;margin:0 0 2px;">${escapeHtml(text)}</p>` : ""}
    <div style="border-bottom:1px solid #000;height:26px;"></div>`;

  return `<div class="uganda-report" style="font-family:Arial,Helvetica,sans-serif;color:#000;">
    <div style="text-align:center;">
      <div style="font-size:12px;font-weight:bold;letter-spacing:1px;">THE REPUBLIC OF UGANDA</div>
      ${school.logoUrl ? `<img src="${escapeHtml(school.logoUrl)}" alt="School logo" style="max-height:70px;max-width:90px;object-fit:contain;">` : ""}
      <div style="font-size:24px;font-weight:bold;margin:2px 0;">${escapeHtml(school.name || "SCHOOL NAME")}</div>
      ${school.motto ? `<div style="font-size:12px;font-style:italic;">${escapeHtml(school.motto)}</div>` : ""}
      <div style="font-size:13px;font-weight:bold;">MINISTRY OF EDUCATION AND SPORTS</div>
      ${contact ? `<div style="font-size:11px;">${escapeHtml(contact)}</div>` : ""}
      <div style="font-size:11px;font-weight:bold;margin-top:8px;">PRIMARY PUPIL'S PROGRESS REPORT</div>
      <div style="display:inline-block;border:1.5px solid #000;padding:4px 18px;font-size:12px;font-weight:bold;margin-top:4px;">TERM ${escapeHtml(String(pupil.term))} ACADEMIC REPORT — ${escapeHtml(pupil.year)}</div>
    </div>
    <div style="border-bottom:2px solid #000;margin:10px 0;"></div>
    <table style="font-size:12px;"><tbody>
      <tr>
        <td rowspan="2" style="width:84px;padding:2px 8px 2px 0;">${pupil.photoUrl ? `<img src="${escapeHtml(pupil.photoUrl)}" alt="${escapeHtml(pupil.name)}" style="width:72px;height:88px;object-fit:cover;border:1px solid #888;">` : ""}</td>
        <td style="padding:3px 0;">Name: <u>&nbsp;${escapeHtml(pupil.name)}&nbsp;</u></td>
        <td style="padding:3px 0;">Student No./LIN: <u>&nbsp;${escapeHtml(pupil.studentNumber)}&nbsp;</u></td>
        <td style="padding:3px 0;">Pupil ID: <u>&nbsp;${escapeHtml(pupil.pupilId || "—")}&nbsp;</u></td>
        <td style="padding:3px 0;">Gender: <u>&nbsp;${escapeHtml(pupil.gender)}&nbsp;</u></td>
      </tr>
      <tr>
        <td style="padding:3px 0;">Class: <u>&nbsp;${escapeHtml(pupil.className)}&nbsp;</u></td>
        <td style="padding:3px 0;">Term: <u>&nbsp;${escapeHtml(String(pupil.term))}&nbsp;</u></td>
        <td style="padding:3px 0;">Year: <u>&nbsp;${escapeHtml(pupil.year)}&nbsp;</u></td>
        <td style="padding:3px 0;">Attendance: <u>&nbsp;${pupil.attendancePresent ?? "—"}&nbsp;/&nbsp;${pupil.attendanceTotal ?? "—"}&nbsp;</u></td>
        <td style="padding:3px 0;">Position: <u>&nbsp;${input.position || "—"}&nbsp;</u></td>
      </tr>
    </tbody></table>

    <h2 style="font-size:14px;text-decoration:underline;margin:16px 0 4px;">ACADEMIC PERFORMANCE</h2>
    <table style="font-size:12px;">
      <thead><tr style="background:#eee;">
        <th rowspan="2" style="border:1px solid #000;padding:6px;">SUBJECT</th>
        <th colspan="3" style="border:1px solid #000;padding:4px;">MARKS (EACH OUT OF 100)</th>
        <th rowspan="2" style="border:1px solid #000;padding:6px;">AVG %</th>
        <th rowspan="2" style="border:1px solid #000;padding:6px;">AGG</th>
        <th rowspan="2" style="border:1px solid #000;padding:6px;">GRADE</th>
        <th rowspan="2" style="border:1px solid #000;padding:6px;">REMARKS</th>
        <th rowspan="2" style="border:1px solid #000;padding:6px;">INITIALS</th>
      </tr><tr style="background:#eee;">
        <th style="border:1px solid #000;padding:4px;">BOT</th>
        <th style="border:1px solid #000;padding:4px;">MOT</th>
        <th style="border:1px solid #000;padding:4px;">EOT</th>
      </tr></thead>
      <tbody>
        ${subjectRows}
        <tr>
        <td colspan="4" style="padding:6px 10px;border:1px solid #000;font-weight:bold;text-align:center;">TOTAL OF SUBJECT AVERAGES: ${cell(totalSubjectAverages)}<br>Simple mean of available BOT, MOT and EOT marks</td>
          <td style="padding:6px 10px;border:1px solid #000;text-align:center;font-weight:bold;">${cell(totals.avgMean)}%</td>
          <td style="padding:6px 10px;border:1px solid #000;font-weight:bold;">AGG: ${cell(totals.aggSum)}</td>
          <td style="padding:6px 10px;border:1px solid #000;font-weight:bold;">${escapeHtml(totals.division)}</td>
          <td style="padding:6px 10px;border:1px solid #000;"></td>
          <td style="padding:6px 10px;border:1px solid #000;"></td>
        </tr>
      </tbody>
    </table>

    <table style="width:100%;border:0;"><tbody><tr>
      <td style="vertical-align:top;width:48%;border:0;padding:0 8px 0 0;">
        <h2 style="font-size:14px;text-decoration:underline;margin:16px 0 4px;">GRADING SYSTEM</h2>
        <table style="font-size:11px;"><tbody>
          ${legendHtml}
          <tr><td colspan="4" style="padding:4px 10px;border:1px solid #000;font-size:11px;text-align:center;font-weight:bold;">0-44: F9 (Fail) | X: Absent</td></tr>
        </tbody></table>
      </td>
      <td style="vertical-align:top;width:52%;border:0;padding:0 0 0 8px;">
        <h2 style="font-size:14px;text-decoration:underline;margin:16px 0 4px;">BEHAVIOUR &amp; CO-CURRICULAR</h2>
        <table style="font-size:12px;"><tbody>
          <tr><td style="padding:6px 12px;border:1px solid #000;font-weight:bold;">Skill</td><td style="padding:6px 12px;border:1px solid #000;font-weight:bold;">1-5</td><td style="padding:6px 12px;border:1px solid #000;font-weight:bold;">Skill</td><td style="padding:6px 12px;border:1px solid #000;font-weight:bold;">1-5</td></tr>
          ${behaviourHtml}
        </tbody></table>
      </td>
    </tr></tbody></table>

    ${remarkBlock("Class Teacher's Remarks", comments.classTeacher)}
    ${remarkBlock("Head Teacher's Remarks", comments.hm)}

    <table style="font-size:12px;margin-top:14px;"><tbody><tr>
      <td style="border:0;"><strong>Next Term Begins:</strong> <u>&nbsp;${nextTermBegins ? escapeHtml(nextTermBegins) : "&nbsp;&nbsp;/&nbsp;&nbsp;/20&nbsp;&nbsp;&nbsp;&nbsp;"}&nbsp;</u></td>
      <td style="border:0;text-align:right;"><strong>Fees Balance:</strong> <u>&nbsp;${feeBalance === null ? "Not recorded" : feeBalance > 0 ? money(feeBalance) : "Cleared"}&nbsp;</u></td>
    </tr></tbody></table>

    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:34px;">
      ${signatureCell(school.sigClassUrl, "Class Teacher")}
      <div style="border:1.5px dashed #888;color:#888;font-size:10px;padding:18px 26px;text-align:center;">SCHOOL<br>STAMP</div>
      ${signatureCell(school.sigHeadUrl, "Head Teacher")}
    </div>
  </div>`;
}
