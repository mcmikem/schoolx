import { explainError } from "@/lib/owly-errors";
import { OWLY_GUIDES } from "@/lib/owly-guides";
import { KNOWLEDGE } from "@/lib/owly-knowledge";
import { getSuggestions, type SuggestionSignals } from "@/lib/owly-suggestions";
import { FALLBACK_WALKTHROUGH, WALKTHROUGHS } from "@/lib/owly-walkthroughs";

/**
 * Owly's job is to be understood by a first-time user on a cheap phone, so the
 * copy is deliberately written in short, common English. This test keeps that
 * promise from drifting: a long sentence or a wordy phrase fails the build.
 */

const MAX_WORDS_PER_SENTENCE = 22;

const BANNED_PHRASES = [
  "simply",
  "obviously",
  "leverage",
  "utilize",
  "commence",
  "prior to",
  "in order to",
  "furthermore",
  "nevertheless",
];

function sentences(text: string): string[] {
  return text
    .replace(/\*\*/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function guideStrings(): string[] {
  const out: string[] = [];
  Object.values(OWLY_GUIDES).forEach((guide) => {
    out.push(guide.title);
    if (guide.intro) out.push(guide.intro);
    out.push(...guide.steps);
    if (guide.note) out.push(guide.note);
  });
  return out;
}

function walkthroughStrings(): string[] {
  const out: string[] = [];
  [...Object.values(WALKTHROUGHS), FALLBACK_WALKTHROUGH].forEach((tour) => {
    out.push(tour.title, tour.intro);
    tour.steps.forEach((step) => out.push(step.title, step.how, step.done));
  });
  return out;
}

function errorStrings(): string[] {
  const samples = ["offline", "permission denied", "duplicate", "invalid", "not found", "storage", "server", "mystery"];
  const out: string[] = [];
  samples.forEach((sample) => {
    const explanation = explainError(sample);
    out.push(explanation.title, explanation.summary, ...explanation.steps);
  });
  return out;
}

function knowledgeStrings(): string[] {
  const out: string[] = [];
  KNOWLEDGE.forEach((entry) => {
    if (entry.answer) out.push(entry.answer);
    if (entry.title) out.push(entry.title);
    if (entry.where) out.push(entry.where);
    if (entry.steps) out.push(...entry.steps);
    if (entry.facts) out.push(...entry.facts);
    if (entry.tip) out.push(entry.tip);
  });
  return out;
}

function suggestionStrings(): string[] {
  const signals: SuggestionSignals[] = [
    {
      online: false,
      pendingSyncCount: 2,
      page: "/dashboard/fees",
      visitsThisPage: 3,
      totalVisits: 5,
      isNewUser: false,
    },
    {
      online: true,
      pendingSyncCount: 0,
      page: "/dashboard/attendance",
      visitsThisPage: 3,
      totalVisits: 5,
      isNewUser: false,
    },
    {
      online: true,
      pendingSyncCount: 0,
      page: "/dashboard/students",
      visitsThisPage: 3,
      totalVisits: 5,
      isNewUser: false,
    },
    {
      online: true,
      pendingSyncCount: 0,
      page: "/dashboard/reports",
      visitsThisPage: 3,
      totalVisits: 5,
      isNewUser: false,
    },
    {
      online: true,
      pendingSyncCount: 0,
      page: "/dashboard/grades",
      visitsThisPage: 3,
      totalVisits: 5,
      isNewUser: false,
    },
    { online: true, pendingSyncCount: 0, page: "/dashboard", visitsThisPage: 1, totalVisits: 1, isNewUser: true },
    { online: false, pendingSyncCount: 0, page: "/dashboard", visitsThisPage: 2, totalVisits: 4, isNewUser: false },
  ];
  const out: string[] = [];
  signals.forEach((signal) => {
    getSuggestions(signal).forEach((suggestion) => out.push(suggestion.title, suggestion.detail, suggestion.cta));
  });
  return out;
}

describe("Owly writes in easy English", () => {
  it("keeps every guide and walkthrough sentence short", () => {
    const long: string[] = [];
    [...guideStrings(), ...walkthroughStrings()].forEach((text) => {
      sentences(text).forEach((sentence) => {
        if (words(sentence) > MAX_WORDS_PER_SENTENCE) long.push(sentence);
      });
    });
    expect(long).toEqual([]);
  });

  it("keeps error explanations short too", () => {
    const long: string[] = [];
    errorStrings().forEach((text) => {
      sentences(text).forEach((sentence) => {
        if (words(sentence) > MAX_WORDS_PER_SENTENCE) long.push(sentence);
      });
    });
    expect(long).toEqual([]);
  });

  it("keeps the offline knowledge base short", () => {
    const long: string[] = [];
    knowledgeStrings().forEach((text) => {
      sentences(text).forEach((sentence) => {
        if (words(sentence) > MAX_WORDS_PER_SENTENCE) long.push(sentence);
      });
    });
    expect(long).toEqual([]);
  });

  it("keeps the suggestion popups short", () => {
    const long: string[] = [];
    suggestionStrings().forEach((text) => {
      sentences(text).forEach((sentence) => {
        if (words(sentence) > MAX_WORDS_PER_SENTENCE) long.push(sentence);
      });
    });
    expect(long).toEqual([]);
  });

  it("avoids wordy or show-off phrases", () => {
    const found: string[] = [];
    [
      ...guideStrings(),
      ...walkthroughStrings(),
      ...errorStrings(),
      ...knowledgeStrings(),
      ...suggestionStrings(),
    ].forEach((text) => {
      const lower = text.toLowerCase();
      BANNED_PHRASES.forEach((phrase) => {
        if (lower.includes(phrase)) found.push(`${phrase} in: ${text}`);
      });
    });
    expect(found).toEqual([]);
  });
});
