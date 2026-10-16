import { escapeHtml } from "@/lib/cbc-report";
import { brandPalette } from "@/lib/report-brand";

/**
 * Printable Uganda Primary Pupil's Progress Report.
 *
 * Laid out against the official form: republic header, boxed title,
 * Name/LIN/Gender and Class/Term/Year/Attendance, a MARKS group over
 * AVG %/AGG/GRADE/REMARKS, a TOTALS row carrying DIV and AGG, the UNEB
 * grading bands beside the behaviour grid, ruled remarks, and the
 * Class Teacher / stamp / Head Teacher signature row.
 *
 * Rendered as a standalone, self-contained document (see lib/print-window)
 * so what leaves the printer is this file's CSS and nothing else -- it does
 * not inherit the app's @media print rules, which hide app chrome that is
 * simply absent here. Sized for A4 portrait via @page and a fixed 190mm
 * content width: measured at 71% page height for a typical seven-subject
 * pupil and 82% at twelve, both single-page.
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
    /** schools.primary_color -- validated and contrast-floored before use. */
    primaryColor?: string | null;
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
  /**
   * Behaviour / co-curricular ratings recorded for this pupil this term.
   * Printed as given; an empty list prints an honest note rather than four
   * boxes that look like missing data on a document nobody can write on.
   */
  behaviour?: Array<{ skill: string; rating: number | null }>;
  /**
   * When the report was produced. Printed on the stamp so a copy that turns up
   * months later can be traced -- and so a parent cannot pass off last year's
   * card as this year's.
   */
  generatedAt?: Date | string;
  /**
   * Whether the school runs a Beginning-of-Term assessment. When false the
   * report prints no BOT column at all -- an empty column on a parent's copy
   * reads as "the teacher did not record it".
   */
  showBot?: boolean;
  position?: number | null;
  feeBalance: number | null;
  nextTermBegins: string | null;
}

const cell = (v: number | null): string => (v === null ? "—" : String(v));
const money = (n: number): string => `UGX ${Number(n || 0).toLocaleString()}`;

const GRADING_LEGEND: string[] = [
  "80-100: D1",
  "70-74: C3",
  "60-64: C5",
  "50-54: P7",
  "75-79: D2",
  "65-69: C4",
  "55-59: C6",
  "45-49: P8",
];

/** The four cells on the official form, in the order it prints them. */
const DEFAULT_BEHAVIOUR_SKILLS = ["Discipline", "Cleanliness", "Responsibility", "Sports"];

/**
 * A signature block.
 *
 * `schools` holds one signature_headteacher_url and one
 * signature_class_teacher_url for the whole school, but every class has a
 * different class teacher. Printing one image under "Class Teacher" therefore
 * shows the same signature on every pupil in the school, which reads as
 * "this child's teacher signed it". Where an image is supplied it is labelled
 * as the school's authorised signatory instead; where it is not, the rule is
 * left blank for the teacher who actually taught the class to sign by hand.
 */
function signatureCell(
  imageUrl: string | null | undefined,
  caption: string,
  brand: string,
  signedLabel: string,
): string {
  const visual = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(signedLabel)}" style="max-height:52px;max-width:140px;object-fit:contain;">`
    : `<div style="border-bottom:1px solid #000;width:140px;height:34px;"></div>`;
  const label = imageUrl ? signedLabel : caption;
  return `<div style="text-align:center;width:33%;">${visual}<div style="font-size:9.5px;margin-top:3px;color:${brand};">${escapeHtml(label)}</div></div>`;
}

export function generateUgandaPrimaryHTML(input: UgandaPrintInput): string {
  return ugandaDocumentShell(`Progress Report - ${input.pupil.name}`, generateUgandaPrimaryBody(input));
}

/**
 * Full print document around one or more report bodies.
 *
 * Sized for A4 portrait: @page owns the margins so nothing is clipped, and the
 * body is held to a fixed 190mm content width (210mm - 2x10mm) so what the
 * teacher previews is what comes out of the printer.
 */
export function ugandaDocumentShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body{
    font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;
    width:190mm;margin:0 auto;padding:0;font-size:11.5px;line-height:1.28;
  }
  /* Screen preview only -- the paper already has @page margins. */
  @media screen { body{width:auto;max-width:190mm;padding:12px;} }
  table{width:100%;border-collapse:collapse;margin:0;}
  th,td{border:1px solid #000;padding:4px 6px;vertical-align:middle;}
  h2.section{font-size:12px;font-weight:bold;margin:10px 0 3px;letter-spacing:.02em;}
  .page-break{page-break-before:always;}
  /* Never orphan a signature from the page it belongs to. */
  .signatures{page-break-inside:avoid;}
</style></head><body>${bodyHtml}</body></html>`;
}

/** Inner report content (no document shell) — print-all joins several. */
export function generateUgandaPrimaryBody(input: UgandaPrintInput): string {
  const { school, pupil, subjects, totals, comments, feeBalance, nextTermBegins } = input;
  const contact = [school.address, school.phone].filter(Boolean).join(" · ");
  // Callers pass "DIV 2" / "DIV I"; prefixing again produced "DIV: DIV 2" and
  // wrapped the cell. Only add the prefix when it is not already there.
  // Column count drives every colspan below, so it is derived once here
  // rather than hardcoded: 1 subject + (showBot ? 3 : 2) marks + avg/agg/grade/remarks.
  const showBot = input.showBot !== false;
  const markColumns = showBot ? 3 : 2;
  const markColspan = markColumns;
  const leadColspan = 1 + markColumns;

  const brand = brandPalette(school.primaryColor);

  // Local calendar day, never toISOString(): that shifts to UTC and can print
  // yesterday's date, or tomorrow's, depending on the reader's offset.
  const stampDate = (() => {
    const raw = input.generatedAt ?? new Date();
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  })();

  const divisionCell = /^div\b/i.test(totals.division.trim())
    ? escapeHtml(totals.division)
    : `DIV: ${escapeHtml(totals.division)}`;

  const td = (content: string, extra = "", colspan?: number): string =>
    `<td${colspan ? ` colspan="${colspan}"` : ""} style="${extra}">${content}</td>`;

  const subjectRows = subjects
    .map(
      (s) => `<tr>
        ${td(escapeHtml(s.name), "text-align:left;width:26%;")}
        ${showBot ? td(cell(s.bot), "text-align:center;") : ""}
        ${td(cell(s.mot), "text-align:center;")}
        ${td(cell(s.eot), "text-align:center;")}
        ${td(cell(s.avg), "text-align:center;")}
        ${td(cell(s.agg), "text-align:center;font-weight:bold;")}
        ${td(escapeHtml(s.grade), "text-align:center;font-weight:bold;width:8%;")}
        ${td(escapeHtml(s.remarks), "text-align:left;")}
      </tr>`,
    )
    .join("");

  // Official layout is four bands across, then a full-width fail/absent row.
  const legendHtml =
    `<tr>${GRADING_LEGEND.slice(0, 4).map((band) => td(escapeHtml(band), "text-align:center;font-size:10px;")).join("")}</tr>` +
    `<tr>${GRADING_LEGEND.slice(4).map((band) => td(escapeHtml(band), "text-align:center;font-size:10px;")).join("")}</tr>` +
    `<tr>${td("0-44: F9 (Fail) | X: Absent", "text-align:center;font-size:10px;font-weight:bold;", 4)}</tr>`;

  // Show what was recorded, in the order the form uses. Nothing recorded is
  // stated in words -- four empty boxes read as "this teacher did not fill
  // this in" to a parent, which is exactly the impression to avoid.
  const recorded = new Map(
    (input.behaviour ?? []).map((entry) => [entry.skill.trim().toLowerCase(), entry.rating]),
  );
  const skills =
    input.behaviour && input.behaviour.length > 0
      ? input.behaviour.map((entry) => entry.skill)
      : DEFAULT_BEHAVIOUR_SKILLS;
  const anyRecorded = skills.some((skill) => recorded.has(skill.trim().toLowerCase()));

  const behaviourBody = skills.length
    ? Array.from({ length: Math.ceil(skills.length / 2) }, (_, row) => {
        const pair = [skills[row * 2], skills[row * 2 + 1]].filter(Boolean);
        return `<tr>${pair
          .map(
            (skill) =>
              `${td(escapeHtml(skill), "text-align:left;font-size:10.5px;width:30%;")}${td(
                recorded.get(skill.trim().toLowerCase()) != null
                  ? String(recorded.get(skill.trim().toLowerCase()))
                  : "",
                "text-align:center;font-weight:bold;width:12%;",
              )}`,
          )
          .join("")}</tr>`;
      }).join("")
    : "";

  const behaviourFootnote = anyRecorded
    ? ""
    : `<p style="font-size:9px;color:#666;margin:3px 0 0;">Not recorded for this pupil this term.</p>`;

  // `label` is an internal constant, never user input, so it is interpolated
// directly -- escaping it would entity-encode the apostrophe in "Teacher's"
// for no benefit. The free-text remark beside it is always escaped.
const remarkBlock = (label: string, text: string): string => `
    <div style="page-break-inside:avoid;">
      <p style="font-size:11px;font-weight:bold;margin:9px 0 1px;">${label}:</p>
      ${text ? `<p style="font-size:11px;margin:0 0 1px;">${escapeHtml(text)}</p>` : ""}
      <div style="border-bottom:1px solid #000;height:24px;"></div>
    </div>`;

  // No photo is common -- most schools never upload one. An empty dashed box
  // reads as a broken image, so fall back to the pupil's initials on the brand
  // wash, which looks deliberate and still identifies the child at a glance.
  const initials = pupil.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const photo = pupil.photoUrl
    ? `<img src="${escapeHtml(pupil.photoUrl)}" alt="${escapeHtml(pupil.name)}" style="width:84px;height:102px;object-fit:cover;border:1.5px solid ${brand.ink};">`
    : `<div style="width:84px;height:102px;border:1.5px solid ${brand.wash === brand.ink ? "#ccc" : brand.ink};background:${brand.wash};display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:bold;color:${brand.ink};">${escapeHtml(initials)}</div>`;

  const identity = (label: string, value: string): string =>
    `<div><span style="display:inline-block;width:56px;">${escapeHtml(label)}:</span> <span style="display:inline-block;border-bottom:1px solid #000;min-width:104px;padding:0 3px;">${escapeHtml(value)}</span></div>`;

  const watermark = school.logoUrl
    ? `<img src="${escapeHtml(school.logoUrl)}" alt="" aria-hidden="true" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:290px;height:290px;object-fit:contain;opacity:.05;">`
    : `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:42px;font-weight:bold;color:${brand.ink};opacity:.045;white-space:nowrap;letter-spacing:.04em;">${escapeHtml(school.name || "")}</div>`;

  return `<div class="uganda-report" style="position:relative;">
    <div aria-hidden="true" style="position:absolute;inset:0;overflow:hidden;pointer-events:none;">${watermark}</div>
    <div style="position:relative;text-align:center;">
      ${school.logoUrl ? `<img src="${escapeHtml(school.logoUrl)}" alt="School logo" style="max-height:62px;max-width:104px;object-fit:contain;margin:0 auto 2px;">` : ""}
      <div style="font-size:9px;font-weight:bold;letter-spacing:2px;color:${brand.ink};opacity:.75;">THE REPUBLIC OF UGANDA</div>
      <div style="font-size:22px;font-weight:bold;line-height:1.1;color:${brand.ink};">${escapeHtml(school.name || "SCHOOL NAME")}</div>
      <div style="font-size:10.5px;font-weight:bold;letter-spacing:.4px;">MINISTRY OF EDUCATION AND SPORTS</div>
      ${contact ? `<div style="font-size:9.5px;color:#333;">${escapeHtml(contact)}</div>` : ""}
      ${school.motto ? `<div style="font-size:9.5px;font-style:italic;color:#444;">${escapeHtml(school.motto)}</div>` : ""}
      <div style="display:inline-block;border:2px solid ${brand.ink};color:${brand.ink};padding:3px 18px;font-size:12px;font-weight:bold;letter-spacing:.5px;margin-top:6px;">PRIMARY PUPIL'S PROGRESS REPORT</div>
    </div>

    <div style="display:flex;gap:8px;align-items:flex-start;margin:8px 0 2px;">
      <div style="width:84px;flex:none;">${photo}</div>
      <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:1px 12px;font-size:10.5px;">
        ${identity("Name", pupil.name)}
        ${identity("LIN", pupil.studentNumber)}
        ${identity("Class", pupil.className)}
        ${identity("Term", String(pupil.term))}
        ${identity("Year", pupil.year)}
        ${identity("Gender", pupil.gender)}
        <div style="grid-column:1 / -1;">${identity("Attendance", `${pupil.attendancePresent ?? "—"} / ${pupil.attendanceTotal ?? "—"}`)}</div>
      </div>
    </div>

    <h2 class="section" style="color:${brand.ink};border-bottom:2px solid ${brand.ink};padding-bottom:1px;">ACADEMIC PERFORMANCE</h2>
    <table>
      <thead>
        <tr>
          <th rowspan="2" style="text-align:left;">SUBJECT</th>
          <th colspan="${markColspan}" style="text-align:center;">MARKS (EACH OUT OF 100)</th>
          <th rowspan="2" style="text-align:center;">AVG %</th>
          <th rowspan="2" style="text-align:center;">AGG</th>
          <th rowspan="2" style="text-align:center;">GRADE</th>
          <th rowspan="2" style="text-align:left;">REMARKS / COMPETENCY</th>
        </tr>
        <tr>
          ${showBot ? '<th style="text-align:center;">BOT</th>' : ""}
          <th style="text-align:center;">MOT</th>
          <th style="text-align:center;">EOT</th>
        </tr>
      </thead>
      <tbody>
        ${subjectRows}
        <tr>
          ${td("TOTALS", "font-weight:bold;text-align:center;", leadColspan)}
          ${td(cell(totals.avgMean), "text-align:center;font-weight:bold;")}
          ${td(`AGG: ${cell(totals.aggSum)}`, "text-align:center;font-weight:bold;")}
          ${td(divisionCell, "text-align:center;font-weight:bold;")}
          ${td("", "")}
        </tr>
      </tbody>
    </table>

    <div style="display:flex;gap:12px;align-items:flex-start;">
      <div style="width:52%;">
        <h2 class="section" style="color:${brand.ink};border-bottom:2px solid ${brand.ink};padding-bottom:1px;">GRADING SYSTEM</h2>
        <table>${legendHtml}</table>
      </div>
      <div style="width:48%;">
        <h2 class="section" style="color:${brand.ink};border-bottom:2px solid ${brand.ink};padding-bottom:1px;">BEHAVIOUR &amp; CO-CURRICULAR</h2>
        <table>
          <thead><tr>
            ${td("Skill", "font-weight:bold;font-size:10px;text-align:left;")}
            ${td("1-5", "font-weight:bold;font-size:10px;text-align:center;")}
            ${td("Skill", "font-weight:bold;font-size:10px;text-align:left;")}
            ${td("1-5", "font-weight:bold;font-size:10px;text-align:center;")}
          </tr></thead>
          <tbody>${behaviourBody}</tbody>
        </table>
        ${behaviourFootnote}
      </div>
    </div>

    ${remarkBlock("Class Teacher's Remarks", comments.classTeacher)}
    ${remarkBlock("Head Teacher's Remarks", comments.hm)}

    <div style="display:flex;justify-content:space-between;font-size:10.5px;margin-top:9px;">
      <div><strong>Next Term Begins:</strong> <span style="border-bottom:1px solid #000;display:inline-block;min-width:110px;text-align:center;">${nextTermBegins ? escapeHtml(nextTermBegins) : "&nbsp;/&nbsp;/20&nbsp;&nbsp;&nbsp;"}</span></div>
      <div><strong>Fees Balance:</strong> <span style="border-bottom:1px solid #000;display:inline-block;min-width:110px;text-align:center;">${feeBalance === null ? "Not recorded" : feeBalance > 0 ? money(feeBalance) : "Cleared"}</span></div>
    </div>

    <div class="signatures" style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:22px;">
      ${signatureCell(school.sigClassUrl, "Class Teacher", brand.ink, "Authorised signatory")}
      <div style="width:33%;text-align:center;">
        <div style="display:inline-block;border:2px solid ${brand.ink};border-radius:3px;padding:7px 12px;color:${brand.ink};">
          ${
            school.logoUrl
              ? `<img src="${escapeHtml(school.logoUrl)}" alt="" style="max-height:30px;max-width:60px;object-fit:contain;margin:0 auto 3px;display:block;">`
              : ""
          }
          <div style="font-size:8px;font-weight:bold;letter-spacing:1px;">SCHOOL STAMP</div>
          ${stampDate ? `<div style="font-size:7px;letter-spacing:.5px;margin-top:1px;">ISSUED ${escapeHtml(stampDate)}</div>` : ""}
        </div>
      </div>
      ${signatureCell(school.sigHeadUrl, "Head Teacher", brand.ink, "Head Teacher")}
    </div>
  </div>`;
}
