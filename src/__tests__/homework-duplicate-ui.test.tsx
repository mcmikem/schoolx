import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import HomeworkPage from "@/app/dashboard/homework/page";

/**
 * The helper tests cover the date maths; these cover the wiring. Without them a
 * correct `duplicateHomeworkDraft` sitting behind an `alert()` would still ship
 * as a dead button — which is exactly what happened first time.
 */

const EXISTING = [
  {
    id: "hw-1",
    title: "Fractions Practice",
    description: "Exercise 4, questions 1-10",
    subject_id: "sub-math",
    class_id: "class-1",
    due_date: "2099-12-31",
    marks: 20,
    status: "assigned",
    created_by: "user-1",
  },
];

const inserted: any[] = [];

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ school: { id: "school-1" }, user: { id: "user-1" }, isDemo: false }),
}));

jest.mock("@/lib/academic-context", () => ({
  useAcademic: () => ({ academicYear: "2026", currentTerm: 1 }),
}));

jest.mock("@/lib/hooks", () => ({
  useClasses: () => ({ classes: [{ id: "class-1", name: "Primary 3" }] }),
  useSubjects: () => ({ subjects: [{ id: "sub-math", name: "Mathematics" }] }),
}));

jest.mock("@/components/Toast", () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() }),
}));

jest.mock("@/lib/useAutoSave", () => ({
  useFormDraft: () => ({ updateData: jest.fn(), clearSaved: jest.fn(), savedData: null }),
}));

jest.mock("@/components/ui/Skeleton", () => ({ TableSkeleton: () => <div>loading</div> }));
jest.mock("@/components/EmptyState", () => ({ EmptyState: ({ title }: { title: string }) => <div>{title}</div> }));
jest.mock("@/components/ConfirmDialog", () => ({ ConfirmDialog: () => null }));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit", "insert", "update", "delete"]) chain[m] = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: EXISTING, error: null });
      return chain;
    },
  },
}));

describe("duplicate a class test (scenario #28)", () => {
  beforeEach(() => {
    inserted.length = 0;
  });

  it("opens the create form pre-filled from the chosen test", async () => {
    render(<HomeworkPage />);

    const duplicate = await screen.findByRole("button", { name: /duplicate/i });
    fireEvent.click(duplicate);

    await waitFor(() => {
      expect(screen.getByText(/duplicate class test/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/title/i)).toHaveValue("Fractions Practice (copy)");
    expect(screen.getByLabelText(/description/i)).toHaveValue("Exercise 4, questions 1-10");
    expect(screen.getByText(/copied from/i)).toBeInTheDocument();
  });

  it("has no alert() stub left on the button", async () => {
    const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
    render(<HomeworkPage />);

    fireEvent.click(await screen.findByRole("button", { name: /duplicate/i }));

    await waitFor(() => expect(screen.getByText(/duplicate class test/i)).toBeInTheDocument());
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("leaves the original test in the list — a copy is an addition", async () => {
    render(<HomeworkPage />);

    fireEvent.click(await screen.findByRole("button", { name: /duplicate/i }));
    await waitFor(() => expect(screen.getByText(/duplicate class test/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByText(/duplicate class test/i)).not.toBeInTheDocument());

    // Still exactly the one original, un-copied.
    expect(screen.getAllByText("Fractions Practice")).toHaveLength(1);
  });

  it("reverts to a plain add form after closing a duplicate", async () => {
    render(<HomeworkPage />);

    fireEvent.click(await screen.findByRole("button", { name: /duplicate/i }));
    await waitFor(() => expect(screen.getByText(/duplicate class test/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByText(/duplicate class test/i)).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /add class test/i }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^add class test$/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/copied from/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toHaveValue("");
  });
});
