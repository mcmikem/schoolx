"use client";

/**
 * Exam Lab converts uploaded papers into teacher-reviewed student practice.
 *
 * The PDF remains the source of truth; extracted text and generated answers are
 * presented for review rather than treated as a perfect transcription. Saved
 * papers can be resumed, published to a class, answered in the student portal,
 * and manually marked by a teacher.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PdfSourceViewer from "@/components/exam/PdfSourceViewer";
import { useAcademic } from "@/lib/academic-context";
import { useAuth } from "@/lib/auth-context";
import type { DiagramCrop, ExamPaper } from "@/lib/exam/exam-model";
import { auditPaper, needsHuman, needsReview, reconcile } from "@/lib/exam/exam-model";
import { parsePaper } from "@/lib/exam/parse-paper";
import { extractTextFromPdf } from "@/lib/exam/pdf-text";
import { renderPaperForm } from "@/lib/exam/render-form";
import { useClasses, useSubjects } from "@/lib/hooks";
import { withTimeout } from "@/lib/hooks/utils";
import { newOfflineId } from "@/lib/offline";
import { supabase } from "@/lib/supabase";

const SAMPLE = `MATHEMATICS END OF TERM TEST
Subject: Mathematics
Class: P.7
Term: 2
Year: 2026

Total marks: 14

1. What is the value of 45 multiplied by 12? (2 marks)
2. Which of the following is the greatest prime number? (2 marks)
   (a) 21
   (b) 27
   (c) 29
   (d) 33
3. A farmer has 240 oranges. He sold 3/4 of them. How many oranges are left? (3 marks)
4. Explain why the sum of two even numbers is even. (5 marks)
5. Sketch the diagram below and label it. (2 marks)
`;

type SavedPaper = {
  id: string;
  name: string;
  class_id: string;
  subject_id: string;
  exam_date: string;
  term: number;
  academic_year: string;
  paper_model: ExamPaper & { assignment?: { published?: boolean; due_date?: string; source_path?: string } };
};

export default function ExamLabPage() {
  const { school, user, isDemo } = useAuth();
  const { academicYear, currentTerm } = useAcademic();
  const { classes } = useClasses(school?.id);
  const { subjects } = useSubjects(school?.id);
  const [text, setText] = useState(SAMPLE);
  const [extractedPages, setExtractedPages] = useState<string[] | null>(null);
  const [extractedPageImages, setExtractedPageImages] = useState<Record<number, string> | null>(null);
  const [extractedDiagramCrops, setExtractedDiagramCrops] = useState<DiagramCrop[] | null>(null);
  // Default to a manual paste, which is what the sample below is. File reads
  // set this from how they actually extracted the text.
  const [ocr, setOcr] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [howRead, setHowRead] = useState<string | null>(null);
  const [scanPageCount, setScanPageCount] = useState<number | null>(null);
  const [scanPageStart, setScanPageStart] = useState(1);
  const [scanPageEnd, setScanPageEnd] = useState(10);
  const [rawExtract, setRawExtract] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourcePdfData, setSourcePdfData] = useState<ArrayBuffer | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [teacherConfirmed, setTeacherConfirmed] = useState(false);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [paperOverride, setPaperOverride] = useState<SavedPaper["paper_model"] | null>(null);
  const [savedPapers, setSavedPapers] = useState<SavedPaper[]>([]);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    if (!school?.id || isDemo) return;
    void withTimeout(
      supabase
        .from("exams")
        .select("id,name,class_id,subject_id,exam_date,term,academic_year,paper_model")
        .eq("school_id", school.id)
        .not("paper_model", "is", null)
        .order("created_at", { ascending: false })
        .limit(25),
      10000,
      { data: [], error: new Error("Could not load saved papers") } as any,
    )
      .then((response) => {
        if (!response.error) setSavedPapers((response.data || []) as SavedPaper[]);
      })
      .catch(() => setSaveMessage("Could not load saved papers. Check your connection and try again."));
  }, [school?.id, isDemo]);

  const result = useMemo(() => {
    try {
      return parsePaper(text, {
        ocr,
        pageTexts: extractedPages ?? undefined,
        pageImages: extractedPageImages ?? undefined,
        diagramCrops: extractedDiagramCrops ?? undefined,
      });
    } catch (e) {
      // A parser that throws should say so here rather than blanking the page.
      return { paper: null, warnings: [`Parser threw: ${e instanceof Error ? e.message : String(e)}`] };
    }
  }, [text, ocr, extractedPages, extractedPageImages, extractedDiagramCrops]);

  const practiceTitle =
    title || paperOverride?.title || result.paper?.title || sourceFile?.name.replace(/\.pdf$/i, "") || "";
  const paper: SavedPaper["paper_model"] | null = paperOverride || result.paper;

  const html = useMemo(() => (paper ? renderPaperForm(paper, { includeMarking: true }) : ""), [paper]);

  const marks = paper ? reconcile(paper) : null;
  const review = paper ? needsReview(paper) : [];
  const human = paper ? needsHuman(paper) : [];
  const audited = paper ? auditPaper(paper) : [];

  const resumePaper = async (savedPaper: SavedPaper) => {
    if (sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(sourceUrl);
    setSourcePdfData(null);
    setExtractedPageImages(null);

    setExtractedDiagramCrops(null);
    setSelectedSavedId(savedPaper.id);
    setPaperOverride(savedPaper.paper_model);
    setSourceFile(null);
    setTitle(savedPaper.name);
    setClassId(savedPaper.class_id);
    setSubjectId(savedPaper.subject_id);
    setDueDate(savedPaper.paper_model.assignment?.due_date || savedPaper.exam_date);
    const savedText = savedPaper.paper_model.questions.map((question) => question.sourceText).join("\n");
    setText(savedText);
    setRawExtract(savedText);
    setOcr(savedPaper.paper_model.ocrApplied);
    setTeacherConfirmed(false);
    setSaveMessage(null);
    setHowRead("Saved paper loaded. Review the original PDF before publishing.");
    const sourcePath = savedPaper.paper_model.assignment?.source_path;
    if (sourcePath) {
      const { data } = await supabase.storage.from("exam-papers").createSignedUrl(sourcePath, 3600);
      setSourceUrl(data?.signedUrl || null);
    }
  };

  const savePaper = async (publish: boolean) => {
    if (!school?.id || !user?.id || !paper || (!sourceFile && !selectedSavedId)) return;
    if (isDemo) {
      setSaveMessage("Demo mode cannot publish a real paper. Sign in to a school account to save it.");
      return;
    }
    if (!classId || !subjectId || !dueDate || !practiceTitle.trim()) {
      setSaveMessage("Add the title, class, subject and due date before saving.");
      return;
    }
    if (publish && !teacherConfirmed) {
      setSaveMessage(
        "Compare the extracted questions with the original PDF and confirm your review before publishing.",
      );
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    let objectPath: string | null = null;
    try {
      const examId = selectedSavedId || newOfflineId();
      const sourcePath = paper.assignment?.source_path ?? `${school.id}/${examId}/source.pdf`;
      objectPath = sourcePath;
      if (sourceFile) {
        const upload = await withTimeout(
          supabase.storage
            .from("exam-papers")
            .upload(sourcePath, sourceFile, { contentType: "application/pdf", upsert: false }),
          30000,
          {
            data: null,
            error: new Error("Uploading the PDF took too long. Check your connection and try again."),
          } as any,
        );
        if (upload.error) {
          if (/bucket not found/i.test(upload.error.message)) {
            const create = await supabase.storage.createBucket("exam-papers", {
              public: false,
              fileSizeLimit: 52428800,
              allowedMimeTypes: ["application/pdf"],
            });
            if (create.error && !/already exists|duplicated/i.test(create.error.message)) throw create.error;
            const retry = await supabase.storage
              .from("exam-papers")
              .upload(sourcePath, sourceFile, { contentType: "application/pdf", upsert: false });
            if (retry.error) throw retry.error;
          } else {
            throw upload.error;
          }
        }
      }
      const paperModel = {
        ...paper,
        title: practiceTitle.trim(),
        assignment: { published: publish, due_date: dueDate, source_path: objectPath },
      };
      const saveQuery = selectedSavedId
        ? supabase
            .from("exams")
            .update({
              name: practiceTitle.trim(),
              class_id: classId,
              subject_id: subjectId,
              exam_date: dueDate,
              max_score: paper.totalMarks || 100,
              paper_model: paperModel,
            })
            .eq("id", selectedSavedId)
            .eq("school_id", school.id)
        : supabase.from("exams").insert({
            id: examId,
            school_id: school.id,
            name: practiceTitle.trim(),
            exam_type: "class_test",
            class_id: classId,
            subject_id: subjectId,
            exam_date: dueDate,
            max_score: paper.totalMarks || 100,
            weight: 100,
            term: currentTerm,
            academic_year: academicYear,
            created_by: user.id,
            paper_model: paperModel,
          });
      const saved = await withTimeout(saveQuery, 15000, {
        error: new Error("Saving the exam took too long. Check your connection and try again."),
      } as any);
      if (saved.error) throw saved.error;
      setSelectedSavedId(examId);
      setPaperOverride(paperModel);
      setSavedPapers((current) => [
        {
          id: examId,
          name: practiceTitle.trim(),
          class_id: classId,
          subject_id: subjectId,
          exam_date: dueDate,
          term: currentTerm,
          academic_year: academicYear,
          paper_model: paperModel,
        },
        ...current.filter((row) => row.id !== examId),
      ]);
      setSaveMessage(
        publish ? "Practice paper published for the class." : "Draft saved. The original PDF is safely attached.",
      );
    } catch (saveError) {
      if (
        objectPath &&
        sourceFile &&
        !selectedSavedId &&
        !(saveError instanceof Error && saveError.message.includes("took too long"))
      ) {
        await supabase.storage.from("exam-papers").remove([objectPath]);
      }
      setSaveMessage(saveError instanceof Error ? saveError.message : "Could not save this paper.");
    } finally {
      setSaving(false);
    }
  };

  const readSelectedScanPages = async () => {
    if (!sourcePdfData || scanPageCount === null) return;
    setError(null);
    setReading("Preparing the selected pages...");
    try {
      const result = await extractTextFromPdf(sourcePdfData.slice(0), {
        pageRange: { start: scanPageStart, end: scanPageEnd },
        progress: setReading,
      });
      setReading(null);
      setScanPageCount(null);
      setHowRead(
        result.pagesRead
          ? `Read pages ${result.pagesRead.start}-${result.pagesRead.end} of ${result.pages} using ${result.method}.`
          : `Read as ${result.method} — ${result.pages} page${result.pages === 1 ? "" : "s"}.`,
      );
      setRawExtract(result.text);
      setExtractedPages(result.pageTexts);
      setExtractedPageImages(result.pageImages ?? null);

      setExtractedDiagramCrops(result.diagramCrops ?? null);
      setOcr(true);
      if (!result.text.trim()) {
        setError("No readable text was found on those pages. Try another page range or check the original PDF.");
      } else {
        setText(result.text);
      }
    } catch (err) {
      setReading(null);
      setError(err instanceof Error ? err.message : "Could not read those pages. Try again.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", padding: 16 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Exam Lab</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#5b6472" }}>
            Drop in a past paper &mdash; a PDF (scans are read by OCR here in the browser) or a text file &mdash; or
            paste its text. You get the parsed questions, the form a pupil would answer on, and an honest list of
            anything the parser was unsure about.
          </p>
          <Link
            href="/dashboard/exam-lab/submissions/"
            style={{
              display: "inline-flex",
              marginTop: 8,
              minHeight: 40,
              alignItems: "center",
              padding: "0 12px",
              border: "1px solid #cbd1d9",
              borderRadius: 7,
              color: "#24384c",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Review student submissions
          </Link>
        </header>

        <section
          style={{ background: "white", border: "1px solid #d8dce2", borderRadius: 10, padding: 14, marginBottom: 16 }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>Turn this paper into class practice</h2>
          <p style={{ fontSize: 12, color: "#5b6472", margin: "0 0 12px" }}>
            The original PDF stays attached as the source of truth. Pupils and teachers can check diagrams, graphs,
            tables and formulas against it.
          </p>
          {savedPapers.length > 0 && (
            <div style={{ marginBottom: 12, border: "1px solid #e2e6eb", borderRadius: 8, padding: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>
                Saved papers — resume a draft or update a published paper
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {savedPapers.map((savedPaper) => (
                  <button
                    key={savedPaper.id}
                    type="button"
                    onClick={() => void resumePaper(savedPaper)}
                    style={{ ...actionStyle, minHeight: 38, fontSize: 12 }}
                  >
                    {savedPaper.name} · {savedPaper.paper_model.assignment?.published ? "Published" : "Draft"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
            <label style={{ fontSize: 12 }}>
              Paper title
              <input
                value={practiceTitle}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Biology holiday practice"
                style={fieldStyle}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              Class
              <select value={classId} onChange={(event) => setClassId(event.target.value)} style={fieldStyle}>
                <option value="">Choose class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              Subject
              <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} style={fieldStyle}>
                <option value="">Choose subject</option>
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12 }}>
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                style={fieldStyle}
              />
            </label>
          </div>
          <label
            style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, fontSize: 12, lineHeight: 1.5 }}
          >
            <input
              type="checkbox"
              checked={teacherConfirmed}
              onChange={(event) => setTeacherConfirmed(event.target.checked)}
              style={{ marginTop: 2 }}
            />
            I checked the questions against the original PDF, including diagrams, tables, graphs and formulas. I
            understand the parser may miss or misread details.
          </label>
          {saveMessage && (
            <p
              role="status"
              style={{
                color: saveMessage.includes("published") || saveMessage.includes("Draft saved") ? "#1b5e34" : "#8a5a00",
                fontSize: 13,
                margin: "10px 0 0",
              }}
            >
              {saveMessage}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button
              type="button"
              disabled={saving || (!sourceFile && !selectedSavedId) || !paper}
              onClick={() => savePaper(false)}
              style={actionStyle}
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              disabled={saving || (!sourceFile && !selectedSavedId) || !paper}
              onClick={() => savePaper(true)}
              style={{ ...actionStyle, background: "#176b45", color: "white", borderColor: "#176b45" }}
            >
              {saving ? "Saving…" : "Publish to students"}
            </button>
          </div>
          {sourceUrl && (
            <details style={{ marginTop: 12 }} onToggle={(event) => setShowOriginal(event.currentTarget.open)}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                Check original PDF (source of truth)
              </summary>
              {showOriginal && <PdfSourceViewer url={sourceUrl} data={sourcePdfData ?? undefined} />}
            </details>
          )}
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          {/* Input */}
          <section>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={ocr} onChange={(e) => setOcr(e.target.checked)} />
                Text came from a scan (OCR)
              </label>
              <label
                style={{
                  fontSize: 12,
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  marginLeft: "auto",
                }}
              >
                <input type="checkbox" checked={showModel} onChange={(e) => setShowModel(e.target.checked)} />
                Show the model (JSON)
              </label>
            </div>

            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setExtractedPages(null);
                setPaperOverride(null);
                setTeacherConfirmed(false);
              }}
              spellCheck={false}
              style={{
                width: "100%",
                height: 380,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
                lineHeight: 1.5,
                padding: 10,
                borderRadius: 8,
                border: "1px solid #d8dce2",
              }}
            />

            <div style={{ marginTop: 8 }}>
              <input
                type="file"
                accept=".txt,.pdf,text/plain,application/pdf"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    setError("This PDF is larger than 10 MB. Reduce the file size and try again.");
                    return;
                  }
                  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
                  setError(null);
                  setSaveMessage(null);
                  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
                  setSelectedSavedId(null);
                  setPaperOverride(null);
                  setExtractedPages(null);
                  setExtractedPageImages(null);

                  setExtractedDiagramCrops(null);
                  setScanPageCount(null);
                  setTeacherConfirmed(false);
                  setSourceFile(isPdf ? file : null);
                  setSourcePdfData(null);
                  setSourceUrl(isPdf ? URL.createObjectURL(file) : null);
                  setTitle(file.name.replace(/\.pdf$/i, ""));
                  setRawExtract(null);
                  setHowRead(null);
                  try {
                    if (file.name.toLowerCase().endsWith(".pdf")) {
                      setReading("Reading PDF...");
                      const buffer = await file.arrayBuffer();
                      setSourcePdfData(buffer.slice(0));
                      const result = await extractTextFromPdf(buffer, {
                        progress: (message) => setReading(message),
                      });
                      setReading(null);
                      if (result.needsPageSelection) {
                        setText("");
                        setExtractedPages(null);
                        setExtractedPageImages(null);

                        setExtractedDiagramCrops(null);
                        setRawExtract(null);
                        setOcr(true);
                        setScanPageCount(result.pages);
                        setScanPageStart(1);
                        setScanPageEnd(1);
                        setHowRead(
                          `This is a scanned PDF with ${result.pages} pages. Choose the pages that contain the exam questions.`,
                        );
                        return;
                      }
                      setHowRead(`Read as ${result.method} — ${result.pages} page${result.pages === 1 ? "" : "s"}.`);
                      setRawExtract(result.text);
                      setExtractedPages(result.pageTexts);
                      setExtractedPageImages(result.pageImages ?? null);

                      setExtractedDiagramCrops(result.diagramCrops ?? null);
                      // The parse flag must match how the text actually arrived,
                      // or the warnings lie about the source -- a text-layer
                      // read would carry an OCR penalty it did not earn.
                      setOcr(result.method === "ocr");
                      if (!result.text.trim()) {
                        setError(
                          "The PDF gave no readable text at all — neither a text layer nor anything Tesseract could recognise. Nothing was parsed.",
                        );
                      } else {
                        setText(result.text);
                      }
                    } else {
                      setReading(null);
                      setHowRead("Read from the text file directly.");
                      setRawExtract(null);
                      setExtractedPageImages(null);

                      setExtractedDiagramCrops(null);
                      setText(await file.text());
                    }
                  } catch (err) {
                    setReading(null);
                    setHowRead(null);
                    setError(`Could not read the file: ${err instanceof Error ? err.message : String(err)}.`);
                  }
                }}
                style={{ fontSize: 12 }}
              />
              <span style={{ fontSize: 11, color: "#5b6472", display: "block", marginTop: 4 }}>
                .txt or .pdf. A scanned PDF is read by OCR in this browser — expect tens of seconds per page, not
                instantly.
              </span>
              {scanPageCount !== null && (
                <div
                  role="group"
                  aria-label="Choose scanned PDF pages"
                  style={{
                    marginTop: 10,
                    padding: 12,
                    border: "1px solid #e6c36a",
                    borderRadius: 8,
                    background: "#fff9e8",
                  }}
                >
                  <strong style={{ display: "block", fontSize: 13 }}>This scan is too long to read all at once</strong>
                  <p style={{ margin: "4px 0 8px", fontSize: 12 }}>
                    Enter the PDF page numbers with the exam questions. Read up to 10 pages at a time; the book pages
                    stay in their original positions.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                    <label style={{ display: "grid", gap: 3, fontSize: 11 }}>
                      First page
                      <input
                        aria-label="First PDF page"
                        type="number"
                        min={1}
                        max={scanPageCount}
                        value={scanPageStart}
                        onChange={(event) => setScanPageStart(Number(event.target.value) || 1)}
                        style={{
                          width: 100,
                          minHeight: 40,
                          border: "1px solid #b9c0ca",
                          borderRadius: 6,
                          padding: "4px 8px",
                        }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 3, fontSize: 11 }}>
                      Last page
                      <input
                        aria-label="Last PDF page"
                        type="number"
                        min={1}
                        max={scanPageCount}
                        value={scanPageEnd}
                        onChange={(event) => setScanPageEnd(Number(event.target.value) || 1)}
                        style={{
                          width: 100,
                          minHeight: 40,
                          border: "1px solid #b9c0ca",
                          borderRadius: 6,
                          padding: "4px 8px",
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={
                        Boolean(reading) ||
                        scanPageStart < 1 ||
                        scanPageEnd < scanPageStart ||
                        scanPageEnd > scanPageCount ||
                        scanPageEnd - scanPageStart >= 10
                      }
                      onClick={() => void readSelectedScanPages()}
                      style={{
                        ...actionStyle,
                        minHeight: 40,
                        background: "#24384c",
                        color: "white",
                        borderColor: "#24384c",
                      }}
                    >
                      Read selected pages
                    </button>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#5b6472" }}>
                    For example, choose pages 35 to 40 if the exam starts on PDF page 35.
                  </p>
                </div>
              )}
            </div>

            {(reading || howRead || rawExtract) && (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                {reading && <div style={{ color: "#8a5a00" }}>{reading}</div>}
                {howRead && <div style={{ color: "#1b5e34" }}>{howRead}</div>}
                {rawExtract && rawExtract.trim() && (
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ cursor: "pointer", color: "#5b6472" }}>
                      Show exactly what was read from the file
                    </summary>
                    <pre
                      style={{
                        maxHeight: 240,
                        overflow: "auto",
                        background: "#f4f5f7",
                        padding: 8,
                        borderRadius: 6,
                        fontSize: 11,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {rawExtract}
                    </pre>
                  </details>
                )}
              </div>
            )}
            {error && (
              <div
                role="alert"
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "#8a5a00",
                  background: "#fff6e0",
                  border: "1px solid #f0d090",
                  borderRadius: 6,
                  padding: 8,
                }}
              >
                {error}
              </div>
            )}

            {/* What the parser thought */}
            <div style={{ marginTop: 12, fontSize: 13 }}>
              {paper ? (
                <>
                  <Stat label="Questions found" value={String(paper.questions.length)} />
                  <Stat
                    label="Marks reconcile"
                    value={marks?.agrees === true ? "yes" : marks?.counted === null ? "cannot tell" : "NO — mismatch"}
                    tone={marks?.agrees ? "good" : "warn"}
                  />
                  <Stat
                    label="Flagged for review"
                    value={String(review.length)}
                    tone={review.length ? "warn" : "good"}
                  />
                  <Stat label="Need a teacher" value={`${human.length} of ${paper.questions.length}`} />
                  <Stat
                    label="Audit findings"
                    value={String(audited.reduce((n, a) => n + a.issues.length, 0))}
                    tone={audited.length ? "warn" : "good"}
                  />
                </>
              ) : (
                <Stat label="Questions found" value="0" tone="warn" />
              )}

              {audited.length > 0 && (
                <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12, color: "#8a5a00" }}>
                  {audited.slice(0, 8).map((a) => (
                    <li key={a.question.id}>
                      Question {a.question.number ?? "?"}: {a.issues.join("; ")} — compare with the original page below
                      the question.
                    </li>
                  ))}
                  {audited.length > 8 && <li>… {audited.length - 8} more findings</li>}
                </ul>
              )}

              {result.warnings.length > 0 && (
                <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12, color: "#8a5a00" }}>
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Output */}
          <section>
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                margin: "0 0 8px",
                textTransform: "uppercase",
                letterSpacing: ".04em",
                color: "#5b6472",
              }}
            >
              What a pupil would get
            </h2>
            <div style={{ border: "1px solid #d8dce2", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
              {html ? (
                <iframe title="Rendered exam form" srcDoc={html} style={{ width: "100%", height: 560, border: 0 }} />
              ) : (
                <div style={{ padding: 24, fontSize: 13, color: "#5b6472" }}>Nothing parsed yet.</div>
              )}
            </div>
            <p style={{ fontSize: 11, color: "#5b6472", marginTop: 6 }}>
              Shown at phone width. This is the exact file that would be saved or served &mdash; self-contained, no
              network needed at answer time.
            </p>

            {showModel && paper && (
              <>
                <h2
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    margin: "16px 0 8px",
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                    color: "#5b6472",
                  }}
                >
                  The structured model
                </h2>
                <pre
                  style={{
                    maxHeight: 360,
                    overflow: "auto",
                    background: "#111827",
                    color: "#e5e7eb",
                    padding: 10,
                    borderRadius: 8,
                    fontSize: 11,
                    lineHeight: 1.45,
                  }}
                >
                  {JSON.stringify(paper, null, 2)}
                </pre>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const colour = tone === "warn" ? "#8a5a00" : tone === "good" ? "#1b5e34" : "#111";
  return (
    <div
      style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #eef0f3" }}
    >
      <span style={{ color: "#5b6472" }}>{label}</span>
      <span style={{ fontWeight: 700, color: colour }}>{value}</span>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  display: "block",
  boxSizing: "border-box",
  width: "100%",
  minHeight: 40,
  marginTop: 4,
  padding: "8px 10px",
  border: "1px solid #cbd1d9",
  borderRadius: 6,
  background: "white",
};
const actionStyle: React.CSSProperties = {
  minHeight: 42,
  padding: "8px 14px",
  border: "1px solid #b7c0ca",
  borderRadius: 7,
  background: "white",
  fontWeight: 700,
  cursor: "pointer",
};
