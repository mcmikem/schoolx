import React from "react";
import { render, screen } from "@testing-library/react";
import ContactActions from "@/components/students/ContactActions";

describe("ContactActions", () => {
  it("links to call and WhatsApp with a normalised number", () => {
    render(<ContactActions phone="0772 123 456" name="Amina" />);
    expect(screen.getByLabelText("Call Amina")).toHaveAttribute("href", "tel:+256772123456");
    expect(screen.getByLabelText("WhatsApp Amina")).toHaveAttribute(
      "href",
      expect.stringContaining("wa.me/256772123456"),
    );
  });

  it("renders nothing without a usable phone", () => {
    const { container } = render(<ContactActions phone="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
