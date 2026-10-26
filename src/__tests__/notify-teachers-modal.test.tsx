/**
 * Dashboard alerts must carry the fix, not just the diagnosis.
 * "Attendance not taken" should tip into a WhatsApp chat per class
 * teacher; a class without a teacher should send the headmaster to the
 * assignment screen instead of dead-ending.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import NotifyTeachersModal from "@/components/dashboard/NotifyTeachersModal";

const classes = [
  { id: "c1", name: "P.1", class_teacher_id: "t1" },
  { id: "c2", name: "P.2", class_teacher_id: null },
  { id: "c3", name: "P.3", class_teacher_id: "t3" },
];

const staff = [
  { id: "t1", full_name: "Marjoline Nabbosa", phone: "0772 123 456" },
  { id: "t3", full_name: "Peter Okafor", phone: null },
];

describe("NotifyTeachersModal", () => {
  it("matches classes to teachers and opens WhatsApp links with a typed message", () => {
    render(<NotifyTeachersModal open onClose={() => {}} classes={classes} staff={staff} schoolName="Bright Star" />);

    const link = screen.getAllByRole("link", { name: /whatsapp/i })[0];
    expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/256772123456\?text=/);
    expect(decodeURIComponent(link.getAttribute("href") || "")).toContain("Class P.1");
    expect(decodeURIComponent(link.getAttribute("href") || "")).toContain("attendance");
    expect(screen.getByText("Marjoline")).toBeInTheDocument();
  });

  it("offers Assign for unassigned classes instead of a dead end", () => {
    render(<NotifyTeachersModal open onClose={() => {}} classes={classes} staff={staff} schoolName="Bright Star" />);
    expect(screen.getByText("No teacher assigned")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Assign" }).getAttribute("href")).toBe("/dashboard/classes");
  });

  it("says when a teacher has no number instead of hiding the row", () => {
    render(<NotifyTeachersModal open onClose={() => {}} classes={classes} staff={staff} schoolName="Bright Star" />);
    expect(screen.getAllByText("No number saved")).toHaveLength(1);
  });

  it("closes when the close button is pressed", () => {
    const onClose = jest.fn();
    render(<NotifyTeachersModal open onClose={onClose} classes={classes} staff={staff} schoolName="Bright Star" />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});
