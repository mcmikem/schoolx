"use client";

import { OwlyTrigger } from "@/components/owly/OwlyTrigger";

const STEP_HELP = [
  { id: "setup-school", title: "Help with school details" },
  { id: "setup-fees", title: "Help with terms and fees" },
  { id: "setup-grading", title: "Help with grading" },
  { id: "setup-services", title: "Help with school services" },
  { id: "setup-review", title: "Help checking your setup" },
];

export default function SetupStepHelp({ step }: { step: number }) {
  const help = STEP_HELP[step - 1] || STEP_HELP[0];
  return (
    <div className="mx-auto mb-6 flex max-w-lg justify-center">
      <OwlyTrigger guideId={help.id} label={help.title} />
    </div>
  );
}
