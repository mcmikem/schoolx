import { fireEvent, render, screen } from "@testing-library/react";
import TimetablePrintSheet from "@/components/timetable/TimetablePrintSheet";

const slots = [
  {
    id: "s0",
    name: "Assembly",
    start_time: "08:00:00",
    end_time: "08:15:00",
    order_number: 1,
    is_lesson: false,
  },
  {
    id: "s1",
    name: "Period 1",
    start_time: "08:15:00",
    end_time: "08:55:00",
    order_number: 2,
    is_lesson: true,
  },
  {
    id: "s2",
    name: "Break",
    start_time: "10:15:00",
    end_time: "10:35:00",
    order_number: 3,
    is_lesson: false,
  },
];

const days = [
  { value: 1, full: "Monday" },
  { value: 2, full: "Tuesday" },
  { value: 3, full: "Wednesday" },
];

const entries = [
  {
    day_of_week: 1,
    period_number: 2,
    teacher_id: "teacher-1",
    room: "Lab A",
    subjects: { name: "Mathematics" },
  },
];

function renderSheet(overrides: Partial<Parameters<typeof TimetablePrintSheet>[0]> = {}) {
  return render(
    <TimetablePrintSheet
      isOpen
      onClose={jest.fn()}
      schoolName="St. Mary's Secondary School"
      className="S.1 A"
      academicYear="2026"
      termLabel="Term 2"
      slots={slots}
      days={days}
      entries={entries}
      teacherNameById={{ "teacher-1": "Okello J." }}
      {...overrides}
    />,
  );
}

describe("TimetablePrintSheet", () => {
  beforeEach(() => {
    jest.spyOn(window, "print").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders nothing when closed", () => {
    renderSheet({ isOpen: false });
    expect(screen.queryByText("Print preview")).toBeNull();
  });

  it("prints the school, class and term header", () => {
    renderSheet();
    expect(screen.getByText("St. Mary's Secondary School")).toBeTruthy();
    expect(screen.getByText(/S\.1 A — Class Timetable/)).toBeTruthy();
    expect(screen.getByText("2026 · Term 2")).toBeTruthy();
  });

  it("shows every school day as a column", () => {
    renderSheet();
    expect(screen.getByText("Monday")).toBeTruthy();
    expect(screen.getByText("Tuesday")).toBeTruthy();
    expect(screen.getByText("Wednesday")).toBeTruthy();
  });

  it("places lessons, teachers and rooms in the right cell", () => {
    renderSheet();
    expect(screen.getByText("Mathematics")).toBeTruthy();
    expect(screen.getByText("Okello J.")).toBeTruthy();
    expect(screen.getByText("Lab A")).toBeTruthy();
  });

  it("prints the non-lesson rows as a single spanning row", () => {
    renderSheet();
    const breakCell = screen.getByText("Break");
    expect(breakCell.getAttribute("colSpan")).toBe(String(days.length));
  });

  it("hands the sheet to the browser print dialog", () => {
    renderSheet();
    fireEvent.click(screen.getByText("Print"));
    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const onClose = jest.fn();
    renderSheet({ onClose });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
