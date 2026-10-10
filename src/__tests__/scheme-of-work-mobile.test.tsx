import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import SchemeOfWorkPage from "@/app/dashboard/scheme-of-work/page";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ school: { id: "school-1" }, user: { id: "teacher-1" } }),
}));
jest.mock("@/lib/academic-context", () => ({ useAcademic: () => ({ academicYear: "2026" }) }));
jest.mock("@/lib/hooks", () => ({
  useClasses: () => ({ classes: [{ id: "class-1", name: "Primary 3" }] }),
  useSubjects: () => ({ subjects: [{ id: "subject-1", name: "Mathematics" }] }),
}));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => {
      const query: Record<string, jest.Mock> = {};
      query.select = jest.fn(() => query);
      query.eq = jest.fn(() => query);
      query.order = jest.fn().mockResolvedValue({ data: [], error: null });
      return query;
    }),
  },
}));
jest.mock("@/components/Toast", () => {
  const toast = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
  return { useToast: () => toast };
});
jest.mock("@/components/PageErrorBoundary", () => ({
  PageErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/MaterialIcon", () => ({
  __esModule: true,
  default: ({ icon, children }: { icon?: string; children?: React.ReactNode }) => <span>{icon || children}</span>,
}));
jest.mock("@/components/ui/PageHeader", () => ({
  PageHeader: ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {actions}
    </header>
  ),
}));
jest.mock("@/components/ui/Card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));
jest.mock("@/components/ui/index", () => ({
  Button: ({ children, onClick, disabled, type }: any) => (
    <button type={type || "button"} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

describe("Scheme of work mobile editor", () => {
  it("switches the active week and updates planned-week progress when a topic is entered", async () => {
    render(<SchemeOfWorkPage />);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "class-1" } });
    fireEvent.change(selects[1], { target: { value: "subject-1" } });

    const progress = await screen.findByLabelText(/scheme progress/i);
    await waitFor(() => expect(within(progress).getByText("0 of 12 weeks planned")).toBeInTheDocument());

    const weekPicker = screen.getByRole("navigation", { name: /select scheme week/i });
    const weekTwo = within(weekPicker).getByRole("button", { name: "2" });
    fireEvent.click(weekTwo);
    expect(weekTwo).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getAllByPlaceholderText("Main topics for this week...")[1], {
      target: { value: "Fractions" },
    });

    expect(within(progress).getByText("1 of 12 weeks planned")).toBeInTheDocument();
  });
});
