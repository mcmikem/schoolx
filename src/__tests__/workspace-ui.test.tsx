import { render, screen, within } from "@testing-library/react";
import ActionPanel from "@/components/dashboard/ActionPanel";
import StatCard from "@/components/dashboard/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";

jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ school: { name: "Test School" } }) }));

describe("shared workspace UI", () => {
  it("keeps workflow links in a named navigation with a section heading", () => {
    render(
      <ActionPanel
        title="Quick actions"
        label="Teacher quick actions"
        description="Choose your next task."
        actions={[{ href: "/dashboard/attendance", label: "Take attendance", icon: "how_to_reg" }]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Quick actions" })).toBeVisible();
    const navigation = screen.getByRole("navigation", { name: "Teacher quick actions" });
    expect(within(navigation).getByRole("link", { name: /Take attendance/ })).toHaveAttribute(
      "href",
      "/dashboard/attendance",
    );
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it.each([
    "standard",
    "premium",
  ] as const)("preserves the page heading, actions, and context for %s headers", (variant) => {
    render(
      <PageHeader
        title="Attendance Center"
        subtitle="Choose a class."
        variant={variant}
        actions={<button type="button">Save register</button>}
      >
        <span>Term 3</span>
      </PageHeader>,
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Save register" })).toBeVisible();
    expect(screen.getByText("Term 3")).toBeVisible();
  });

  it("keeps long metric values and context readable with named destinations", () => {
    render(
      <StatCard
        label="Attendance today"
        value="Not recorded"
        subValue="No registers submitted for today"
        icon="how_to_reg"
        accentColor="amber"
        href="/dashboard/attendance"
      />,
    );
    expect(screen.getByText("Not recorded")).toBeVisible();
    expect(screen.getByText("No registers submitted for today")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open Attendance today" })).toHaveAttribute(
      "href",
      "/dashboard/attendance",
    );
  });
});
