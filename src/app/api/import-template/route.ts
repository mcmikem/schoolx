import { AlignmentType, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { NextRequest } from "next/server";
import { requireUserWithSchool } from "@/lib/api-utils";
import { STUDENT_TEMPLATE_HEADERS } from "@/lib/import/students";

// No example rows: this file goes straight into the importer, and an example
// row is a row that becomes a real student named "Sarah Nakato". The registry
// CSV and the import page's Excel template dropped theirs for the same reason.
const EXAMPLE_ROWS: string[][] = [];

/** Exposed so a test can pin this document to the shared column list. */
export const TEMPLATE_HEADERS = STUDENT_TEMPLATE_HEADERS;

async function handleGet(request: NextRequest) {
  const auth = await requireUserWithSchool(request);
  if (!auth.ok) return auth.response;

  const cell = (text: string, header = false) =>
    new TableCell({
      shading: header ? { fill: "E8EDF5", type: "clear", color: "auto" } : undefined,
      margins: { top: 120, bottom: 120, left: 150, right: 150 },
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: header, size: 20 })],
        }),
      ],
    });

  const rows = [
    new TableRow({ children: STUDENT_TEMPLATE_HEADERS.map((h) => cell(h, true)) }),
    ...EXAMPLE_ROWS.map((row) => new TableRow({ children: row.map((v) => cell(v)) })),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Student Registration Template", bold: true, size: 36 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `Fill in one student per row under the ${STUDENT_TEMPLATE_HEADERS.length} column headings, then upload this file to SkoolMate OS. Leave a heading empty if it does not apply.`,
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [new TextRun({ text: "Instructions:", bold: true, size: 22 })],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "• Gender: use M (male) or F (female).",
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "• Class: use the exact class names already set up in your school, e.g. P.5 or S.1.",
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "• Only the heading row is supplied. Start the first learner on the row directly below it.",
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: "• Student Number and Date of Birth are optional.",
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 200 },
            children: [
              new TextRun({
                text: "Other accepted formats: .xlsx, .csv, or plain text. The Excel and CSV templates carry the same headings as this document.",
                size: 22,
                italics: true,
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows,
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="SkoolMateOS_Student_Template.docx"',
      "Cache-Control": "no-store",
    },
  });
}

export const GET = handleGet;
