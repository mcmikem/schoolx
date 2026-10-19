"use client";

/**
 * Exam Lab — the thing to look at when you want to see whether the parser works.
 *
 * Paste a paper's text (or upload a .txt) and it shows three things side by side:
 * the rendered form exactly as it would be handed to a pupil, the structured
 * model the parser produced, and any warnings worth reading.
 *
 * This exists because "trust me, it works" is worth very little for something
 * meant to be judged on output quality. Open this page, paste a paper, and look.
 *
 * Deliberately a lab rather than a product surface: it takes text, not a PDF.
 * OCR is the missing piece between a scan and this page, and pretending
 * otherwise would just move the surprise somewhere less visible.
 */

import { useMemo, useState } from "react";

import { needsHuman, needsReview, reconcile } from "@/lib/exam/exam-model";
import { parsePaper } from "@/lib/exam/parse-paper";
import { renderPaperForm } from "@/lib/exam/render-form";

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

export default function ExamLabPage() {
  const [text, setText] = useState(SAMPLE);
  const [ocr, setOcr] = useState(true);
  const [showModel, setShowModel] = useState(false);

  const result = useMemo(() => {
    try {
      return parsePaper(text, { ocr, subject: "Mathematics", classLevel: "P.7" });
    } catch (e) {
      // A parser that throws should say so here rather than blanking the page.
      return { paper: null, warnings: [`Parser threw: ${e instanceof Error ? e.message : String(e)}`] };
    }
  }, [text, ocr]);

  const html = useMemo(
    () => (result.paper ? renderPaperForm(result.paper, { includeMarking: true }) : ""),
    [result.paper],
  );

  const marks = result.paper ? reconcile(result.paper) : null;
  const review = result.paper ? needsReview(result.paper) : [];
  const human = result.paper ? needsHuman(result.paper) : [];

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", padding: 16 }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Exam Lab</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#5b6472" }}>
            Paste a paper&rsquo;s <strong>text</strong> to see it parsed. This is step 5&ndash;7 of the pipeline: text
            in, questions out, mobile form rendered. There is no OCR yet, so a scanned PDF will not get you here on its
            own.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
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
              onChange={(e) => setText(e.target.value)}
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
                accept=".txt,text/plain"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setText(await file.text());
                }}
                style={{ fontSize: 12 }}
              />
            </div>

            {/* What the parser thought */}
            <div style={{ marginTop: 12, fontSize: 13 }}>
              {result.paper ? (
                <>
                  <Stat label="Questions found" value={String(result.paper.questions.length)} />
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
                  <Stat label="Need a teacher" value={`${human.length} of ${result.paper.questions.length}`} />
                </>
              ) : (
                <Stat label="Questions found" value="0" tone="warn" />
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

            {showModel && result.paper && (
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
                  {JSON.stringify(result.paper, null, 2)}
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
