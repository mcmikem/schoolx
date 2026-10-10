import { render, screen, fireEvent } from "@testing-library/react";
import { RollCallPhoto } from "@/components/attendance/RollCallPhoto";

describe("RollCallPhoto", () => {
  it("renders initials when there is no photo", () => {
    render(<RollCallPhoto name="Jane Doe" photoUrl={null} />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("renders a non-draggable, touch-transparent image when a photo exists", () => {
    render(<RollCallPhoto name="Jane Doe" photoUrl="https://example.com/jane.jpg" />);
    const img = screen.getByAltText("Jane Doe");

    // <img> is natively draggable: a touch-drag starting on the photo is
    // hijacked for image-drag/callout, the browser fires touchcancel, and
    // row swipe dies silently on real phones. All three guards pin that.
    expect(img.getAttribute("draggable")).toBe("false");
    expect(img.className).toContain("pointer-events-none");
    fireEvent.dragStart(img);
    expect(screen.getByAltText("Jane Doe")).toBeInTheDocument();
  });

  it("falls back to initials when the photo URL dies", () => {
    render(<RollCallPhoto name="Jane Doe" photoUrl="https://example.com/gone.jpg" />);
    fireEvent.error(screen.getByAltText("Jane Doe"));
    expect(screen.getByText("JD")).toBeInTheDocument();
  });
});
