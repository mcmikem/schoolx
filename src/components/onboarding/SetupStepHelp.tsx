"use client";

import MaterialIcon from "@/components/MaterialIcon";

const HELP = [
  {
    title: "First, tell us about your school",
    icon: "school",
    text: "Use the name and district from your school records. Check the school type and subjects below.",
    items: [
      ["School name", "Your school’s full name"],
      ["School type", "Primary, Secondary or Combined"],
      ["Optional details", "You can add a motto and contacts later"],
    ],
  },
  {
    title: "Use your calendar and approved fee list",
    icon: "payments",
    text: "Read the year, term and class carefully. A fee amount is for one learner, not the whole class.",
    items: [
      ["Example class", "P.3 · Term 1"],
      ["Example fee", "Tuition: UGX 150,000 per learner"],
      ["Check dates", "Use your school’s approved calendar"],
    ],
  },
  {
    title: "Check how your school records marks",
    icon: "edit",
    text: "Choose the rules your school actually uses. Ask the headteacher if you do not know a grading setting.",
    items: [
      ["Example mark", "18 out of 20"],
      ["Zero", "The learner scored 0"],
      ["Blank", "No mark entered yet — not zero"],
    ],
  },
  {
    title: "Choose only what your school uses",
    icon: "check_circle",
    text: "Turn on the school services you need. Do not add boarding details for a day-only school.",
    items: [
      ["Day school", "No dormitory setup needed"],
      ["Boarding school", "Check dormitory names and capacity"],
      ["Not sure?", "Check with your school before continuing"],
    ],
  },
  {
    title: "Check before you finish",
    icon: "check_circle",
    text: "Read your choices. Setup is not finished until you tap the finish button and the app confirms it.",
    items: [
      ["Check school details", "Name, subjects and school type"],
      ["Check money and dates", "Term dates and fee amounts"],
      ["Finish once", "Wait for a success message"],
    ],
  },
];

export default function SetupStepHelp({ step }: { step: number }) {
  const help = HELP[step - 1] || HELP[0];
  return (
    <section
      aria-label="Help with this setup step"
      className="mx-auto mb-6 max-w-lg rounded-2xl border border-blue-200 bg-blue-50 p-4 text-slate-900"
    >
      <div className="flex items-start gap-3">
        <MaterialIcon icon={help.icon} size={26} className="shrink-0 text-[var(--bot-navy-ink)]" />
        <div>
          <h2 className="text-base font-bold leading-snug">{help.title}</h2>
          <p className="mt-2 text-sm leading-relaxed">{help.text}</p>
        </div>
      </div>
      <details className="mt-3 rounded-xl border border-blue-200 bg-white">
        <summary className="min-h-12 cursor-pointer px-3 py-3 text-base font-semibold text-[var(--bot-navy-ink)]">
          Show me an example
        </summary>
        <dl className="space-y-3 border-t border-blue-100 p-3">
          {help.items.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-1 text-base">{value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
