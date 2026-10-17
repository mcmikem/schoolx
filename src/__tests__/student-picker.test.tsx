import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import StudentPicker from "@/components/students/StudentPicker";

/**
 * Replaces a <select> of every pupil.
 *
 * A native select of forty children is unusable on a phone: a full-screen
 * scroller of near-identical names with no filtering, where "Nakato Sarah" and
 * "Nakato Peter" are indistinguishable. Staff also know a pupil by admission
 * number at least as often as by name, so both have to match.
 */

const students = [
  { id: "s1", name: "Nakato Sarah", balance: 350000, student_number: "STU-001", class_name: "P.3" },
  { id: "s2", name: "Nakato Peter", balance: 200000, student_number: "STU-002", class_name: "P.3" },
  { id: "s3", name: "Namuswe Alice", balance: 0, student_number: "STU-003", class_name: "P.7" },
];

function Harness({ list = students }: { list?: typeof students }) {
  const [value, setValue] = useState("");
  return (
    <>
      <StudentPicker students={list} value={value} onChange={setValue} required />
      <output data-testid="chosen">{value}</output>
    </>
  );
}

const open = () => {
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  return input;
};

describe("student picker", () => {
  it("shows every pupil to begin with", () => {
    render(<Harness />);
    open();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("narrows as you type a name", () => {
    render(<Harness />);
    const input = open();
    fireEvent.change(input, { target: { value: "nakato" } });
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("narrows on the admission number too", () => {
    // Staff know one or the other, rarely both.
    render(<Harness />);
    const input = open();
    fireEvent.change(input, { target: { value: "STU-003" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByText("Namuswe Alice")).toBeInTheDocument();
  });

  it("is not confused by near-identical surnames", () => {
    // The case a dropdown makes worst: two children, same surname.
    render(<Harness />);
    const input = open();
    fireEvent.change(input, { target: { value: "peter" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByText("Nakato Peter")).toBeInTheDocument();
  });

  it("says so when nothing matches, rather than showing an empty box", () => {
    render(<Harness />);
    const input = open();
    fireEvent.change(input, { target: { value: "zzzz" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText(/No pupil matches/i)).toBeInTheDocument();
  });

  it("reports the chosen id", () => {
    render(<Harness />);
    const input = open();
    fireEvent.change(input, { target: { value: "alice" } });
    fireEvent.click(screen.getByText("Namuswe Alice"));
    expect(screen.getByTestId("chosen")).toHaveTextContent("s3");
  });

  it("reads back as the name once chosen", () => {
    render(<Harness />);
    const input = open();
    fireEvent.change(input, { target: { value: "alice" } });
    fireEvent.click(screen.getByText("Namuswe Alice"));
    expect(screen.getByRole("combobox")).toHaveValue("Namuswe Alice");
  });

  it("can be chosen from the keyboard alone", () => {
    render(<Harness />);
    const input = open();
    fireEvent.change(input, { target: { value: "nakato" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("chosen")).not.toHaveTextContent("");
  });

  it("clears the pupil when asked", () => {
    render(<Harness />);
    const input = open();
    fireEvent.change(input, { target: { value: "alice" } });
    fireEvent.click(screen.getByText("Namuswe Alice"));
    fireEvent.click(screen.getByRole("button", { name: /Clear pupil/i }));
    expect(screen.getByTestId("chosen")).toHaveTextContent("");
  });

  it("does not leave the list filtered to the last thing typed", () => {
    // Choosing a pupil used to leave the query behind, so choosing another one
    // began with a list of one.
    render(<Harness />);
    const input = open();
    fireEvent.change(input, { target: { value: "alice" } });
    fireEvent.click(screen.getByText("Namuswe Alice"));
    fireEvent.click(screen.getByRole("button", { name: /Clear pupil/i }));
    open();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });
});
