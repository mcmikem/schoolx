"use client";
/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import NotifyParentsModal from "@/components/students/NotifyParentsModal";

describe("NotifyParentsModal", () => {
  const base = {
    schoolName: "Lakeview Primary",
  };

  it("returns nothing when closed", () => {
    const { container } = render(
      <NotifyParentsModal {...base} open={false} onClose={jest.fn()} entries={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists each selected pupil with a WhatsApp link built from their phone", () => {
    render(
      <NotifyParentsModal
        {...base}
        open
        onClose={jest.fn()}
        entries={[
          {
            id: "s1",
            studentName: "Alex Mugisha",
            parentName: "John Mugisha",
            phone: "0772123456",
            className: "P.4",
          },
        ]}
      />,
    );
    expect(screen.getByText("Alex Mugisha")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /WhatsApp/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("https://wa.me/256772123456?text="));
    expect(link.getAttribute("href")).toContain(encodeURIComponent("Alex Mugisha"));
  });

  it("flags pupils whose parent has no number instead of hiding them", () => {
    render(
      <NotifyParentsModal
        {...base}
        open
        onClose={jest.fn()}
        entries={[
          { id: "s1", studentName: "Alex Mugisha", phone: "0772123456" },
          { id: "s2", studentName: "Mary Auma", phone: null },
        ]}
      />,
    );
    expect(screen.getByText("No number saved")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 parents reachable on WhatsApp")).toBeInTheDocument();
  });

  it("shows contacts-only wording when nobody is reachable", () => {
    render(
      <NotifyParentsModal
        {...base}
        open
        onClose={jest.fn()}
        entries={[{ id: "s2", studentName: "Mary Auma", phone: "" }]}
      />,
    );
    expect(screen.getByText("No phone numbers saved for these pupils yet")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
