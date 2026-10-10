import { render, screen } from "@testing-library/react";
import { MinimalLoadingScreen } from "@/components/ui/Skeleton";

describe("MinimalLoadingScreen", () => {
  it("speaks plainly instead of auth jargon", () => {
    const { container } = render(<MinimalLoadingScreen />);
    expect(screen.getByText("Getting your school ready…")).toBeInTheDocument();
    expect(container.textContent).not.toContain("Verifying your session");
  });

  it("announces itself to assistive tech and shows progress", () => {
    render(<MinimalLoadingScreen />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders as a frosted card, not a bare full-screen splash", () => {
    const { container } = render(<MinimalLoadingScreen />);
    const card = screen.getByRole("status");
    expect(card.className).toContain("backdrop-blur-md");
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });
});
