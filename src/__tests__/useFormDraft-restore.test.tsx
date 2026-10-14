import React from "react";
import { render, screen } from "@testing-library/react";
import { useFormDraft } from "@/lib/useAutoSave";

/**
 * Regression: opening a page with an existing autosave draft crashed with
 * "Maximum update depth exceeded".
 *
 * useFormDraft passed an inline `onRestore` closure to useAutoSave, whose
 * load effect depended on that identity. Every render created a new closure,
 * re-ran the effect, called setState (setData + onRestore), re-rendered —
 * an infinite loop whenever localStorage held a draft (e.g. the fees page
 * "Restore Draft?" prompt).
 *
 * Rendering below must settle: the restore flag appears and React never
 * throws the update-depth error (it throws after 50 nested updates).
 */

function Probe({ formKey }: { formKey: string }) {
  const { showRestoreDialog } = useFormDraft(formKey);
  return <div>{showRestoreDialog ? "restore-available" : "no-draft"}</div>;
}

describe("useFormDraft with an existing draft", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("surfaces the restore prompt without an update-depth loop", async () => {
    localStorage.setItem(
      "autosave_fee_form",
      JSON.stringify({ data: { name: "Term 3 fees" }, savedAt: new Date().toISOString() }),
    );
    render(<Probe formKey="fee_form" />);
    expect(await screen.findByText("restore-available")).toBeInTheDocument();
  });

  it("renders quietly when there is no draft", () => {
    render(<Probe formKey="fee_form" />);
    expect(screen.getByText("no-draft")).toBeInTheDocument();
  });
});
