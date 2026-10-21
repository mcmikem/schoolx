/**
 * Every "How do I…?" answer, in one place.
 *
 * These were previously inline cards scattered across pages. Keeping the copy
 * here means the page only carries a button, Owly renders the steps, and a
 * wording fix does not need to be repeated on four screens.
 *
 * Written for a first-time user on a phone: short sentences, common words, one
 * action per step. App labels stay in bold so the user can look for the same
 * words on screen. Any term that is not everyday English is explained the first
 * time it appears.
 *
 * Answers are plain text with a deliberately tiny markup subset: `**bold**`,
 * numbered steps and blank lines. That is exactly what the assistant's local
 * formatter renders, so a guide works with no network and no AI key.
 */

export interface OwlyGuide {
  id: string;
  title: string;
  intro?: string;
  steps: string[];
  note?: string;
}

export const OWLY_GUIDES: Record<string, OwlyGuide> = {
  fees: {
    id: "fees",
    title: "How to manage fees",
    intro: "Start on the Fees page. Do these jobs in this order.",
    steps: [
      "**Create Fee:** list what each class pays for the term. Do this before you take any money.",
      "**Record Payment:** tap a pupil's name, then type the amount the parent paid.",
      "**Get Receipt:** after you save, print or share the receipt. This is the parent's proof.",
      "**Send Reminders:** use Auto Fee Reminders to text parents who still owe money.",
      "**Adjustments:** use this for a scholarship, a fine, or a correction. Do not change the first bill.",
    ],
    note: 'Money owed follows the pupil into the next term. Do not delete last term\'s fee rows to "start fresh". That erases what the family still owes.',
  },
  students: {
    id: "students",
    title: "How to manage students",
    intro: "Start on the Students page.",
    steps: [
      "**Add pupils** one by one. For a whole class, import a spreadsheet instead.",
      "**Transfers:** use this when a pupil changes class or leaves the school.",
      "**Promotions:** at the end of the year, move a whole class to the next class.",
      "**At-risk pupils:** the register marks pupils with attendance or fee problems. Follow up early.",
    ],
    note: "A spreadsheet is faster for a new class. You can fix mistakes before you save.",
  },
  staff: {
    id: "staff",
    title: "How to manage staff",
    steps: [
      "**Add Staff:** add teachers and other workers.",
      "**Assign Subjects:** choose the subjects each teacher teaches.",
      "**Class Teacher:** choose one teacher to lead each class.",
      "**Leave Requests:** staff ask for time off here. You say yes or no.",
      "**Performance:** write down what you see and what to follow up.",
    ],
    note: "One person can have more than one role. A head teacher may also teach. A bursar may also be a parent. Add every role. The app joins the permissions together.",
  },
  messages: {
    id: "messages",
    title: "How to use communication",
    steps: [
      "**Send messages:** choose Auto, WhatsApp or SMS. Send to one parent, one class, or the whole school.",
      "**Notices:** post a message that parents and pupils can read later.",
      "**Automation:** set messages that send by themselves, such as absent or fee reminders.",
      "**Templates:** save messages you send often, so you do not type them again.",
      "**Recent Messages:** check what was sent and what failed. Follow up on failures.",
    ],
    note: "SMS costs money for each message. Check the number of parents before you send to the whole school.",
  },
  attendance: {
    id: "attendance",
    title: "How to mark attendance",
    intro: "You mark one pupil at a time. The app saves as you go.",
    steps: [
      "**Tap** a pupil's row to mark them Present.",
      "**Swipe right** to mark Absent.",
      "**Swipe left** to mark Late or Excused.",
      "Use **One pupil at a time** when the class list is crowded. It shows one big card, not a long list.",
    ],
    note: "Attendance works without internet. It uploads by itself when the phone gets signal.",
  },
  grades: {
    id: "grades",
    title: "How to enter marks",
    intro: "Pick the class and subject first.",
    steps: [
      "One row for each pupil. Type the mark in the BOT, MOT or EOT box. Each box is out of 100.",
      "Leave a box empty if you have not marked that pupil yet. An empty box is not zero.",
      "Marks save as you move from box to box. Tap **Save Grades** when you finish.",
    ],
    note: "BOT and MOT are class work. EOT is the end-of-term exam. They are kept separate. The report combines them using the rule your school chose.",
  },
  "grades-terms": {
    id: "grades-terms",
    title: "What BOT, MOT and EOT mean",
    steps: [
      "**BOT and MOT are class work.** They are the tests and exercises you give during the term.",
      "**EOT is the end-of-term exam.** It is the big exam at the end of the term.",
      "**The report combines them.** It uses the rule your school chose in Settings. In the old curriculum, EOT counts 75%.",
    ],
    note: "If you are not sure which rule your school uses, ask the head teacher. Do not guess.",
  },
  "setup-school": {
    id: "setup-school",
    title: "Setting up your school",
    intro: "Use the name and district on your school papers.",
    steps: [
      "**School name:** write the full name of your school.",
      "**School type:** choose Primary, Secondary or Combined.",
      "**Optional details:** you can add a motto and phone number later.",
    ],
    note: "Use the official name. It will appear on receipts and report cards.",
  },
  "setup-fees": {
    id: "setup-fees",
    title: "Setting up terms and fees",
    intro: "Read the year, term and class carefully.",
    steps: [
      "**Example class:** P.3, Term 1.",
      "**Example fee:** Tuition is UGX 150,000 for one pupil.",
      "**Check the dates:** use the calendar your school approved.",
    ],
    note: "The amount is for one pupil, not the whole class. Use the fee list your school approved.",
  },
  "setup-grading": {
    id: "setup-grading",
    title: "Setting up grading",
    intro: "Choose the rules your school already uses.",
    steps: [
      "**Example mark:** 18 out of 20.",
      "**Zero:** the pupil scored 0.",
      "**Blank:** you have not marked the pupil yet. A blank is not zero.",
    ],
    note: "If you do not know a setting, ask the head teacher. Do not guess.",
  },
  "setup-services": {
    id: "setup-services",
    title: "Choosing school services",
    intro: "Turn on only the services your school uses.",
    steps: [
      "**Day school:** you do not need dormitory details.",
      "**Boarding school:** check the dormitory names and how many beds each one has.",
      "**Not sure?** Ask your school before you continue.",
    ],
  },
  "setup-review": {
    id: "setup-review",
    title: "Checking before you finish",
    intro: "Read your answers before you finish.",
    steps: [
      "**Check school details:** name, subjects and school type.",
      "**Check money and dates:** term dates and fee amounts.",
      "**Finish once:** tap the finish button and wait for the app to say it is done.",
    ],
    note: "If the app does not say it is done, do not close the page. Try again.",
  },
};

/** The guide a page should offer, if any. */
export function getGuide(id: string): OwlyGuide | null {
  return OWLY_GUIDES[id] ?? null;
}

/** Render a guide as assistant text. */
export function guideToMessage(guide: OwlyGuide): string {
  const lines: string[] = [`**${guide.title}**`];
  if (guide.intro) lines.push("", guide.intro);
  lines.push("");
  guide.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  if (guide.note) lines.push("", guide.note);
  return lines.join("\n");
}
