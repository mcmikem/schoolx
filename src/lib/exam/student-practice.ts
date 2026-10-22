import type { ExamQuestion } from "./exam-model";

export type PracticeAnswers = Record<string, string>;

export function answerKey(questionId: string, partLabel?: string): string {
  return partLabel ? `${questionId}:${partLabel}` : questionId;
}

export function displaySubTaskLabel(questionNumber: number | string, label: string): string {
  const nested = label.match(/^([a-d])\((i{1,3}|iv)\)$/i);
  return nested ? `${questionNumber}(${nested[1]})(${nested[2]})` : `${questionNumber}(${label})`;
}

export function subTaskAnswerKey(question: ExamQuestion, partIndex: number): string {
  const part = question.subTasks?.[partIndex];
  if (!part) return answerKey(question.id);
  const occurrence = getPartOccurrence(question, partIndex);
  return answerKey(question.id, occurrence.total > 1 ? `${part.label}#${occurrence.index}` : part.label);
}

export function displayQuestionSubTaskLabel(
  questionNumber: number | string,
  question: ExamQuestion,
  partIndex: number,
): string {
  const part = question.subTasks?.[partIndex];
  if (!part) return String(questionNumber);
  const occurrence = getPartOccurrence(question, partIndex);
  const label = displaySubTaskLabel(questionNumber, part.label);
  return occurrence.total > 1 ? `${label} (${occurrence.index})` : label;
}

function getPartOccurrence(question: ExamQuestion, partIndex: number): { index: number; total: number } {
  const part = question.subTasks?.[partIndex];
  if (!part) return { index: 1, total: 1 };
  const sameLabelIndexes = (question.subTasks ?? [])
    .map((candidate, index) => (candidate.label === part.label ? index : -1))
    .filter((index) => index >= 0);
  return { index: sameLabelIndexes.indexOf(partIndex) + 1, total: sameLabelIndexes.length };
}

export function isQuestionAnswered(question: ExamQuestion, answers: PracticeAnswers): boolean {
  if (question.subTasks?.length) {
    return question.subTasks.every((_, index) => Boolean(answers[subTaskAnswerKey(question, index)]?.trim()));
  }
  return Boolean(answers[question.id]?.trim());
}

export function questionNeedsOriginalPage(question: ExamQuestion): boolean {
  if (question.diagrams.length > 0 || question.tables?.length || question.kind === "diagram") return true;
  const content = `${question.text}\n${question.sourceText}`;
  if (
    /\b(table|diagram|figure|graph|chart|illustration|photograph|image|map|equation|formula|shown below|shown above|refer to the)\b/i.test(
      content,
    )
  ) {
    return true;
  }
  const measuredValues = content.match(
    /\b\d+(?:\.\d+)?\s*(?:%|μm|µm|mm(?:²|2)?|cm(?:²|2)?|kg|g|ml|mL|litres?|liters?|°C|kPa)\b/gi,
  );
  const numericValues = content.match(/\b\d+(?:\.\d+)?\b/g);
  return (
    (measuredValues?.length ?? 0) >= 3 ||
    (/\b(observation|table|results)\b/i.test(content) && (numericValues?.length ?? 0) >= 4)
  );
}

export function questionStem(question: ExamQuestion): string {
  let stem = question.text;
  for (const part of question.subTasks ?? []) {
    stem = stem.replace(part.text, "");
    const label = part.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    stem = stem.replace(new RegExp(`\\(\\s*${label}\\s*\\)|\\b${label}\\s*[.):]`, "i"), "");
  }
  stem = stem
    .replace(/\bTasks?\s*:?/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.()-]+|[\s:;,.()-]+$/g, "")
    .trim();
  return stem || (question.subTasks?.length ? "Answer each part below." : question.text);
}
