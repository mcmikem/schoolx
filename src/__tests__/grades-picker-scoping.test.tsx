import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import GradesPage from "@/app/dashboard/grades/page";

/**
 * QA scenario #18: picking the wrong subject used to fail only on save, so a
 * teacher filled a whole grid and then got "You are not assigned to teach this
 * subject in this class" per cell with nothing persisted.
 *
 * The page already prevents this by scoping both pickers to the teacher's real
 * allocations (grades/page.tsx — `classOptions` / `subjectOptions`, gated on
 * `isClassScopedRole`). This test exists to stop that scoping from being
 * silently dropped, which would put the bug straight back. No toast is
 * asserted: the prevention is by omission from the dropdown.
 */

const SUBJECTS = [
  { id: "sub-math", name: "Mathematics" },
  { id: "sub-eng", name: "English" },
  { id: "sub-sci", name: "Science" },
];

const CLASSES = [
  { id: "class-1", name: "Primary 3", stream: "A", level: "Primary" },
  { id: "class-2", name: "Primary 4", stream: "A", level: "Primary" },
];

let mockRole = "teacher";
// Only class-1 + sub-math is actually allocated to this teacher.
let mockAllocations: Array<{ subject_id: string; class_id: string }> = [
  { subject_id: "sub-math", class_id: "class-1" },
];
// Existing saved marks. Drives `submissionStatus`, and therefore which
// workflow buttons render.
let mockExistingGrades: Array<{ status?: string | null }> = [];

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    school: { id: "school-1", name: "King's Academy" },
    user: { id: "user-1", full_name: "Jane Teacher", role: mockRole },
    isDemo: false,
  }),
}));

jest.mock("@/lib/academic-context", () => ({
  useAcademic: () => ({ academicYear: "2026", currentTerm: 1 }),
}));

jest.mock("@/lib/hooks", () => ({
  useClasses: () => ({ classes: CLASSES, loading: false }),
  useSubjects: () => ({ subjects: SUBJECTS, loading: false }),
  useStaff: () => ({ staff: [] }),
}));

jest.mock("@/lib/offline-hooks", () => ({
  useOfflineStudents: () => ({ data: [], loading: false, error: null }),
  useOfflineGrades: () => ({ data: mockExistingGrades, loading: false, error: null }),
}));

jest.mock("@/components/Toast", () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() }),
}));

jest.mock("@/lib/offline", () => ({
  useOnlineStatus: () => true,
  offlineDB: { save: jest.fn(), cacheFromServer: jest.fn(), getPendingSync: jest.fn() },
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      const methods = ["select", "eq", "order", "limit", "insert", "update", "upsert", "single"];
      for (const m of methods) chain[m] = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: table === "teacher_subjects" ? mockAllocations : [], error: null });
      return chain;
    },
    auth: { getSession: jest.fn() },
  },
}));

jest.mock("@/components/MaterialIcon", () => ({
  __esModule: true,
  default: ({ icon }: { icon: string }) => <span>{icon}</span>,
}));

jest.mock("@/components/ui/PageHeader", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
  PageSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/Tabs", () => ({
  Tabs: ({ tabs }: { tabs: { id: string; label: string }[] }) => (
    <div>
      {tabs.map((tab) => (
        <div key={tab.id}>{tab.label}</div>
      ))}
    </div>
  ),
  TabPanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/Modal", () => ({
  Modal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div>{children}</div> : null,
  ModalFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/Card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/index", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Input: (props: any) => <input {...props} />,
  Select: (props: any) => <select {...props} />,
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

/** The page renders `<label>` with no htmlFor and no wrapping, so the selects
 *  have no accessible name. Find each by the label text in its own wrapper. */
function selectUnder(labelText: RegExp): HTMLSelectElement {
  const label = screen.getByText(labelText);
  const select = label.parentElement?.querySelector("select");
  if (!select) throw new Error(`no select found under ${labelText}`);
  return select as HTMLSelectElement;
}

function optionLabels(select: HTMLSelectElement, placeholder: string) {
  return Array.from(select.options)
    .map((o) => o.textContent?.trim() ?? "")
    .filter((t) => t !== placeholder && t !== "");
}

describe("grade picker scoping (scenario #18)", () => {
  beforeEach(() => {
    mockRole = "teacher";
    mockAllocations = [{ subject_id: "sub-math", class_id: "class-1" }];
    mockExistingGrades = [];
  });

  it("lists the whole school before a class is chosen", async () => {
    render(<GradesPage />);

    // Guards the tests below: if the list were empty everywhere, "scoped"
    // would pass for the wrong reason.
    await waitFor(() => {
      expect(optionLabels(selectUnder(/subject area/i), "Select Subject")).toEqual([
        "Mathematics",
        "English",
        "Science",
      ]);
    });
  });

  it("never offers a teacher a class they are not allocated to", async () => {
    render(<GradesPage />);

    await waitFor(() => {
      const labels = optionLabels(selectUnder(/target class/i), "Select Class");
      expect(labels.length).toBeGreaterThan(0);
    });

    const labels = optionLabels(selectUnder(/target class/i), "Select Class");
    expect(labels.join(" ")).toContain("Primary 3");
    expect(labels).not.toContain("Primary 4");
  });

  it("narrows subjects to the chosen class allocation", async () => {
    render(<GradesPage />);

    // The class list is scoped, so it starts empty and fills once the
    // allocations land. Reading it before that yields no options at all.
    await waitFor(() => {
      expect(optionLabels(selectUnder(/target class/i), "Select Class").length).toBeGreaterThan(0);
    });

    const classSelect = selectUnder(/target class/i);
    const primary3 = Array.from(classSelect.options).find((o) => o.textContent?.includes("Primary 3"));
    expect(primary3).toBeDefined();
    fireEvent.change(classSelect, { target: { value: primary3!.value } });

    await waitFor(() => {
      expect(optionLabels(selectUnder(/subject area/i), "Select Subject")).toEqual(["Mathematics"]);
    });
  });

  it("scopes per class, not to a single subject", async () => {
    // Allocated to Mathematics in P3 and English in P4 — each class must offer
    // only its own subject, or the filter is really "first allocation wins".
    mockAllocations = [
      { subject_id: "sub-math", class_id: "class-1" },
      { subject_id: "sub-eng", class_id: "class-2" },
    ];
    render(<GradesPage />);

    await waitFor(() => {
      expect(optionLabels(selectUnder(/target class/i), "Select Class").length).toBe(2);
    });

    const classSelect = selectUnder(/target class/i);
    const p4 = Array.from(classSelect.options).find((o) => o.textContent?.includes("Primary 4"))!;
    fireEvent.change(classSelect, { target: { value: p4.value } });

    await waitFor(() => {
      expect(optionLabels(selectUnder(/subject area/i), "Select Subject")).toEqual(["English"]);
    });

    // …and back to P3 it is Mathematics again.
    fireEvent.change(selectUnder(/target class/i), {
      target: {
        value: Array.from(selectUnder(/target class/i).options).find((o) => o.textContent?.includes("Primary 3"))!
          .value,
      },
    });
    await waitFor(() => {
      expect(optionLabels(selectUnder(/subject area/i), "Select Subject")).toEqual(["Mathematics"]);
    });
  });

  it("offers an unallocated teacher no class to pick, so no subject is reachable", async () => {
    mockAllocations = [];
    render(<GradesPage />);

    await waitFor(() => {
      expect(optionLabels(selectUnder(/target class/i), "Select Class")).toEqual([]);
    });

    // Subjects are only scoped once a class is chosen. With no class on offer
    // that unfiltered list is unreachable, which is what keeps the wrong
    // subject out of reach — the guard is the empty class list.
  });

  it("leaves both pickers unfiltered for a non class-scoped role", async () => {
    mockRole = "headmaster";
    render(<GradesPage />);

    await waitFor(() => {
      const classes = optionLabels(selectUnder(/target class/i), "Select Class");
      expect(classes.join(" ")).toContain("Primary 4");
    });

    expect(optionLabels(selectUnder(/subject area/i), "Select Subject")).toEqual(["Mathematics", "English", "Science"]);
  });
});
/**
 * Scenario #19: a teacher could send a sheet to the DOS but never recall it, so
 * a mis-keyed score stayed stuck in "sent". The retreat buttons are the visible
 * half of that fix; `getPrevGradeWorkflowStatusActions` (operations.test.ts) and
 * `buildWorkflowUpdatePayload` (grades-workflow-payload.test.ts) cover the
 * permission and persistence halves.
 */
describe("grade workflow retreat controls (scenario #19)", () => {
  /** Picks a class and a subject, whichever options the role is allowed to see. */
  async function selectClassAndSubject() {
    await waitFor(() => {
      expect(optionLabels(selectUnder(/target class/i), "Select Class").length).toBeGreaterThan(0);
    });
    const classSelect = selectUnder(/target class/i);
    const p3 = Array.from(classSelect.options).find((o) => o.textContent?.includes("Primary 3"))!;
    fireEvent.change(classSelect, { target: { value: p3.value } });

    await waitFor(() => {
      expect(optionLabels(selectUnder(/subject area/i), "Select Subject").length).toBeGreaterThan(0);
    });
    const subjectSelect = selectUnder(/subject area/i);
    const choice =
      Array.from(subjectSelect.options).find((o) => o.textContent === "Mathematics") ??
      Array.from(subjectSelect.options).find((o) => o.value !== "");
    fireEvent.change(subjectSelect, { target: { value: choice!.value } });

    // The workflow block only renders once a class *and* subject are chosen.
    await screen.findByLabelText(/grades overview/i);
  }

  beforeEach(() => {
    mockRole = "teacher";
    mockAllocations = [{ subject_id: "sub-math", class_id: "class-1" }];
    mockExistingGrades = [];
  });

  it("offers a teacher a way to pull their submitted sheet back to draft", async () => {
    mockExistingGrades = [{ status: "submitted" }];
    render(<GradesPage />);
    await selectClassAndSubject();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pull back to draft/i })).toBeInTheDocument();
    });
  });

  it("offers a teacher no un-publish, which is the headmaster's call", async () => {
    mockExistingGrades = [{ status: "published" }];
    render(<GradesPage />);
    await selectClassAndSubject();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /pull back to draft/i })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /un-publish/i })).not.toBeInTheDocument();
  });

  it("offers a headmaster an un-publish on a released sheet", async () => {
    mockRole = "headmaster";
    mockExistingGrades = [{ status: "published" }];
    render(<GradesPage />);
    await selectClassAndSubject();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /un-publish/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /pull back to draft/i })).not.toBeInTheDocument();
  });

  it("shows no retreat control on a sheet still in draft", async () => {
    mockExistingGrades = [{ status: "draft" }];
    render(<GradesPage />);
    await selectClassAndSubject();

    // selectClassAndSubject already waited for the overview, so the sheet is
    // open here; draft has nowhere to step back to.
    expect(screen.queryByRole("button", { name: /pull back to draft/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /withdraw from review/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /un-publish/i })).not.toBeInTheDocument();
  });
});
