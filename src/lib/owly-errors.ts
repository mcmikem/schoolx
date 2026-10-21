/**
 * Turn a raw error string into an explanation a teacher can act on.
 *
 * The point is not to hide the technical message -- the toast already shows it,
 * and hiding it would make support harder. The point is to answer the question
 * the message never answers: "what do I do now?"
 *
 * Everything here is local and synchronous, so the explanation still works
 * offline and without an AI key.
 */

export interface OwlyErrorExplanation {
  title: string;
  summary: string;
  steps: string[];
}

interface Rule {
  match: RegExp;
  explanation: OwlyErrorExplanation;
}

const RULES: Rule[] = [
  {
    match: /offline|network|failed to fetch|fetch failed|timeout|timed out|abort/i,
    explanation: {
      title: "That did not reach the server",
      summary: "The connection dropped or took too long. Your entry is still on this device.",
      steps: [
        "Check the signal indicator. If you are offline, keep working — the change uploads by itself later.",
        "Open Sync Center to see what is still waiting.",
        "Once you have signal, try the same action again.",
      ],
    },
  },
  {
    match: /permission|not allowed|row-level|rls|unauthori[sz]ed|forbidden|\b401\b|\b403\b/i,
    explanation: {
      title: "Your account is not allowed to do that",
      summary: "The action was refused for this role or this class, not because the data is wrong.",
      steps: [
        "Check that you are in the right role (for example, a class teacher can only mark their own class).",
        "If you should have access, ask the headmaster or admin to add the role or assign the class.",
        "Reload the page after the role is changed.",
      ],
    },
  },
  {
    match: /duplicate|already exists|unique constraint|already registered/i,
    explanation: {
      title: "That record already exists",
      summary: "The app stopped a second copy from being created.",
      steps: [
        "Search for the pupil, staff member or fee item before adding it again.",
        "Open the existing record and edit it instead.",
        "If two real people share a name, add something that tells them apart (a second name or admission number).",
      ],
    },
  },
  {
    match: /required|invalid|must be|validation|missing|not a number|out of range/i,
    explanation: {
      title: "Some details are missing or not valid",
      summary: "The form was not saved because one of the fields needs attention.",
      steps: [
        "Look for the field marked in red and fill it in.",
        "Check that numbers are digits only — no spaces, commas or currency symbols.",
        "Save again once the field is corrected.",
      ],
    },
  },
  {
    match: /not found|\b404\b|does not exist|no such/i,
    explanation: {
      title: "That record could not be found",
      summary: "It may have been removed, or it belongs to a different school.",
      steps: [
        "Go back to the list and search for it again.",
        "If someone else deleted it, ask them to restore it or add it again.",
        "Reload the page in case the list is out of date.",
      ],
    },
  },
  {
    match: /storage|quota|indexeddb|disk|space/i,
    explanation: {
      title: "This device is low on storage",
      summary: "Offline saving needs a little space, and the device could not write the change.",
      steps: [
        "Close other apps and tabs to free memory.",
        "Clear old downloads or photos from the device.",
        "Connect to the internet and open Sync Center so pending work can upload and be removed.",
      ],
    },
  },
  {
    match: /server|internal|\b500\b|\b502\b|\b503\b|unavailable/i,
    explanation: {
      title: "The server had a problem",
      summary: "This is not something you did wrong. Nothing was lost on your side.",
      steps: [
        "Wait a moment and try again — most of these clear on their own.",
        "If it keeps happening, send the message to the support team with the WhatsApp button in this chat.",
      ],
    },
  },
];

const FALLBACK: OwlyErrorExplanation = {
  title: "That action did not finish",
  summary: "The app could not complete it. The details below are what the system reported.",
  steps: [
    "Try the same action once more.",
    "If it fails again, send this message to support from the WhatsApp button in this chat.",
  ],
};

export function explainError(raw: string): OwlyErrorExplanation {
  const text = raw ?? "";
  const rule = RULES.find((entry) => entry.match.test(text));
  return rule?.explanation ?? FALLBACK;
}

/** Render an explanation plus the original message as assistant text. */
export function errorToMessage(raw: string): string {
  const explanation = explainError(raw);
  const detail = (raw ?? "").trim().slice(0, 300);
  const lines: string[] = [`**${explanation.title}**`, "", explanation.summary, ""];
  explanation.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  if (detail) lines.push("", "**What the system reported**", `\`${detail}\``);
  return lines.join("\n");
}
