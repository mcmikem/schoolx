import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import CollapsibleSidebar from "@/components/CollapsibleSidebar";
import type { NavGroup } from "@/lib/navigation";

/**
 * Reported symptom: open the menu, tap a group title, the sub-items appear and
 * then immediately spring back closed.
 *
 * CollapsibleSidebar derived its open/closed state in an effect keyed on the
 * `groups` prop. SidebarShell builds that prop with
 * `filterGroupsByFeatureStage(...).map().filter(...)`, which returns a fresh
 * array of fresh objects on every render — so any re-render changed the prop's
 * identity, re-ran the effect, and reset every group to its default. Whether it
 * visibly snapped back depended on whether a re-render happened to land after
 * your tap, hence "sometimes".
 */

jest.mock("next/navigation", () => ({ usePathname: () => mockPathname }));
let mockPathname = "/dashboard";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

jest.mock("@/components/MaterialIcon", () => ({
  __esModule: true,
  default: ({ icon }: { icon: string }) => <span data-testid="icon">{icon}</span>,
}));

const GROUPS: NavGroup[] = [
  {
    label: "Today",
    defaultOpen: false,
    items: [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }],
  },
  {
    label: "Daily Work",
    defaultOpen: false,
    items: [
      { href: "/dashboard/students", label: "Students", icon: "group" },
      { href: "/dashboard/staff", label: "Staff", icon: "person" },
    ],
  },
];

/** A parent that hands down a new array identity on every render, exactly as
 *  SidebarShell's filterGroupsByFeatureStage does. */
function Host({ bump }: { bump: number }) {
  const groups = GROUPS.map((g) => ({ ...g, items: [...g.items] }));
  return (
    <>
      <button onClick={() => bump}>rerender</button>
      <CollapsibleSidebar groups={groups} onNavigate={() => {}} />
      <span data-testid="bump">{bump}</span>
    </>
  );
}

function title(label: string) {
  return screen.getByTitle(label);
}

function isExpanded(label: string) {
  return title(label).getAttribute("aria-expanded") === "true";
}

describe("CollapsibleSidebar group expansion", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
    localStorage.clear();
  });

  it("reveals search matches inside a collapsed group", () => {
    render(<Host bump={0} />);
    expect(screen.queryByText("Staff")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search navigation pages"), { target: { value: "Staff" } });
    expect(screen.getByRole("link", { name: /Staff/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search navigation pages"), { target: { value: "" } });
    expect(isExpanded("Daily Work")).toBe(false);
  });

  it("hides recent destinations absent from the current role navigation", () => {
    localStorage.setItem(
      "skoolmate_recent_pages",
      JSON.stringify([{ href: "/dashboard/payroll", label: "Payroll", icon: "payments" }]),
    );
    render(<Host bump={0} />);
    expect(screen.queryByRole("link", { name: /Payroll/ })).not.toBeInTheDocument();
  });

  it("keeps a group open when the parent re-renders with a new array identity", () => {
    const { rerender } = render(<Host bump={0} />);

    expect(isExpanded("Daily Work")).toBe(false);
    fireEvent.click(title("Daily Work"));
    expect(isExpanded("Daily Work")).toBe(true);

    // A fresh prop identity — the exact thing filterGroupsByFeatureStage does.
    rerender(<Host bump={1} />);

    expect(isExpanded("Daily Work")).toBe(true);
    expect(screen.getByText("Students")).toBeInTheDocument();
  });

  it("keeps a group closed when the parent re-renders", () => {
    const { rerender } = render(<Host bump={0} />);

    expect(isExpanded("Daily Work")).toBe(false);
    rerender(<Host bump={1} />);

    expect(isExpanded("Daily Work")).toBe(false);
  });

  it("keeps an open group open across several re-renders", () => {
    const { rerender } = render(<Host bump={0} />);
    fireEvent.click(title("Daily Work"));

    for (let i = 1; i <= 4; i += 1) {
      rerender(<Host bump={i} />);
    }

    expect(isExpanded("Daily Work")).toBe(true);
  });

  it("still toggles closed on a second tap", () => {
    const { rerender } = render(<Host bump={0} />);

    fireEvent.click(title("Daily Work"));
    expect(isExpanded("Daily Work")).toBe(true);

    fireEvent.click(title("Daily Work"));
    expect(isExpanded("Daily Work")).toBe(false);

    rerender(<Host bump={1} />);
    expect(isExpanded("Daily Work")).toBe(false);
  });

  it("auto-opens the group holding the current page on first render", () => {
    mockPathname = "/dashboard/staff";
    render(<Host bump={0} />);

    expect(isExpanded("Daily Work")).toBe(true);
    expect(isExpanded("Today")).toBe(false);
  });

  it("does not fight the user after navigation: a manual close survives a route change", () => {
    const { rerender } = render(<Host bump={0} />);
    fireEvent.click(title("Daily Work"));
    expect(isExpanded("Daily Work")).toBe(true);

    // User collapses it, then navigates elsewhere.
    fireEvent.click(title("Daily Work"));
    expect(isExpanded("Daily Work")).toBe(false);

    act(() => {
      mockPathname = "/dashboard/fees";
    });
    rerender(<Host bump={1} />);

    expect(isExpanded("Daily Work")).toBe(false);
  });
});
