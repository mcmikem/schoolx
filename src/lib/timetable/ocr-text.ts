/** Helpers for turning local OCR text into a reviewable timetable draft. */
export interface TimetableOcrDraft {
  day: string;
  period: string;
  className: string;
  subject: string;
  teacher: string;
  startTime: string;
  endTime: string;
  room: string;
}

const DAY_PATTERN = /\b(monday|tuesday|wednesday|thursday|friday|saturday|mon|tue|wed|thu|fri|sat)\b/i;
const TIME_PATTERN = /\b(?:0?[7-9]|1[0-9]|2[0-1])[:.]([0-5][0-9])\b/g;

function normalizeTime(value: string): string {
  const [hour, minute] = value.replace(".", ":").split(":");
  return `${hour.padStart(2, "0")}:${minute}`;
}

/**
 * Read simple row-oriented timetable text (one lesson per OCR line). OCR is
 * deliberately not treated as a structured table parser: ambiguous lines are
 * still returned with blank fields for the teacher to correct in the preview.
 */
export function parseTimetableOcrText(text: string): TimetableOcrDraft[] {
  const rows: TimetableOcrDraft[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/[|;]/g, " ").replace(/\s+/g, " ").trim();
    if (!line || (/\b(timetable|period|teacher|subject|class|room|venue)\b/i.test(line) && !DAY_PATTERN.test(line)))
      continue;
    const dayMatch = line.match(DAY_PATTERN);
    if (!dayMatch) continue;
    if (/\btimetable\b/i.test(line) && !/\b\d{1,2}(?:st|nd|rd|th)?\b/.test(line)) continue;
    const times = [...line.matchAll(TIME_PATTERN)].map((match) => normalizeTime(match[0]));
    const day = dayMatch[1];
    const remainder = line.replace(dayMatch[0], " ").replace(TIME_PATTERN, " ").replace(/\s+/g, " ").trim();
    const tokens = remainder.split(/[\t, ]+/).filter(Boolean);
    const periodIndex = tokens.findIndex((token) => /^(?:p|period)?\d{1,2}(?:st|nd|rd|th)?$/i.test(token));
    let period = "";
    if (periodIndex >= 0) {
      period = tokens.splice(periodIndex, 1)[0].replace(/\D/g, "");
      if (periodIndex > 0 && /^period$/i.test(tokens[periodIndex - 1])) tokens.splice(periodIndex - 1, 1);
    }
    const roomIndex = tokens.findIndex((token) => /^(?:room|rm|venue)$/i.test(token));
    let room = "";
    if (roomIndex >= 0) room = tokens.splice(roomIndex, 2).slice(1).join(" ");
    // Most posted school timetables print class, learning area and teacher in
    // that order. Keep uncertain rows editable instead of inventing a match.
    rows.push({
      day,
      period,
      className: tokens[0] || "",
      subject: tokens[1] || "",
      teacher: tokens.slice(2).join(" "),
      startTime: times[0] || "",
      endTime: times[1] || "",
      room,
    });
  }
  return rows;
}
