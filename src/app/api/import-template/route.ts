import { NextRequest } from "next/server";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } from "docx";
import { requireUserWithSchool } from "@/lib/api-utils";

const HEADERS = [
  "First Name",
  "Last Name",
  "Gender",
  "Date of Birth",
  "Class",
  "Parent Name",
  "Parent Phone",
  "Student Number",
];

const EXAMPLE_ROWS: string[][] = [
  ["Sarah", "Nakato", "F", "2015-03-15", "P.5", "James Nakato", "0701234567", ""],
  ["John", "Mukasa", "M", "2014-06-20", "P.5", "Betty Mukasa", "0702345678", ""],
  ["Amelia", "Kirabo", "F", "2015-01-10", "P.4", "Robert Kirabo", "0703456789", ""],
];

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
    new TableRow({ children: HEADERS.map((h) => cell(h, true)) }),
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
                text: "Fill in one student per row, then upload this file to SkoolMate OS.",
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
                text: "• You can delete the example rows before uploading.",
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
                text: "Need a different layout? You can also upload your own Word or Excel file, or copy-paste text from an existing list.",
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
