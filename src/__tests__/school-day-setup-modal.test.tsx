import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SchoolDaySetupModal from "@/components/timetable/SchoolDaySetupModal";

const deleteEq = jest.fn().mockResolvedValue({ error: null });
const insert = jest.fn().mockResolvedValue({ error: null });
const deleteIn = jest.fn().mockResolvedValue({ error: null });

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn((table: string) => {
      if (table === "timetable_slots") {
        return { delete: () => ({ eq: deleteEq }), insert };
      }
      return { delete: () => ({ in: deleteIn }) };
    }),
  },
}));

jest.mock("@/components/Toast", () => {
  const toast = { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() };
  return { useToast: () => toast };
});

function renderModal(onApplied = jest.fn(), onClose = jest.fn()) {
  return render(
    <SchoolDaySetupModal
      isOpen
      onClose={onClose}
      schoolId="school-1"
      classIds={["class-1"]}
      defaultLevel="lower_secondary"
      onApplied={onApplied}
    />,
  );
}

describe("SchoolDaySetupModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("previews a Ugandan lower-secondary day of eight lessons", () => {
    renderModal();
    expect(screen.getByText(/classes end 14:55/)).toBeTruthy();
    expect(screen.getByText("Period 8")).toBeTruthy();
    expect(screen.getByText("Break")).toBeTruthy();
    expect(screen.getByText("Lunch")).toBeTruthy();
    expect(screen.getByText("Games / Clubs")).toBeTruthy();
  });

  it("switches to the primary preset on request", () => {
    renderModal();
    fireEvent.click(screen.getByText(/Primary \(P1–P7\)/));
    expect(screen.getByText(/classes end 15:05/)).toBeTruthy();
  });

  it("refuses a break longer than the MoES limit", () => {
    renderModal();
    const breakInput = screen.getByLabelText(/Break \(max 30\)/i);
    fireEvent.change(breakInput, { target: { value: "45" } });
    expect(screen.getByText(/break must not exceed 30 minutes/i)).toBeTruthy();
    expect((screen.getByText("Update bell schedule").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("replaces the bell schedule and clears lessons when asked", async () => {
    const onApplied = jest.fn();
    const onClose = jest.fn();
    renderModal(onApplied, onClose);

    fireEvent.change(screen.getByLabelText(/^Assembly$/i), { target: { value: "10" } });
    fireEvent.click(
      screen
        .getByText(/Also clear existing lessons/i)
        .closest("label")!
        .querySelector("input")!,
    );
    fireEvent.click(screen.getByRole("button", { name: /update bell schedule/i }));
    fireEvent.click(screen.getByRole("button", { name: /apply schedule/i }));

    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(deleteEq).toHaveBeenCalledWith("school_id", "school-1");
    expect(insert).toHaveBeenCalledTimes(1);
    const rows = insert.mock.calls[0][0] as Array<{ name: string; is_lesson: boolean }>;
    expect(rows.filter((row) => row.is_lesson)).toHaveLength(8);
    expect(rows[0].name).toBe("Assembly");
    expect(deleteIn).toHaveBeenCalledWith("class_id", ["class-1"]);
    expect(onClose).toHaveBeenCalled();
  });
});
