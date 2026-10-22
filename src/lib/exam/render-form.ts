/**
 * Renders a parsed paper as a standalone, mobile-first, offline-capable form.
 *
 * This is the sellable artefact. It deliberately emits a single self-contained
 * HTML file: no build step, no CDN, no framework, no network at answer time. A
 * school can open it on a phone, a tablet or a printed browser in a room with
 * no signal, and it behaves the same.
 *
 * Two principles run through it:
 *
 * 1. Never present a doubtful parse as fact. Low-confidence questions are
 *    visibly flagged. A teacher who does not notice the flag will still be
 *    misled, so the flag is loud and it is on the question, not in a footer.
 *
 * 2. Never auto-mark what a machine cannot judge. Machine-markable questions
 *    say so. Everything else says it needs a teacher. The marking script marks
 *    only the former and refuses the rest rather than guessing.
 */

import {
  type ExamPaper,
  type ExamQuestion,
  REVIEW_THRESHOLD,
  needsHuman,
  needsReview,
  reconcile,
  strategyFor,
} from "./exam-model";

export interface RenderOptions {
  /** Emit the self-marking script. Off by default so a paper can be handed out unmarked. */
  includeMarking?: boolean;
  /** Warn when the parsed marks do not add up to the printed total. */
  strictReconciliation?: boolean;
}

export function renderPaperForm(paper: ExamPaper, options: RenderOptions = {}): string {
  const { includeMarking = false, strictReconciliation = true } = options;
  const marks = reconcile(paper);
  const review = needsReview(paper);
  const human = needsHuman(paper);

  const banner = strictReconciliation && !marks.agrees ? reconciliationWarning(paper, marks) : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(paper.title ?? "Exam paper")}</title>
<style>${CSS}</style>
</head>
<body>
<main class="sheet" data-paper-id="${escapeHtml(paper.id)}">
  <header class="head">
    <h1>${escapeHtml(paper.title ?? "Exam paper")}</h1>
    <dl class="meta">
      ${paper.subject ? metaRow("Subject", paper.subject) : ""}
      ${paper.classLevel ? metaRow("Class", paper.classLevel) : ""}
      ${paper.term ? metaRow("Term", paper.term) : ""}
      ${paper.year ? metaRow("Year", String(paper.year)) : ""}
      ${marks.stated !== null ? metaRow("Total marks", String(marks.stated)) : ""}
    </dl>
    ${banner}
  </header>

  ${paper.ocrApplied ? ocrNotice() : ""}
  ${review.length ? reviewNotice(review.length) : ""}

  <ol class="questions">
    ${paper.questions.map((q) => renderQuestion(q, paper)).join("\n")}
  </ol>

  <footer class="foot">
    <p>${human.length} of ${paper.questions.length} questions need a teacher.</p>
    <p class="tiny">Parsed automatically. Check anything flagged before use.</p>
  </footer>
</main>
${includeMarking ? markingScript(paper) : ""}
</body>
</html>`;
}

function renderQuestion(q: ExamQuestion, paper: ExamPaper): string {
  const doubtful = q.confidence < REVIEW_THRESHOLD;
  const strategy = strategyFor(q);
  const needsTeacher = strategy === "never";

  return `<li class="q${doubtful ? " q--flagged" : ""}" data-qid="${escapeHtml(q.id)}" data-strategy="${strategy}" data-kind="${q.kind}" data-confidence="${q.confidence}">
  <div class="q__head">
    <span class="q__num">${q.number ?? "?"}</span>
    <span class="q__marks">${q.marks !== null ? escapeHtml(String(q.marks)) + " mark" + (q.marks === 1 ? "" : "s") : "—"}</span>
  </div>

  ${doubtful ? flag(q) : ""}

  <p class="q__text">${escapeHtml(q.text) || "<em>No question text was recognised.</em>"}</p>

  ${q.diagrams
    .map(
      (d) => `<div class="diagram">
      <span class="diagram__label">${escapeHtml(d.label)}</span>
      ${d.imageDataUri ? `<img src="${d.imageDataUri}" alt="${escapeHtml(d.label)}">` : `<div class="diagram__missing">Image not captured — add it from the original paper.</div>`}
    </div>`,
    )
    .join("")}

  ${q.choices.length ? renderChoices(q) : ""}

  ${needsTeacher ? (q.subTasks?.length ? renderSubTasks(q) : renderAnswerSpace(q)) : ""}
  ${!needsTeacher && !q.choices.length && (q.kind === "numeric" || q.kind === "short_answer") ? `<input type="text" name="${escapeHtml(q.id)}" data-answer="1" aria-label="Answer to question ${escapeHtml(String(q.number ?? ""))}" placeholder="Write your answer here"></input>` : ""}
  ${
    needsTeacher
      ? `<div class="q__marking q__marking--human">Needs a teacher — write your answer above</div>`
      : `<div class="q__marking q__marking--auto">Marked automatically</div>`
  }
</li>`;
}

// An essay leaves the pupil somewhere to write. Without a full-width box the
// rendered form reads as a marking report rather than a paper the pupil can
// sit; the marking script's collector already picks textarea values up.
function renderAnswerSpace(q: ExamQuestion): string {
  const tall = q.kind === "long_answer" || q.text.length > 300;
  return `<textarea name="${escapeHtml(q.id)}" data-answer="1" rows="${tall ? 8 : 3}" aria-label="Answer to question ${escapeHtml(String(q.number ?? ""))}" placeholder="Write your answer here"></textarea>`;
}

// Each part of an essay task is its own answer: (a) about mechanisms, (b)
// about strategies. One shared box invites the pupil to answer (a) only; the
// marking plan for these papers scores parts separately.
function renderSubTasks(q: ExamQuestion): string {
  return (q.subTasks ?? [])
    .map(
      (part, i) => `<div class="subtask">
      <div class="subtask__label">${escapeHtml(String(q.number ?? ""))}${escapeHtml(part.label)}</div>
      <p class="subtask__prompt">${escapeHtml(part.text)}</p>
      <textarea name="${escapeHtml(q.id)}::${escapeHtml(part.label)}" data-answer="1" data-part="${i}" rows="5" aria-label="Answer to part ${escapeHtml(String(q.number ?? ""))} ${escapeHtml(part.label)}" placeholder="Write your answer to ${escapeHtml(String(q.number ?? ""))}${escapeHtml(part.label)} here"></textarea>
    </div>`,
    )
    .join("");
}

function renderChoices(q: ExamQuestion): string {
  return `<div class="choices" role="radiogroup" aria-label="Choose one">
    ${q.choices
      .map(
        (c, i) => `<label class="choice">
      <input type="radio" name="${escapeHtml(q.id)}" value="${escapeHtml(c.label)}" data-index="${i}">
      <span class="choice__label">${escapeHtml(c.label)}</span>
      <span class="choice__text">${escapeHtml(c.text)}</span>
    </label>`,
      )
      .join("\n    ")}
  </div>`;
}

/** The flagged question gets its detail on tap, not a wall of text by default. */
function flag(q: ExamQuestion): string {
  return `<details class="flag">
    <summary>Check this question — it may not have been read correctly</summary>
    <p class="flag__why">Parsed at ${Math.round(q.confidence * 100)}% confidence.${q.marks === null ? " No mark allocation was found." : ""}</p>
    <details class="flag__raw">
      <summary>Text as it was read</summary>
      <pre>${escapeHtml(q.sourceText)}</pre>
    </details>
  </details>`;
}

function metaRow(label: string, value: string): string {
  return `<div class="meta__row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function reconciliationWarning(paper: ExamPaper, marks: ReturnType<typeof reconcile>): string {
  const counted = marks.counted === null ? "an unknown number of" : String(marks.counted);
  return `<div class="alert alert--warn" role="alert">
    <strong>The marks do not add up.</strong>
    The questions account for ${counted}${paper.totalMarks !== null ? `, but the paper says the total is ${paper.totalMarks}` : ""}.
    Something was missed or misread.
  </div>`;
}

function ocrNotice(): string {
  return `<div class="alert alert--info">
    Read from a scan. Spelling and question numbers may be wrong — check before using.
  </div>`;
}

function reviewNotice(count: number): string {
  return `<div class="alert alert--warn" role="status">
    <strong>${count} question${count === 1 ? "" : "s"} need${count === 1 ? "s" : ""} checking.</strong>
    They are marked in the list below.
  </div>`;
}

/**
 * Self-marking.
 *
 * Marks only what the model says is machine-markable, and refuses everything
 * else. It deliberately has no "best guess" branch: a wrong mark handed back to
 * a pupil is worse than an unanswered one, because nobody knows to look.
 */
function markingScript(paper: ExamPaper): string {
  const answerKey = JSON.stringify(
    paper.questions
      .filter((q) => strategyFor(q) !== "never")
      .map((q) => ({ id: q.id, kind: q.kind, marks: q.marks ?? 0, accepted: q.acceptedAnswers })),
  );

  return `<script id="marking-key" type="application/json">${answerKey.replace(/</g, "\\u003c")}</script>
<script>
(function () {
  var key = JSON.parse(document.getElementById("marking-key").textContent);
  var byId = {};
  key.forEach(function (k) { byId[k.id] = k; });

  function normalise(s) {
    return s.toLowerCase().trim().replace(/[.,;!?]+$/, "").replace(/\\s+/g, " ");
  }

  window.markPaper = function () {
    var out = { machineScore: 0, machineMax: 0, unanswered: [], teacher: [] };

    document.querySelectorAll(".q").forEach(function (el) {
      var id = el.getAttribute("data-qid");
      var strategy = el.getAttribute("data-strategy");
      var entry = byId[id];
      var marks = entry ? entry.marks : 0;

      if (strategy === "never" || !entry) {
        out.teacher.push({ id: id, number: el.querySelector(".q__num").textContent.trim(), marks: marks });
        el.classList.add("q--teacher");
        return;
      }

      out.machineMax += marks;
      var earned = 0, answered = false;

      if (strategy === "exact") {
        var picked = el.querySelector("input:checked");
        if (picked) { answered = true; }
      } else if (strategy === "numeric") {
        var box = el.querySelector("textarea, input[type=text]");
        var val = box && box.value.trim();
        if (val !== "") {
          answered = true;
          var num = Number(val);
          var ok = entry.accepted.some(function (a) { return Number(a) === num; });
          earned = ok ? marks : 0;
        }
      }

      if (answered) out.machineScore += earned;
      else out.unanswered.push(id);
      el.classList.add(answered ? "q--answered" : "q--unanswered");
    });

    return out;
  };
})();
</script>`;
}

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CSS = `
:root { color-scheme: light; --ink:#111; --muted:#5b6472; --line:#e3e7ec; --bg:#fff; --warn:#8a5a00; --warnbg:#fff6e0; --info:#0b5; --infobg:#eef7ff; }
* { box-sizing: border-box; }
body { margin:0; background:#f6f7f9; color:var(--ink); font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
.sheet { max-width:44rem; margin:0 auto; background:var(--bg); padding:1rem 1rem 4rem; min-height:100vh; }
.head h1 { font-size:1.25rem; margin:0 0 .5rem; line-height:1.3; }
.meta { display:flex; flex-wrap:wrap; gap:.35rem 1.25rem; margin:0 0 .75rem; font-size:.8125rem; color:var(--muted); }
.meta__row { display:flex; gap:.4rem; } .meta dt { font-weight:600; } .meta dd { margin:0; }
.alert { border-radius:.5rem; padding:.6rem .75rem; font-size:.8125rem; margin:.5rem 0; }
.alert--warn { background:var(--warnbg); border:1px solid #f0d090; color:var(--warn); }
.alert--info { background:var(--infobg); border:1px solid #c5dcf5; color:var(--info); }
.questions { list-style:none; margin:0; padding:0; }
.q { border-top:1px solid var(--line); padding:1rem 0; }
.q__head { display:flex; justify-content:space-between; align-items:baseline; gap:.5rem; }
.q__num { font-weight:700; }
.q__marks { font-size:.75rem; color:var(--muted); }
.q__text { margin:.4rem 0 .6rem; }
.q--flagged { background:#fffdf5; border-left:3px solid #f0c14b; padding-left:.75rem; }
.flag { font-size:.8125rem; margin:.35rem 0; }
.flag summary { cursor:pointer; color:var(--warn); font-weight:600; }
.flag__why { color:var(--muted); margin:.3rem 0; }
.flag__raw pre { white-space:pre-wrap; background:#f4f5f7; padding:.5rem; border-radius:.35rem; font-size:.75rem; overflow-x:auto; }
.choices { display:grid; gap:.4rem; margin:.5rem 0; }
.subtask { margin:.5rem 0; }
.subtask__label { font-weight:700; }
.subtask__prompt { margin:.2rem 0 .3rem; }
.choice { display:flex; gap:.6rem; align-items:flex-start; padding:.55rem .6rem; border:1px solid var(--line); border-radius:.5rem; min-height:44px; }
.choice input { margin-top:.25rem; width:18px; height:18px; flex:none; }
.choice__label { font-weight:600; min-width:1.2rem; }
.diagram { margin:.5rem 0; }
.diagram__label { font-size:.75rem; color:var(--muted); display:block; }
.diagram img { max-width:100%; height:auto; border:1px solid var(--line); border-radius:.35rem; }
.diagram__missing { border:1px dashed #c9ced6; border-radius:.35rem; padding:.75rem; font-size:.8125rem; color:var(--muted); }
textarea, input[type=text] { width:100%; min-height:44px; padding:.6rem; font:inherit; border:1px solid var(--line); border-radius:.5rem; background:#fff; }
textarea { min-height:5.5rem; resize:vertical; }
.q__marking { display:inline-block; font-size:.6875rem; text-transform:uppercase; letter-spacing:.04em; padding:.15rem .4rem; border-radius:.25rem; margin-top:.6rem; }
.q__marking--auto { background:#e8f5ec; color:#1b5e34; }
.q__marking--human { background:#f1f2f4; color:var(--muted); }
.foot { margin-top:1.5rem; padding-top:.75rem; border-top:1px solid var(--line); font-size:.8125rem; color:var(--muted); }
.tiny { font-size:.75rem; }
@media (max-width:26rem) { .sheet { padding:1rem .85rem 4rem; } }
@media print { body { background:#fff; } .flag summary, .q__marking { display:none; } }
`;
