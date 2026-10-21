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
      summary: "The connection dropped, or it took too long. Your work is still on this phone.",
      steps: [
        "Look at the signal bar. If you are offline, keep working. The change uploads later by itself.",
        "Open Sync Center to see what is still waiting.",
        "When you have signal, try the same action again.",
      ],
    },
  },
  {
    match: /permission|not allowed|row-level|rls|unauthori[sz]ed|forbidden|\b401\b|\b403\b/i,
    explanation: {
      title: "Your account is not allowed to do that",
      summary: "The app refused this action for your role or this class. The data is not wrong.",
      steps: [
        "Check that you are using the right role. For example, a class teacher can only mark their own class.",
        "If you should have access, ask the head teacher or admin to add the role or assign the class.",
        "Reload the page after the role is changed.",
      ],
    },
  },
  {
    match: /duplicate|already exists|unique constraint|already registered/i,
    explanation: {
      title: "That record already exists",
      summary: "The app stopped a second copy from being made.",
      steps: [
        "Search for the pupil, staff member or fee item before you add it again.",
        "Open the one that already exists and edit it instead.",
        "If two people share a name, add something to tell them apart, like a second name or admission number.",
      ],
    },
  },
  {
    match: /required|invalid|must be|validation|missing|not a number|out of range/i,
    explanation: {
      title: "Some details are missing or wrong",
      summary: "The form was not saved because one of the fields needs attention.",
      steps: [
        "Look for the field marked in red and fill it in.",
        "Type numbers only. Do not add spaces, commas or the letters UGX.",
        "Save again after you fix the field.",
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
        "If someone deleted it, ask them to add it again.",
        "Reload the page in case the list is old.",
      ],
    },
  },
  {
    match: /storage|quota|indexeddb|disk|space/i,
    explanation: {
      title: "This phone is low on space",
      summary: "Saving offline needs a little space, and the phone could not write the change.",
      steps: [
        "Close other apps and tabs to free memory.",
        "Delete old downloads or photos from the phone.",
        "Connect to the internet and open Sync Center. Waiting work can upload and be removed.",
      ],
    },
  },
  {
    match: /server|internal|\b500\b|\b502\b|\b503\b|unavailable/i,
    explanation: {
      title: "The server had a problem",
      summary: "This is not your mistake. Nothing was lost on your side.",
      steps: [
        "Wait a moment and try again. Most of these clear on their own.",
        "If it keeps happening, send the message to the team with the WhatsApp button in this chat.",
      ],
    },
  },
];

const FALLBACK: OwlyErrorExplanation = {
  title: "That action did not finish",
  summary: "The app could not complete it. Below is the exact message the system gave.",
  steps: [
    "Try the same action once more.",
    "If it fails again, send this message to the team with the WhatsApp button in this chat.",
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
  if (detail) lines.push("", "**The exact message**", `\`${detail}\``);
  return lines.join("\n");
}
