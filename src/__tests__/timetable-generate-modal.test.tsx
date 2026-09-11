import { render, screen, fireEvent } from "@testing-library/react";
import { ToastProvider } from "@/components/Toast";
import GenerateTimetableModal from "@/components/timetable/GenerateTimetableModal";

const SUBJECTS = [
  { id: "s-eng", name: "English", code: "ENG" },
  { id: "s-math", name: "Mathematics", code: "MTC" },
];

function renderModal() {
  return render(
    <ToastProvider>
      <GenerateTimetableModal
        isOpen
        onClose={() => {}}
        schoolId="school-1"
        academicYear="2026"
        subjects={SUBJECTS}
        onApproved={() => {}}
      />
    </ToastProvider>,
  );
}

describe("GenerateTimetableModal", () => {
  it("renders the configure step with per-subject period inputs", () => {
    renderModal();
    expect(screen.getByText("Auto-generate Timetable")).toBeTruthy();
    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("Mathematics")).toBeTruthy();
    expect(screen.getByText("Generate draft")).toBeTruthy();
  });

  it("requires at least one school day before preview", () => {
    renderModal();
    for (const label of ["Mon", "Tue", "Wed", "Thu", "Fri"]) {
      fireEvent.click(screen.getByText(label));
    }
    fireEvent.click(screen.getByText("Generate draft"));
    expect(screen.getByText("Select at least one school day.")).toBeTruthy();
  });

  it("previews a draft and shows placements", async () => {
    const placements = [
      {
        classId: "c1",
        subjectId: "s-eng",
        teacherId: "t1",
        dayOfWeek: 1,
        periodNumber: 1,
        className: "P.5A",
        subjectName: "English (ENG)",
        teacherName: "Teacher One",
        dayName: "Monday",
      },
    ];
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { placements, conflicts: [], stats: { placed: 1, unplaced: 0 }, slotsDefined: true },
          }),
      }),
    ) as unknown as typeof fetch;

    renderModal();
    fireEvent.click(screen.getByText("Generate draft"));
    expect(await screen.findByText("Teacher One")).toBeTruthy();
    expect(screen.getByText(/Approve & save/)).toBeTruthy();
    (global.fetch as jest.Mock).mockRestore?.();
  });
});
