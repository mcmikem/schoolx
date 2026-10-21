import { fireEvent, render, screen } from "@testing-library/react";
import SubmittedSheetsPanel, { type SubmittedSheet } from "@/components/grades/SubmittedSheetsPanel";
import TodaysMarkingPanel from "@/components/attendance/TodaysMarkingPanel";

/**
 * The headmaster's pages.
 *
 * A headmaster does not enter marks and does not take the register. They are
 * handed both, and their job is to see what is waiting and to act on it. The
 * Grades page opened on the mark-entry form for everyone, so the headmaster
 * landed on a class picker and a subject list -- the teacher's job -- with no
 * way to see the sheets submitted to them. The register only shows what
 * exists, so a class that had not registered at all was invisible.
 */

const SHEETS: SubmittedSheet[] = [
  {
    classId: "c1",
    className: "P.2",
    subjectId: "s1",
    subjectName: "Mathematics",
    status: "submitted",
    teacherName: "Sarah Senkebejje",
    markedCount: 32,
  },
  {
    classId: "c2",
    className: "P.3",
    subjectId: "s1",
    subjectName: "Mathematics",
    status: "approved",
    teacherName: "Magret Bulage",
    markedCount: 30,
  },
  {
    classId: "c3",
    className: "P.4",
    subjectId: "s2",
    subjectName: "English",
    status: "published",
    teacherName: "Nakalema Sheirah",
    markedCount: 28,
  },
];

describe("the sheets waiting for the headmaster", () => {
  const setup = () => {
    const onOpen = jest.fn();
    const onAdvance = jest.fn();
    render(
      <SubmittedSheetsPanel
        sheets={SHEETS}
        heading="Submitted for review"
        emptyHint="Nothing waiting"
        nextAction={(sheet) =>
          sheet.status === "submitted"
            ? { status: "approved" as const, label: "Approve" }
            : sheet.status === "approved"
              ? { status: "published" as const, label: "Publish" }
              : null
        }
        onOpen={onOpen}
        onAdvance={onAdvance}
      />,
    );
    return { onOpen, onAdvance };
  };

  it("lists the work that has been handed in, with who sent it", () => {
    setup();

    expect(screen.getByText("P.2 · Mathematics")).toBeInTheDocument();
    expect(screen.getByText(/Sarah Senkebejje/)).toBeInTheDocument();
    expect(screen.getByText(/32 marked/)).toBeInTheDocument();
    // The status chip on the sheet itself (the filter button of the same name
    // is elsewhere on the page).
    expect(screen.getAllByText("Submitted").length).toBeGreaterThan(0);
  });

  it("says how many are waiting", () => {
    setup();
    expect(screen.getByText(/1 waiting for you/)).toBeInTheDocument();
  });

  it("filters to what is waiting", () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: /Submitted \(1\)/ }));
    expect(screen.getByText("P.2 · Mathematics")).toBeInTheDocument();
    expect(screen.queryByText("P.4 · English")).not.toBeInTheDocument();
  });

  it("approves the sheet the headmaster taps", () => {
    const { onAdvance } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onAdvance).toHaveBeenCalledWith(SHEETS[0], "approved");
  });

  it("opens a sheet to see the marks in it", () => {
    const { onOpen } = setup();

    fireEvent.click(screen.getByText("P.3 · Mathematics"));
    expect(onOpen).toHaveBeenCalledWith(SHEETS[1]);
  });
});

describe("who has marked today", () => {
  const setup = () => {
    const onOpen = jest.fn();
    render(
      <TodaysMarkingPanel
        dateLabel="21/10/2026"
        onOpen={onOpen}
        classes={[
          { classId: "c1", className: "P.1", marked: 32, total: 32, absent: 2 },
          { classId: "c2", className: "P.2", marked: 0, total: 30, absent: 0 },
        ]}
      />,
    );
    return { onOpen };
  };

  it("lists every class, marked or not", () => {
    setup();

    expect(screen.getByText("P.1")).toBeInTheDocument();
    expect(screen.getByText("P.2")).toBeInTheDocument();
    expect(screen.getByText(/32 of 32 recorded/)).toBeInTheDocument();
  });

  it("says which class has not marked yet", () => {
    setup();

    expect(screen.getByText(/P\.2 has not marked yet/)).toBeInTheDocument();
    expect(screen.getByText("Not marked yet")).toBeInTheDocument();
  });

  it("opens the register of the class the headmaster taps", () => {
    const { onOpen } = setup();

    fireEvent.click(screen.getByText("P.2"));
    expect(onOpen).toHaveBeenCalledWith("c2");
  });
});
