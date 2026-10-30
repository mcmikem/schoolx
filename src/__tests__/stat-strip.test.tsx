import { render, screen } from "@testing-library/react";
import { ActionLinks } from "@/components/ui/ActionLinks";
import { StatStrip } from "@/components/ui/StatStrip";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("@/components/MaterialIcon", () => ({ icon }: { icon: string }) => <span>{icon}</span>);

describe("StatStrip", () => {
  it("renders one flat hairline strip when variant is flat", () => {
    const { container } = render(
      <StatStrip
        variant="flat"
        columns={3}
        items={[
          { label: "Students", value: "420", hint: "210B · 210G" },
          { label: "Attendance", value: "96%", hint: "403 present" },
          { label: "Fees", value: "UGX 12M", hint: "72% collected" },
        ]}
      />,
    );

    expect(container.firstChild).toHaveClass("border-y");
    expect(screen.getByText("Students")).toBeInTheDocument();
    expect(screen.getByText("420")).toBeInTheDocument();
    expect(screen.getByText("210B · 210G")).toBeInTheDocument();
    expect(container.querySelectorAll(".rounded-2xl")).toHaveLength(0);
  });

  it("keeps the card treatment for pages that have not moved to the flat strip", () => {
    const { container } = render(<StatStrip items={[{ label: "Students", value: "420" }]} />);
    expect(container.querySelector(".rounded-2xl")).not.toBeNull();
  });

  it("announces changing values when asked", () => {
    const { container } = render(<StatStrip ariaLive="polite" items={[{ label: "Pending", value: "3" }]} />);
    expect(container.querySelector("dl")).toHaveAttribute("aria-live", "polite");
  });
});

describe("ActionLinks", () => {
  it("renders flat underlined shortcuts", () => {
    render(
      <ActionLinks
        label="Common actions"
        columns={4}
        items={[
          { label: "Students", href: "/dashboard/students/", icon: "group" },
          { label: "Fees", href: "/dashboard/fees/", icon: "payments" },
        ]}
      />,
    );

    expect(screen.getByRole("navigation", { name: "Common actions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Students/ })).toHaveAttribute("href", "/dashboard/students/");
    expect(screen.getByRole("link", { name: /Fees/ })).toBeInTheDocument();
    expect(screen.getByText("group")).toBeInTheDocument();
  });

  it("renders nothing when there are no actions", () => {
    const { container } = render(<ActionLinks items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
